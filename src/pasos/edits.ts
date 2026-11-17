// Arma el reel en Edits para Mac siguiendo edit/plan.json, para que la creadora lo termine y lo publique desde ahí.
// Planos, velocidad, voz, audio de los clips, música, textos grandes, logo y subtítulos (corregidos con la transcripción).
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { EDITS, MUSICA } from "../config.js";
import { conectarConEdits, ErrorDeEdits, type Agregado, type Alias, type Edits, type IdDePista } from "../lib/edits.js";
import { expandirCasa } from "../lib/entorno.js";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info } from "../lib/ffmpeg.js";
import { armarMontaje, corregirSubtitulos, ratosConAudioDelClip, TOLERANCIA_EDITS } from "../lib/montaje.js";
import { validarPlan } from "../lib/plan.js";
import { guardarJson, leerJson, segundos, type Proyecto } from "../lib/proyecto.js";
import type { Palabra } from "../lib/transcripcion.js";

/** Dónde queda anotado el último envío a Edits (la app lo usa para mostrarlo). */
export function archivoEdits(p: Proyecto) {
  return path.join(p.edit, "edits.json");
}

/** Copia un archivo a la carpeta que Edits puede abrir, salvo que ya esté igual. */
function copiar(origen: string, carpeta: string, nombre = path.basename(origen)) {
  const destino = path.join(carpeta, nombre);
  if (!existsSync(destino) || statSync(destino).size !== statSync(origen).size) copyFileSync(origen, destino);
  return destino;
}

/** Si Edits falla, el error dice qué paso no se pudo hacer y el detalle técnico queda anotado con `log`. */
export async function mandarAEdits(p: Proyecto, log: (linea: string) => void = console.log) {
  try {
    return await armar(p, log);
  } catch (e) {
    if (!(e instanceof ErrorDeEdits)) throw e;
    log(`Detalle: ${e.motivo}`);
    throw new ErrorReel(e.message);
  }
}

