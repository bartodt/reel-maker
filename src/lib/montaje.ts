// Qué hay que poner en la línea de tiempo de Edits para armar un plan, y cómo corregir los subtítulos que genera Edits.
// Lógica pura: lo que habla con Edits está en src/pasos/edits.ts.
import { EDITS } from "../config.js";
import { armarLinea, segmentosDeAudio, vozAReel } from "./linea.js";
import { esSinVoz, type Plan, type Tramo } from "./plan.js";
import type { Palabra } from "./transcripcion.js";

export interface PlanoEnEdits {
  /** Archivo dentro de clips/ */
  clip: string;
  /** Segundos del reel */
  inicio: number;
  fin: number;
  /** Pedazo del clip que se usa (segundos del clip). En un plano congelado, el cuadro que se congela es `desde`. */
  desde: number;
  hasta: number;
  velocidad: number;
  congelado: boolean;
  audioDelClip: boolean;
}

export interface Montaje {
  duracion: number;
  planos: PlanoEnEdits[];
  /** Pedazos de la voz limpia: `desde`/`hasta` sobre la voz, `inicio` en el reel */
  voz: { desde: number; hasta: number; inicio: number }[];
  /** Textos grandes. Tramos seguidos con el mismo texto van juntos. */
  textos: { texto: string; inicio: number; fin: number; animacion: string }[];
  /** Tramos seguidos con logo van juntos */
  logos: { inicio: number; fin: number }[];
  subtitulos: boolean;
}

const r = (n: number) => Math.round(n * 1000) / 1000;

/** Junta los tramos seguidos que comparten algo (mismo texto, logo) en un solo bloque. */
function bloques<T>(planos: { inicio: number; fin: number; valor: T | undefined }[]) {
  const salida: { valor: T; inicio: number; fin: number }[] = [];
  for (const p of planos) {
    if (p.valor === undefined) continue;
    const ultimo = salida.at(-1);
    if (ultimo && ultimo.valor === p.valor && Math.abs(ultimo.fin - p.inicio) < 0.01) ultimo.fin = p.fin;
    else salida.push({ valor: p.valor, inicio: p.inicio, fin: p.fin });
  }
  return salida;
}

export function armarMontaje(plan: Plan): Montaje {
  const { piezas, duracion } = armarLinea(plan.tramos);

  const planos = piezas.map(({ tramo: t, inicio, fin }): PlanoEnEdits => {
    const velocidad = t.velocidad ?? 1;
    return {
      clip: t.clip,
      inicio: r(inicio),
      fin: r(fin),
      desde: r(t.arrancaEn),
      hasta: velocidad === 0 ? r(t.arrancaEn) : r(t.arrancaEn + (fin - inicio) * velocidad),
      velocidad,
      congelado: velocidad === 0,
      audioDelClip: esSinVoz(t) && t.audioDelClip === true,
    };
  });

  const voz: Montaje["voz"] = [];
  let reloj = 0;
  for (const s of segmentosDeAudio(plan.tramos)) {
    if (s.tipo === "voz") {
      voz.push({ desde: r(s.desde), hasta: r(s.hasta), inicio: r(reloj) });
      reloj += s.hasta - s.desde;
    } else {
      reloj += s.duracion;
    }
  }

  const conTramo = piezas.map(({ tramo, inicio, fin }) => ({ tramo, inicio: r(inicio), fin: r(fin) }));
  const textos = bloques(conTramo.map((p) => ({ ...p, valor: p.tramo.texto }))).map((b) => ({
    texto: b.valor,
    inicio: b.inicio,
    fin: b.fin,
    // La animación de palabra por palabra de Edits no va al ritmo de la voz: en textos cortos no llega a mostrarse entero
    animacion: b.fin - b.inicio >= EDITS.textos.minimoPalabraPorPalabra ? EDITS.textos.animacion : EDITS.textos.animacionCorta,
  }));
  const logos = bloques(conTramo.map((p) => ({ ...p, valor: p.tramo.logo ? true : undefined }))).map(({ inicio, fin }) => ({ inicio, fin }));

  return { duracion: r(duracion), planos, voz, textos, logos, subtitulos: plan.subtitulos !== false };
}

