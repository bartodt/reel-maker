// Arma el reel en Edits para Mac siguiendo edit/plan.json, para que la creadora lo termine y lo publique desde ahí.
// Planos, velocidad, voz, audio de los clips, música, textos grandes, logo y subtítulos (corregidos con la transcripción).
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { EDITS, MUSICA } from "../config.js";
import { conectarConEdits, type Edits } from "../lib/edits.js";
import { expandirCasa } from "../lib/entorno.js";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info } from "../lib/ffmpeg.js";
import { armarMontaje, corregirSubtitulos, ratosConAudioDelClip, TOLERANCIA_EDITS, type SubtituloDeEdits } from "../lib/montaje.js";
import { validarPlan } from "../lib/plan.js";
import { guardarJson, leerJson, segundos, type Proyecto } from "../lib/proyecto.js";
import type { Palabra } from "../lib/transcripcion.js";

/** Dónde queda anotado el último envío a Edits (la app lo usa para mostrarlo). */
export function archivoEdits(p: Proyecto) {
  return path.join(p.edit, "edits.json");
}

interface Agregado {
  added: { id: string; trackId: string; start: number; end: number }[];
}

/** Copia un archivo a la carpeta que Edits puede abrir, salvo que ya esté igual. */
function copiar(origen: string, carpeta: string, nombre = path.basename(origen)) {
  const destino = path.join(carpeta, nombre);
  if (!existsSync(destino) || statSync(destino).size !== statSync(origen).size) copyFileSync(origen, destino);
  return destino;
}

export async function mandarAEdits(p: Proyecto, log = console.log) {
  const r = await validarPlan(p);
  if (!r.ok) throw new ErrorReel([...r.errores.map((e) => `Error: ${e}`), "Arreglá el plan y probá de nuevo."].join("\n"));
  const plan = r.plan!;
  const m = armarMontaje(plan);
  const titulo = path.basename(p.raiz);

  const edits = await conectarConEdits();
  const { screen } = await edits.usar<{ screen: string }>("appState");
  if (screen !== "home") {
    throw new ErrorReel("En Edits hay un proyecto abierto. Volvé a la pantalla de inicio de Edits y probá de nuevo.");
  }

  // 1. Edits solo puede abrir archivos de la carpeta Películas: se copia ahí lo que usa el reel (los originales no se tocan)
  log("Copiando el material para Edits");
  const carpeta = path.join(carpetaParaEdits(), titulo);
  mkdirSync(carpeta, { recursive: true });
  const archivos = new Map<string, string>();
  for (const clip of new Set(m.planos.filter((x) => !x.congelado).map((x) => x.clip))) {
    archivos.set(clip, copiar(path.join(p.carpetaClips, clip), carpeta));
  }
  // Una imagen congelada en Edits es una foto: se saca el cuadro del clip
  for (const [i, plano] of m.planos.entries()) {
    if (!plano.congelado) continue;
    const foto = path.join(carpeta, `congelado-${i + 1}.jpg`);
    await ffmpeg(["-ss", segundos(plano.desde), "-i", path.join(p.carpetaClips, plano.clip), "-frames:v", "1", "-q:v", "2", foto]);
    archivos.set(`congelado-${i + 1}`, foto);
  }
  const voz = copiar(p.vozLimpia, carpeta);
  const musica = p.musica ? copiar(p.musica, carpeta, `musica${path.extname(p.musica)}`) : undefined;
  if (m.logos.length && !p.logo) throw new ErrorReel("El plan lleva logo pero no encontré logo.png.");
  const logo = m.logos.length && p.logo ? copiar(p.logo, carpeta, `logo${path.extname(p.logo)}`) : undefined;

  // 2. Proyecto nuevo
  const { id: proyecto } = await edits.usar<{ id: string }>("newProject");
  await edits.usar("setTitle", { name: titulo });
  log(`Proyecto nuevo en Edits: ${titulo}`);

  const alias = new Map<string, string>();
  const importar = async (clave: string, ruta: string) => alias.set(clave, await importarAlPanel(edits, ruta));
  for (const [clave, ruta] of archivos) await importar(clave, ruta);
  await importar("voz", voz);
  if (musica) await importar("musica", musica);

  // 3. Planos, de a uno y en orden: cada uno entra como superpuesto al final y se pasa a la pista principal.
  //    (Pasar varios a la vez o en el medio deja planos en otra pista.)
  let fin = 0;
  let principal: string | undefined;
  for (const [i, plano] of m.planos.entries()) {
    const id = await agregarPlano(edits, plano.congelado ? alias.get(`congelado-${i + 1}`)! : alias.get(plano.clip)!, {
      desde: plano.congelado ? 0 : plano.desde,
      hasta: plano.congelado ? plano.fin - plano.inicio : Math.min(plano.hasta, await largoEnEdits(archivos.get(plano.clip)!)),
      en: fin,
      velocidad: plano.congelado ? 1 : plano.velocidad,
    });
    const { trackId } = await edits.usar<{ trackId: string }>("convertToMain", { id });
    principal ??= trackId;
    if (trackId !== principal) throw new Error(`El plano ${i + 1} quedó fuera de la pista principal de Edits`);
    if (!plano.congelado && !plano.audioDelClip) await edits.usar("setVolume", { id, volume: 0 });
    const { elements } = await edits.usar<{ elements: { endTime: number }[] }>("elements", { trackId: principal, fields: ["endTime"] });
    fin = Math.max(...elements.map((e) => e.endTime));
    log(`Plano ${i + 1}/${m.planos.length}`);
  }

  // 4. Voz en off (en pedazos: se corta donde habla alguien del clip) y música
  log("Poniendo la voz");
  let pistaVoz: string | undefined;
  for (const pedazo of m.voz) {
    const { added } = await edits.usar<Agregado>("addMediaPanelItemsToTimeline", {
      aliasIds: [alias.get("voz")],
      sourceIn: pedazo.desde,
      sourceOut: Math.min(pedazo.hasta, await largoEnEdits(voz)),
      startTime: pedazo.inicio,
      ...(pistaVoz ? { trackId: pistaVoz } : {}),
    });
    await ubicar(edits, added[0].id, added[0].start, pedazo.inicio);
    pistaVoz ??= added[0].trackId;
  }
  if (musica) {
    log("Poniendo la música");
    const duracion = Math.min(m.duracion, await largoEnEdits(musica));
    const { added } = await edits.usar<Agregado>("addMediaPanelItemsToTimeline", { aliasIds: [alias.get("musica")], sourceIn: 0, sourceOut: duracion, startTime: 0 });
    await ubicar(edits, added[0].id, added[0].start, 0);
    await edits.usar("setVolume", { id: added[0].id, volume: MUSICA.volumen });
  }

  // 5. Textos grandes y logo
  log("Poniendo los textos");
  const t = EDITS.textos;
  for (const texto of m.textos) {
    const { id, startTime } = await edits.usar<{ id: string; startTime: number }>("addText", {
      text: texto.texto,
      atSeconds: texto.inicio,
      duration: texto.fin - texto.inicio,
    });
    await ubicar(edits, id, startTime, texto.inicio);
    await edits.usar("setTextStyle", { id, size: t.tamano, bold: true, color: t.color, alignment: "center" });
    await edits.usar("setTextPosition", { id, x: t.x, y: t.y });
    await edits.usar("setTextAnimation", { id, animation: texto.animacion });
  }
  for (const bloque of m.logos) {
    const { id } = await edits.usar<{ id: string }>("addOverlay", { path: logo, startSeconds: bloque.inicio, x: 0.5, y: 0.5, scale: EDITS.logo.escala });
    const { duration, startTime } = await edits.usar<{ duration: number; startTime: number }>("getElement", { id });
    await ubicar(edits, id, startTime, bloque.inicio);
    // trimClip con delta positivo acorta y con delta negativo alarga
    await edits.usar("trimClip", { id, side: "end", delta: duration - (bloque.fin - bloque.inicio) });
  }

  // 6. Subtítulos: los escribe Edits y se corrigen con la transcripción (nombres, "podés", lo que dice alguien del clip)
  if (m.subtitulos && existsSync(p.transcripcion)) {
    log("Escribiendo los subtítulos");
    await edits.usar("generateCaptions", { source: "all", language: EDITS.subtitulos.idioma, curseWords: false });
    const { captions } = await edits.usar<{ captions: SubtituloDeEdits[] }>("captions");
    const palabras = leerJson<{ words: Palabra[] }>(p.transcripcion).words;
    for (const c of corregirSubtitulos(captions, palabras, plan.tramos, ratosConAudioDelClip(m))) {
      if (c.accion === "borrar") await edits.usar("deleteCaptions", { id: c.id });
      else await edits.usar("editCaption", { id: c.id, text: c.texto });
    }
    await edits.usar("setCaptionStyle", { style: EDITS.subtitulos.estilo });
  }

  await edits.usar("saveProject");
  guardarJson(archivoEdits(p), { proyecto, titulo, fecha: new Date().toISOString() });
  log(`Proyecto guardado en Edits: "${titulo}".`);
  return { proyecto, titulo };
}

