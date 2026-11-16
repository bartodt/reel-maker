// Lo que la app sabe hacer con las carpetas de reels: listarlas, crearlas, leer en qué paso están y guardar lo que sube el usuario.
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, copyFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { SUBTITULOS } from "../config.js";
import { ErrorReel } from "../lib/errores.js";
import { etapaActual, pasosHechos, type Archivos } from "../lib/estado.js";
import { info } from "../lib/ffmpeg.js";
import { armarLinea } from "../lib/linea.js";
import { nombreDeArchivoSeguro, nombreDeCarpeta, nombreLibre, tituloDeCarpeta } from "../lib/nombres.js";
import { enParalelo } from "../lib/paralelo.js";
import { esSinVoz, validarPlan, type Plan } from "../lib/plan.js";
import { EXT_AUDIO, EXT_IMAGEN, EXT_VIDEO, abrirProyecto, guardarJson, leerJson, type Proyecto } from "../lib/proyecto.js";
import { agruparFrases, type Palabra } from "../lib/transcripcion.js";
import { archivoEdits } from "../pasos/edits.js";
import type { ClipInventario } from "../pasos/inventario.js";

const modificado = (ruta: string | undefined) => {
  if (!ruta) return undefined;
  try {
    return statSync(ruta).mtimeMs;
  } catch {
    return undefined;
  }
};

/** La ruta de un reel dentro de la carpeta de reels. El nombre no puede salirse de ahí. */
export function rutaDeReel(base: string, nombre: string): string {
  if (!nombre || nombre.startsWith(".") || /[/\\]/.test(nombre)) throw new ErrorReel("No encontré ese reel.");
  const ruta = path.join(base, nombre);
  if (!existsSync(ruta)) throw new ErrorReel("No encontré ese reel. ¿Lo moviste o le cambiaste el nombre?");
  return ruta;
}

export function abrirReel(base: string, nombre: string): Proyecto {
  return abrirProyecto(rutaDeReel(base, nombre));
}

/** Una carpeta es un reel si tiene clips/, la voz o edit/. */
function pareceReel(ruta: string) {
  if (existsSync(path.join(ruta, "clips")) || existsSync(path.join(ruta, "edit"))) return true;
  return EXT_AUDIO.some((ext) => existsSync(path.join(ruta, "voz" + ext)));
}

export function crearReel(base: string, titulo: string): string {
  const nombre = nombreDeCarpeta(titulo) || `reel-${new Date().toISOString().slice(0, 10)}`;
  const libre = nombreLibre(nombre, (n) => existsSync(path.join(base, n))).replace(/ \((\d+)\)$/, "-$1");
  mkdirSync(path.join(base, libre, "clips"), { recursive: true });
  return libre;
}

/** Copia del plan con el que se creó el reel terminado (la guarda la app al terminar de crearlo). */
export function planDelFinal(p: Proyecto) {
  return path.join(p.edit, "final-plan.json");
}

/** Si el plan de ahora es igual al que se usó para crear el reel. Si el reel se creó por otro lado (la terminal), no se sabe. */
function planIgualAlDelFinal(p: Proyecto): boolean | undefined {
  const copia = planDelFinal(p);
  const final = modificado(p.final);
  const fechaCopia = modificado(copia);
  if (final === undefined || fechaCopia === undefined || fechaCopia + 5000 < final || !existsSync(p.plan)) return undefined;
  const normal = (ruta: string) => {
    try {
      return JSON.stringify(JSON.parse(readFileSync(ruta, "utf8")));
    } catch {
      return readFileSync(ruta, "utf8");
    }
  };
  return normal(copia) === normal(p.plan);
}