/** Los ratos del reel en que se escucha a alguien del clip y no la voz en off. */
export function ratosConAudioDelClip(montaje: Montaje) {
  return montaje.planos.filter((p) => p.audioDelClip).map((p) => ({ inicio: p.inicio, fin: p.fin }));
}

export interface SubtituloDeEdits {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

export type Correccion = { id: string; accion: "borrar" } | { id: string; accion: "cambiar"; texto: string };

/**
 * Edits escribe los subtítulos con su propio reconocimiento de voz: escribe en neutro ("puedes" en vez de "podés"),
 * se equivoca con los nombres y puede entender cualquier cosa en lo que dice alguien del clip.
 * Esto reemplaza cada subtítulo por las palabras de nuestra transcripción que caen en ese rato,
 * y borra los que caen donde habla alguien del clip (de eso no hay transcripción).
 */
export function corregirSubtitulos(subtitulos: SubtituloDeEdits[], palabras: Palabra[], tramos: Tramo[], ratosDelClip: { inicio: number; fin: number }[]): Correccion[] {
  const enElReel = palabras
    .filter((w) => w.type === "word")
    .map((w) => {
      const inicio = vozAReel(w.start, tramos);
      const fin = vozAReel(w.end, tramos);
      return { texto: w.text, medio: (inicio + fin) / 2 };
    });

  const delClip = (s: SubtituloDeEdits) => {
    const medio = (s.startTime + s.endTime) / 2;
    return ratosDelClip.some((x) => medio >= x.inicio && medio < x.fin);
  };
  const deVoz = subtitulos.filter((s) => !delClip(s));

  // Cada palabra va al subtítulo que la contiene o, si cae en un hueco entre dos, al más cercano
  const asignadas = new Map<string, string[]>(deVoz.map((s) => [s.id, []]));
  for (const w of enElReel) {
    let mejor: SubtituloDeEdits | undefined;
    let distancia = Infinity;
    for (const s of deVoz) {
      const d = w.medio < s.startTime ? s.startTime - w.medio : w.medio > s.endTime ? w.medio - s.endTime : 0;
      if (d < distancia) [mejor, distancia] = [s, d];
    }
    if (mejor && distancia <= EDITS.subtitulos.huecoMaximo) asignadas.get(mejor.id)!.push(w.texto);
  }

  const correcciones: Correccion[] = subtitulos.filter(delClip).map((s) => ({ id: s.id, accion: "borrar" as const }));
  for (const s of deVoz) {
    // Edits no muestra el punto ni los dos puntos del final de un subtítulo
    const texto = asignadas.get(s.id)!.join(" ").replace(/[.:]+$/, "");
    if (texto && texto !== s.text) correcciones.push({ id: s.id, accion: "cambiar", texto });
  }
  return correcciones;
}

export interface ElementoDeEdits {
  id: string;
  trackId: string;
  /** "video" es la pista principal */
  trackType: string;
  /** Edits llama "music" a cualquier audio */
  content: string;
  startTime: number;
  endTime: number;
  sourceInPoint?: number;
  sourceOutPoint?: number;
  speed?: number;
  volume?: number;
  text?: string;
  animation?: string;
}

/** Segundos. Edits redondea los tiempos a sus cuadros: en Pancho y Coca (19 planos) lo más que se corrió fue 0,013 s. */
export const TOLERANCIA_EDITS = 0.1;

const distinto = (a: number | undefined, b: number) => a === undefined || Math.abs(a - b) > TOLERANCIA_EDITS;
const seg = (n: number | undefined) => (n === undefined ? "?" : n.toFixed(2));

/** Los subtítulos coinciden si ya no queda nada para corregir con la transcripción. */
export function diferenciasConEdits(
  m: Montaje,
  elementos: ElementoDeEdits[],
  subtitulos: SubtituloDeEdits[],
  palabras: Palabra[],
  tramos: Tramo[],
): string[] {
  const dif: string[] = [];

  const principal = elementos.filter((e) => e.trackType === "video").sort((a, b) => a.startTime - b.startTime);
  if (principal.length !== m.planos.length) {
    dif.push(`En la pista principal hay ${principal.length} planos y el plan tiene ${m.planos.length}.`);
  }
  for (const [i, plano] of m.planos.entries()) {
    const e = principal[i];
    if (!e) break;
    const n = `Plano ${i + 1}`;
    if (distinto(e.startTime, plano.inicio) || distinto(e.endTime, plano.fin)) {
      dif.push(`${n}: en Edits va de ${seg(e.startTime)} a ${seg(e.endTime)} s y en el plan de ${seg(plano.inicio)} a ${seg(plano.fin)} s.`);
    }
    if (plano.congelado) {
      if (e.content !== "photo") dif.push(`${n}: tenía que ser una imagen congelada y en Edits es ${e.content}.`);
      continue;
    }
    if (distinto(e.sourceInPoint, plano.desde)) dif.push(`${n}: arranca en el segundo ${seg(e.sourceInPoint)} del clip y en el plan en ${seg(plano.desde)}.`);
    if (distinto(e.speed, plano.velocidad)) dif.push(`${n}: va a velocidad ${seg(e.speed)} y en el plan a ${seg(plano.velocidad)}.`);
    if (plano.audioDelClip !== (e.volume ?? 1) > 0) {
      dif.push(`${n}: ${plano.audioDelClip ? "tenía que sonar el audio del clip y está en silencio" : "tenía que ir sin el audio del clip y suena"}.`);
    }
  }

  const audios = elementos.filter((e) => e.trackType === "audio");
  for (const [i, pedazo] of m.voz.entries()) {
    const esta = audios.some((e) => !distinto(e.startTime, pedazo.inicio) && !distinto(e.sourceInPoint, pedazo.desde) && !distinto(e.sourceOutPoint, pedazo.hasta));
    if (!esta) dif.push(`Voz ${i + 1}: no está el pedazo de ${seg(pedazo.desde)} a ${seg(pedazo.hasta)} s de la voz en el segundo ${seg(pedazo.inicio)}.`);
  }

  const deSubtitulo = new Set(subtitulos.map((c) => c.id));
  const textos = elementos.filter((e) => e.content === "text" && !deSubtitulo.has(e.id));
  for (const texto of m.textos) {
    const nombre = `Texto "${texto.texto.replace(/\n/g, " / ")}"`;
    const e = textos.find((x) => x.text === texto.texto);
    if (!e) dif.push(`${nombre}: no está en Edits.`);
    else if (distinto(e.startTime, texto.inicio) || distinto(e.endTime, texto.fin)) {
      dif.push(`${nombre}: en Edits va de ${seg(e.startTime)} a ${seg(e.endTime)} s y en el plan de ${seg(texto.inicio)} a ${seg(texto.fin)} s.`);
    } else if (e.animation !== texto.animacion) dif.push(`${nombre}: tiene la animación ${e.animation} y tenía que ser ${texto.animacion}.`);
  }
  if (textos.length > m.textos.length) dif.push(`Hay ${textos.length} textos en Edits y el plan tiene ${m.textos.length}.`);

  const fotos = elementos.filter((e) => e.trackType === "overlay" && e.content === "photo");
  for (const logo of m.logos) {
    if (!fotos.some((e) => !distinto(e.startTime, logo.inicio) && !distinto(e.endTime, logo.fin))) {
      dif.push(`Logo: no está de ${seg(logo.inicio)} a ${seg(logo.fin)} s.`);
    }
  }

  if (m.subtitulos && subtitulos.length === 0) dif.push("No hay subtítulos.");
  if (!m.subtitulos && subtitulos.length > 0) dif.push("Hay subtítulos y el plan va sin subtítulos.");
  for (const c of corregirSubtitulos(subtitulos, palabras, tramos, ratosConAudioDelClip(m))) {
    const sub = subtitulos.find((x) => x.id === c.id)!;
    dif.push(
      c.accion === "borrar"
        ? `Subtítulo "${sub.text}" (${seg(sub.startTime)} s): cae donde habla alguien del clip.`
        : `Subtítulo "${sub.text}" (${seg(sub.startTime)} s): tenía que decir "${c.texto}".`,
    );
  }
  return dif;
}