/** Edits mide los archivos en 1/600 de segundo, redondeando para abajo, y rechaza un pedazo que pase de ahí. */
async function largoEnEdits(ruta: string) {
  return Math.floor((await info(ruta)).duracion * 600) / 600;
}

/** A veces Edits pone lo nuevo donde estaba el cursor y no donde se le pidió (pasa con addText), y lo dice en su respuesta. */
async function ubicar(edits: Edits, id: string, quedo: number, inicio: number) {
  if (Math.abs(quedo - inicio) > TOLERANCIA_EDITS) await edits.usar("move", { id, toSeconds: inicio });
}

export function carpetaParaEdits() {
  return expandirCasa(process.env.EDITS_CARPETA || EDITS.carpeta);
}

/** Recién creado el proyecto, la primera importToMediaPanel falla con "no media panel" y no importa nada. */
async function importarAlPanel(edits: Edits, ruta: string) {
  for (let intento = 1; ; intento++) {
    try {
      const { aliasIds } = await edits.usar<{ aliasIds: string[] }>("importToMediaPanel", { path: ruta });
      return aliasIds[0];
    } catch (e) {
      if (intento === 3 || !String(e).includes("no media panel")) throw e;
    }
  }
}

async function agregarPlano(edits: Edits, aliasId: string, o: { desde: number; hasta: number; en: number; velocidad: number }) {
  const { added } = await edits.usar<Agregado>("addMediaPanelItemsToTimeline", {
    aliasIds: [aliasId],
    sourceIn: o.desde,
    sourceOut: o.hasta,
    startTime: o.en,
    asOverlay: true,
  });
  const id = added[0].id;
  // La velocidad va antes de pasarlo a la pista principal, para que entre con su largo final
  if (o.velocidad !== 1) await edits.usar("setSpeed", { id, speed: o.velocidad });
  return id;
}