async function armar(p: Proyecto, log: (linea: string) => void) {
  const r = await validarPlan(p);
  if (!r.ok) throw new ErrorReel([...r.errores.map((e) => `Error: ${e}`), "Arreglá el plan y probá de nuevo."].join("\n"));
  const plan = r.plan!;
  const m = armarMontaje(plan);
  const titulo = path.basename(p.raiz);

  const edits = await conectarConEdits();
  if ((await edits.pantalla()) !== "inicio") {
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
  let logo: string | undefined;
  if (m.logos.length) {
    if (!p.logo) throw new ErrorReel("El plan lleva logo pero no encontré logo.png.");
    logo = copiar(p.logo, carpeta, `logo${path.extname(p.logo)}`);
  }

  // 2. Proyecto nuevo
  const proyecto = await edits.proyectoNuevo();
  await edits.ponerTitulo(titulo);
  log(`Proyecto nuevo en Edits: ${titulo}`);

  const alias = new Map<string, Alias>();
  for (const [clave, ruta] of archivos) alias.set(clave, await importarAlPanel(edits, ruta));
  const aliasVoz = await importarAlPanel(edits, voz);
  const cancion = musica ? { ruta: musica, alias: await importarAlPanel(edits, musica) } : undefined;

  // 3. Planos, de a uno y en orden: cada uno entra como superpuesto al final y se pasa a la pista principal.
  //    (Pasar varios a la vez o en el medio deja planos en otra pista.)
  let fin = 0;
  let principal: IdDePista | undefined;
  for (const [i, plano] of m.planos.entries()) {
    const que = `poner el plano ${i + 1} en la pista principal`;
    const { id } = await edits.agregarALaLinea(
      {
        alias: plano.congelado ? alias.get(`congelado-${i + 1}`)! : alias.get(plano.clip)!,
        desde: plano.congelado ? 0 : plano.desde,
        hasta: plano.congelado ? plano.fin - plano.inicio : Math.min(plano.hasta, await largoEnEdits(archivos.get(plano.clip)!)),
        inicio: fin,
        superpuesto: true,
      },
      que,
    );
    // La velocidad va antes de pasarlo a la pista principal, para que entre con su largo final
    if (!plano.congelado && plano.velocidad !== 1) await edits.cambiarVelocidad(id, plano.velocidad, que);
    const pista = await edits.pasarAPrincipal(id, que);
    principal ??= pista;
    if (pista !== principal) throw new ErrorDeEdits("rechazo", que, `convertToMain lo dejó en la pista ${pista} y la principal es ${principal}`);
    if (!plano.congelado && !plano.audioDelClip) await edits.cambiarVolumen(id, 0, que);
    fin = await edits.finDeLaPista(principal, que);
    log(`Plano ${i + 1}/${m.planos.length}`);
  }

  // 4. Voz en off (en pedazos: se corta donde habla alguien del clip) y música
  log("Poniendo la voz");
  let pistaVoz: IdDePista | undefined;
  for (const pedazo of m.voz) {
    const hasta = Math.min(pedazo.hasta, await largoEnEdits(voz));
    const puesto = await edits.agregarALaLinea({ alias: aliasVoz, desde: pedazo.desde, hasta, inicio: pedazo.inicio, pista: pistaVoz }, "poner la voz");
    await ubicar(edits, puesto, pedazo.inicio, "poner la voz");
    pistaVoz ??= puesto.pista;
  }
  if (cancion) {
    log("Poniendo la música");
    const que = "poner la música";
    const hasta = Math.min(m.duracion, await largoEnEdits(cancion.ruta));
    const puesto = await edits.agregarALaLinea({ alias: cancion.alias, desde: 0, hasta, inicio: 0 }, que);
    await ubicar(edits, puesto, 0, que);
    await edits.cambiarVolumen(puesto.id, MUSICA.volumen, que);
  }

  // 5. Textos grandes y logo
  log("Poniendo los textos");
  const t = EDITS.textos;
  for (const texto of m.textos) {
    const que = `poner el texto "${texto.texto.replace(/\n/g, " / ")}"`;
    const puesto = await edits.agregarTexto({ texto: texto.texto, inicio: texto.inicio, duracion: texto.fin - texto.inicio }, que);
    await ubicar(edits, puesto, texto.inicio, que);
    await edits.estiloDeTexto(puesto.id, { tamano: t.tamano, negrita: true, color: t.color, alineacion: "center" }, que);
    await edits.posicionDeTexto(puesto.id, { x: t.x, y: t.y }, que);
    await edits.animacionDeTexto(puesto.id, texto.animacion, que);
  }
  if (logo) {
    const que = "poner el logo";
    for (const bloque of m.logos) {
      const id = await edits.agregarImagen({ ruta: logo, inicio: bloque.inicio, x: 0.5, y: 0.5, escala: EDITS.logo.escala }, que);
      const { inicio, duracion } = await edits.elemento(id, que);
      await ubicar(edits, { id, inicio }, bloque.inicio, que);
      await edits.recortarFinal(id, duracion - (bloque.fin - bloque.inicio), que);
    }
  }

  // 6. Subtítulos: los escribe Edits y se corrigen con la transcripción (nombres, "podés", lo que dice alguien del clip)
  if (m.subtitulos && existsSync(p.transcripcion)) {
    log("Escribiendo los subtítulos");
    await edits.generarSubtitulos(EDITS.subtitulos.idioma);
    const palabras = leerJson<{ words: Palabra[] }>(p.transcripcion).words;
    for (const c of corregirSubtitulos(await edits.subtitulos(), palabras, plan.tramos, ratosConAudioDelClip(m))) {
      if (c.accion === "borrar") await edits.borrarSubtitulo(c.id);
      else await edits.corregirSubtitulo(c.id, c.texto);
    }
    await edits.estiloDeSubtitulos(EDITS.subtitulos.estilo);
  }

  await edits.guardarProyecto();
  guardarJson(archivoEdits(p), { proyecto, titulo, fecha: new Date().toISOString() });
  log(`Proyecto guardado en Edits: "${titulo}".`);
  return { proyecto, titulo };
}

/** Edits mide los archivos en 1/600 de segundo, redondeando para abajo, y rechaza un pedazo que pase de ahí. */
async function largoEnEdits(ruta: string) {
  return Math.floor((await info(ruta)).duracion * 600) / 600;
}

/** A veces Edits pone lo nuevo donde estaba el cursor y no donde se le pidió (pasa con addText), y lo dice en su respuesta. */
async function ubicar(edits: Edits, puesto: Agregado, inicio: number, que: string) {
  if (Math.abs(puesto.inicio - inicio) > TOLERANCIA_EDITS) await edits.mover(puesto.id, inicio, que);
}

export function carpetaParaEdits() {
  return expandirCasa(process.env.EDITS_CARPETA || EDITS.carpeta);
}

/** Recién creado el proyecto, la primera importToMediaPanel falla con "no media panel" y no importa nada. */
async function importarAlPanel(edits: Edits, ruta: string) {
  for (let intento = 1; ; intento++) {
    try {
      return await edits.importar(ruta);
    } catch (e) {
      if (intento === 3 || !(e instanceof ErrorDeEdits) || !e.motivo.includes("no media panel")) throw e;
    }
  }
}