/** Qué archivos hay y de cuándo son, para saber en qué paso está el reel. */
function archivosDe(p: Proyecto, clips: string[]): Archivos {
  const cortes = path.join(p.edit, "voz-cortes.json");
  const vozLimpia = modificado(p.vozLimpia);
  const inventario = modificado(p.inventario);
  return {
    clips,
    voz: p.voz ? { nombre: path.basename(p.voz), modificado: modificado(p.voz)! } : undefined,
    vozLimpia:
      vozLimpia === undefined
        ? undefined
        : { modificado: vozLimpia, original: existsSync(cortes) ? leerJson<{ original?: string }>(cortes).original : undefined },
    transcripcion: modificado(p.transcripcion),
    inventario:
      inventario === undefined ? undefined : { modificado: inventario, clips: leerJson<ClipInventario[]>(p.inventario).map((c) => c.archivo) },
    plan: modificado(p.plan),
    final: modificado(p.final),
    planIgualAlDelFinal: planIgualAlDelFinal(p),
  };
}

/** Una URL para pedir un archivo del reel. */
export function urlDeArchivo(nombre: string, relativo: string, version?: number) {
  const ruta = relativo.split(path.sep).map(encodeURIComponent).join("/");
  return `/api/reels/${encodeURIComponent(nombre)}/archivo/${ruta}${version ? `?v=${Math.round(version)}` : ""}`;
}

export function urlDeCuadro(nombre: string, relativo: string, t: number, extra: Record<string, string | number> = {}) {
  const q = new URLSearchParams({ archivo: relativo, t: t.toFixed(2), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
  return `/api/reels/${encodeURIComponent(nombre)}/cuadro?${q}`;
}

export function listarReels(base: string) {
  mkdirSync(base, { recursive: true });
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => !d.name.startsWith(".") && (d.isDirectory() || d.isSymbolicLink()))
    .map((d) => path.join(base, d.name))
    .filter((ruta) => statSync(ruta).isDirectory() && pareceReel(ruta))
    .map((ruta) => {
      const nombre = path.basename(ruta);
      const p = abrirProyecto(ruta);
      const clips = p.clips();
      const pasos = pasosHechos(archivosDe(p, clips));
      // Si el plan no se validó, igual se muestra como "cortes" hasta que se renderice
      const etapa = etapaActual(pasos, true);
      const miniatura = pasos.final
        ? urlDeCuadro(nombre, "edit/final.mp4", 1, { v: Math.round(modificado(p.final)!) })
        : clips[0]
          ? urlDeCuadro(nombre, `clips/${clips[0]}`, 1, { vertical: 1 })
          : null;
      const fechas = [modificado(ruta), modificado(p.plan), modificado(p.final), modificado(p.inventario)].filter((n) => n !== undefined);
      return { nombre, titulo: tituloDeCarpeta(nombre), etapa, clips: clips.length, miniatura, modificado: Math.max(...fechas) };
    })
    .sort((a, b) => b.modificado - a.modificado);
}

/** Todo lo que la app necesita para mostrar un reel. */
export async function leerReel(base: string, nombre: string) {
  const p = abrirReel(base, nombre);
  const clips = p.clips();
  const pasos = pasosHechos(archivosDe(p, clips));

  // ffprobe tarda casi medio segundo por video la primera vez (después queda guardado): se leen varios a la vez
  const infoClips = await enParalelo(clips, 12, async (archivo) => {
    const datos = await info(path.join(p.carpetaClips, archivo)).catch(() => undefined);
    return {
      archivo,
      duracion: datos?.duracion ?? 0,
      ancho: datos?.ancho,
      alto: datos?.alto,
      tieneAudio: datos?.tieneAudio ?? false,
      miniatura: urlDeCuadro(nombre, `clips/${archivo}`, Math.min(1, (datos?.duracion ?? 0) / 2), { vertical: 1 }),
    };
  });

  const archivoSuelto = (ruta: string | undefined) =>
    ruta && path.dirname(ruta) === p.raiz ? { archivo: path.basename(ruta), url: urlDeArchivo(nombre, path.basename(ruta), modificado(ruta)) } : null;
  const guion = ["guion.md", "guion.txt"].map((g) => path.join(p.raiz, g)).find(existsSync);

  let vozLimpia = null;
  if (pasos.limpio) {
    const cortes = path.join(p.edit, "voz-cortes.json");
    const datos = existsSync(cortes) ? leerJson<{ duracionOriginal?: number; duracionLimpia?: number }>(cortes) : {};
    vozLimpia = {
      url: urlDeArchivo(nombre, "edit/voz-limpia.wav", modificado(p.vozLimpia)),
      duracion: datos.duracionLimpia ?? (await info(p.vozLimpia)).duracion,
      duracionOriginal: datos.duracionOriginal,
    };
  }

  const palabras = pasos.transcripto
    ? leerJson<{ words: Palabra[] }>(p.transcripcion).words.filter((w) => w.type === "word")
    : [];

  const inventario = existsSync(p.inventario)
    ? leerJson<ClipInventario[]>(p.inventario).map((c) => ({
        archivo: c.archivo,
        duracion: c.duracion,
        orientacion: c.orientacion,
        conVoz: c.conVoz ?? [],
        momentos: c.momentosCaptura ?? [],
        descripcion: c.descripcion ?? "",
        captura: urlDeArchivo(nombre, path.join("edit", c.captura), modificado(path.join(p.edit, c.captura))),
      }))
    : [];

  let plan = null;
  let validacion = null;
  if (existsSync(p.plan)) {
    let leido: Plan | undefined;
    try {
      leido = leerJson<Plan>(p.plan);
    } catch {
      validacion = { ok: false, errores: ["El plan está roto (no es un JSON válido). Pedile a Claude que lo arme de nuevo."], avisos: [] };
    }
    if (leido) {
      const r = await validarPlan(p).catch((e: Error) => ({ ok: false, errores: [e.message], avisos: [], plan: leido, duracionTotal: 0 }));
      validacion = { ok: r.ok, errores: r.errores, avisos: r.avisos, duracion: r.duracionTotal };
      const tramos = Array.isArray(leido.tramos) ? leido.tramos : [];
      let piezas: { inicio: number; fin: number }[] = [];
      try {
        piezas = armarLinea(tramos).piezas.map(({ inicio, fin }) => ({ inicio, fin }));
      } catch {
        // Un plan mal armado puede no tener línea de tiempo; los errores ya los muestra la validación
      }
      plan = {
        ritmo: leido.ritmo ?? null,
        subtitulos: leido.subtitulos ?? SUBTITULOS.activados,
        tramos: tramos.map((t, i) => ({
          ...t,
          sinVoz: esSinVoz(t),
          inicio: piezas[i]?.inicio ?? 0,
          fin: piezas[i]?.fin ?? 0,
          frase: esSinVoz(t) ? "" : palabras.filter((w) => w.start >= t.desde - 0.05 && w.start < t.hasta).map((w) => w.text).join(" "),
        })),
        hayAnterior: historial(p).length > 0,
      };
    }
  }

  return {
    nombre,
    titulo: tituloDeCarpeta(nombre),
    ruta: p.raiz,
    pasos,
    etapa: etapaActual(pasos, validacion?.ok ?? false),
    material: {
      clips: infoClips,
      voz: archivoSuelto(p.voz),
      musica: archivoSuelto(p.musica),
      logo: p.logo ? { archivo: path.basename(p.logo), url: path.dirname(p.logo) === p.raiz ? urlDeArchivo(nombre, path.basename(p.logo), modificado(p.logo)) : null, propio: path.dirname(p.logo) === p.raiz } : null,
      guion: guion ? readFileSync(guion, "utf8") : "",
    },
    vozLimpia,
    frases: agruparFrases(palabras),
    palabras: palabras.map((w) => ({ texto: w.text, desde: w.start, hasta: w.end })),
    inventario,
    plan,
    validacion,
    final: pasos.final
      ? {
          url: urlDeArchivo(nombre, "edit/final.mp4", modificado(p.final)),
          descargar: urlDeArchivo(nombre, "edit/final.mp4") + "?descargar=1",
          duracion: (await info(p.final)).duracion,
          modificado: modificado(p.final)!,
        }
      : null,
    edits: enEdits(p),
  };
}

/** Si el reel ya se armó en Edits: con qué nombre, cuándo y si los cortes cambiaron después. */
function enEdits(p: Proyecto) {
  const archivo = archivoEdits(p);
  if (!existsSync(archivo)) return null;
  const { titulo, fecha } = leerJson<{ titulo: string; fecha: string }>(archivo);
  const cuando = Date.parse(fecha);
  return { titulo, modificado: cuando, cortesCambiados: (modificado(p.plan) ?? 0) > cuando + 1000 };
}

/** Una "huella" que cambia cuando cambia algo del reel. La app la consulta seguido para saber si tiene que actualizarse. */
export function huella(base: string, nombre: string): string {
  const p = abrirReel(base, nombre);
  const clips = p.clips();
  const fechas = [p.voz, p.vozLimpia, p.transcripcion, p.inventario, p.plan, p.final, archivoEdits(p), p.musica, p.logo, path.join(p.raiz, "guion.md")].map(modificado);
  return [clips.join("|"), ...fechas].join(";");
}

// --- Material que sube el usuario ---

export type TipoArchivo = "clip" | "voz" | "musica" | "logo";
const EXTENSIONES: Record<TipoArchivo, string[]> = { clip: EXT_VIDEO, voz: EXT_AUDIO, musica: EXT_AUDIO, logo: EXT_IMAGEN };
const QUE_ES: Record<TipoArchivo, string> = { clip: "un video", voz: "un audio", musica: "un audio", logo: "una imagen" };

/**
 * Guarda un archivo que sube el usuario. Primero lo baja a edit/ y recién cuando está completo lo pone en su lugar.
 * Los videos nuevos se agregan a clips/ sin pisar ninguno. La voz, la música o el logo anteriores se guardan en edit/anteriores/.
 */
export async function guardarSubida(p: Proyecto, tipo: TipoArchivo, nombreOriginal: string, cuerpo: IncomingMessage) {
  if (!(tipo in EXTENSIONES)) throw new ErrorReel("No sé qué hacer con ese archivo.");
  const original = nombreDeArchivoSeguro(nombreOriginal);
  const ext = path.extname(original).toLowerCase();
  if (!EXTENSIONES[tipo].includes(ext)) {
    throw new ErrorReel(`"${original}" no parece ${QUE_ES[tipo]}. Sirven: ${EXTENSIONES[tipo].join(", ")}.`);
  }

  const temporales = path.join(p.edit, ".subidas");
  mkdirSync(temporales, { recursive: true });
  const temporal = path.join(temporales, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  try {
    await pipeline(cuerpo, createWriteStream(temporal));
  } catch (e) {
    rmSync(temporal, { force: true });
    throw new ErrorReel("Se cortó la subida. Probá de nuevo.");
  }

  let destino: string;
  if (tipo === "clip") {
    mkdirSync(p.carpetaClips, { recursive: true });
    destino = path.join(p.carpetaClips, nombreLibre(original, (n) => existsSync(path.join(p.carpetaClips, n))));
  } else {
    const anterior = EXTENSIONES[tipo].map((e) => path.join(p.raiz, tipo + e)).filter(existsSync);
    if (anterior.length) {
      const guardados = path.join(p.edit, "anteriores");
      mkdirSync(guardados, { recursive: true });
      for (const a of anterior) {
        const sello = new Date().toISOString().replace(/[:.]/g, "-");
        mover(a, path.join(guardados, `${sello}-${path.basename(a)}`));
      }
    }
    destino = path.join(p.raiz, tipo + ext);
  }
  mover(temporal, destino);
  return path.basename(destino);
}

/**
 * Saca un video del reel. No lo borra: lo pasa a edit/quitados/, por si lo quiere recuperar.
 * Si algún plano lo usa, no lo saca (el plan quedaría roto): primero hay que cambiar o sacar esos planos.
 */
export function quitarClip(p: Proyecto, archivo: string) {
  if (!p.clips().includes(archivo)) throw new ErrorReel(`No encontré el video "${archivo}".`);
  if (existsSync(p.plan)) {
    const planos = leerJson<Plan>(p.plan)
      .tramos.map((t, i) => (t.clip === archivo ? i + 1 : 0))
      .filter(Boolean);
    if (planos.length) {
      const cuales = planos.length === 1 ? `el plano ${planos[0]}` : `los planos ${planos.slice(0, -1).join(", ")} y ${planos.at(-1)}`;
      throw new ErrorReel(`Este video se usa en ${cuales}. Pedile a Claude que lo cambie y después sacá el video.`);
    }
  }
  const quitados = path.join(p.edit, "quitados");
  mkdirSync(quitados, { recursive: true });
  mover(path.join(p.carpetaClips, archivo), path.join(quitados, nombreLibre(archivo, (n) => existsSync(path.join(quitados, n)))));
  if (existsSync(p.inventario)) {
    const inventario = leerJson<ClipInventario[]>(p.inventario);
    const resto = inventario.filter((c) => c.archivo !== archivo);
    if (resto.length !== inventario.length) guardarJson(p.inventario, resto);
  }
}

/** Mueve un archivo, aunque sea a otro disco (por ejemplo si clips/ es un enlace a otra carpeta). */
function mover(desde: string, hasta: string) {
  try {
    renameSync(desde, hasta);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    copyFileSync(desde, hasta);
    rmSync(desde);
  }
}

export function guardarGuion(p: Proyecto, texto: string) {
  const existente = ["guion.md", "guion.txt"].map((g) => path.join(p.raiz, g)).find(existsSync);
  writeFileSync(existente ?? path.join(p.raiz, "guion.md"), texto);
}

export function guardarDescripcion(p: Proyecto, clip: string, descripcion: string) {
  if (!existsSync(p.inventario)) throw new ErrorReel("Primero prepará el material.");
  const inventario = leerJson<ClipInventario[]>(p.inventario);
  const c = inventario.find((x) => x.archivo === clip);
  if (!c) throw new ErrorReel(`No encontré el video "${clip}".`);
  c.descripcion = descripcion;
  guardarJson(p.inventario, inventario);
}

// --- Plan: cambios desde la app, con historial para deshacer ---

function carpetaHistorial(p: Proyecto) {
  return path.join(p.edit, "historial");
}

function historial(p: Proyecto): string[] {
  const carpeta = carpetaHistorial(p);
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta)
    .filter((f) => /^plan-\d.*\.json$/.test(f))
    .sort()
    .map((f) => path.join(carpeta, f));
}

// Cuántas versiones anteriores del plan se guardan
const VERSIONES_GUARDADAS = 50;

/** Guarda una copia del plan actual antes de cambiarlo. Devuelve dónde la guardó (si había plan). */
export function guardarVersion(p: Proyecto): string | undefined {
  if (!existsSync(p.plan)) return undefined;
  const carpeta = carpetaHistorial(p);
  mkdirSync(carpeta, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const copia = path.join(carpeta, `plan-${sello}-${Math.random().toString(36).slice(2, 6)}.json`);
  copyFileSync(p.plan, copia);
  for (const viejo of historial(p).slice(0, -VERSIONES_GUARDADAS)) rmSync(viejo);
  return copia;
}

/** Si al final el plan quedó igual a la copia (Claude no cambió nada, o falló), la copia no sirve para deshacer. */
export function descartarVersionSiNoCambio(p: Proyecto, copia: string | undefined) {
  if (copia && existsSync(copia) && existsSync(p.plan) && readFileSync(copia, "utf8") === readFileSync(p.plan, "utf8")) rmSync(copia);
}

/** Prende o apaga los subtítulos del reel. Si queda como viene por defecto (config), se saca el campo. */
export function ponerSubtitulos(p: Proyecto, activos: boolean) {
  if (!existsSync(p.plan)) throw new ErrorReel("Todavía no hay cortes.");
  const plan = leerJson<Plan>(p.plan);
  if ((plan.subtitulos ?? SUBTITULOS.activados) === activos) return;
  guardarVersion(p);
  if (activos === SUBTITULOS.activados) delete plan.subtitulos;
  else plan.subtitulos = activos;
  guardarJson(p.plan, plan);
}

export function deshacer(p: Proyecto) {
  const ultima = historial(p).at(-1);
  if (!ultima) throw new ErrorReel("No hay nada para deshacer.");
  copyFileSync(ultima, p.plan);
  rmSync(ultima);
}
