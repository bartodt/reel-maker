import { esSinVoz, type Tramo, type TramoConVoz } from "./plan.js";
import type { Palabra } from "./transcripcion.js";

export interface Pieza {
  tramo: Tramo;
  /** Segundos del reel terminado */
  inicio: number;
  fin: number;
}

/**
 * Dónde cae cada tramo en el reel terminado, y cuánto dura el reel.
 * Cada tramo con voz arranca donde terminó el anterior con voz (aunque su "desde" esté corrido unas centésimas),
 * así la imagen no se desfasa de la voz.
 */
export function armarLinea(tramos: Tramo[]): { piezas: Pieza[]; duracion: number } {
  let reloj = 0;
  let posicionEnLaVoz = 0;
  const piezas = tramos.map((tramo) => {
    const inicio = reloj;
    if (esSinVoz(tramo)) {
      reloj += tramo.duracion;
    } else {
      reloj += tramo.hasta - posicionEnLaVoz;
      posicionEnLaVoz = tramo.hasta;
    }
    return { tramo, inicio, fin: reloj };
  });
  return { piezas, duracion: reloj };
}

/** Pasa un segundo de la voz limpia al segundo del reel terminado: le suma los tramos sin voz que van antes. */
export function vozAReel(segundo: number, tramos: Tramo[]): number {
  let posicionEnLaVoz = 0;
  let extra = 0;
  for (const t of tramos) {
    if (!esSinVoz(t)) posicionEnLaVoz = t.hasta;
    else if (segundo >= posicionEnLaVoz) extra += t.duracion;
  }
  return segundo + extra;
}

export type SegmentoAudio =
  | { tipo: "voz"; desde: number; hasta: number }
  | { tipo: "silencio"; duracion: number }
  | { tipo: "clip"; clip: string; arrancaEn: number; duracion: number };

/** Qué se escucha, en orden: pedazos de la voz limpia, silencios (solo música) y el audio de algunos clips. */
export function segmentosDeAudio(tramos: Tramo[]): SegmentoAudio[] {
  const segmentos: SegmentoAudio[] = [];
  let posicionEnLaVoz = 0;
  for (const t of tramos) {
    const ultimo = segmentos.at(-1);
    if (!esSinVoz(t)) {
      if (ultimo?.tipo === "voz") ultimo.hasta = t.hasta;
      else segmentos.push({ tipo: "voz", desde: posicionEnLaVoz, hasta: t.hasta });
      posicionEnLaVoz = t.hasta;
    } else if (t.audioDelClip) {
      segmentos.push({ tipo: "clip", clip: t.clip, arrancaEn: t.arrancaEn, duracion: t.duracion });
    } else if (ultimo?.tipo === "silencio") {
      ultimo.duracion += t.duracion;
    } else {
      segmentos.push({ tipo: "silencio", duracion: t.duracion });
    }
  }
  return segmentos;
}

export interface Grupo {
  inicio: number;
  fin: number;
  tramos: Tramo[];
}

/** Junta tramos seguidos que comparten algo (el mismo texto, el logo). Los que no lo tienen quedan afuera. */
export function agrupar(tramos: Tramo[], clave: (t: Tramo) => string | undefined): (Grupo & { clave: string })[] {
  const grupos: (Grupo & { clave: string })[] = [];
  let anterior: string | undefined;
  for (const { tramo, inicio, fin } of armarLinea(tramos).piezas) {
    const k = clave(tramo);
    if (k !== undefined && k === anterior) {
      const g = grupos.at(-1)!;
      g.fin = fin;
      g.tramos.push(tramo);
    } else if (k !== undefined) {
      grupos.push({ clave: k, inicio, fin, tramos: [tramo] });
    }
    anterior = k;
  }
  return grupos;
}

export interface TextoEnPantalla {
  texto: string;
  inicio: number;
  fin: number;
  /** Cuándo aparece cada palabra (segundos del reel) */
  momentos: number[];
}

/**
 * Los textos grandes del plan, listos para dibujar. Cada palabra aparece cuando se dice;
 * si no se dice (un precio escrito distinto, un texto sobre un tramo sin voz), aparece un poquito después de la anterior.
 */
export function textosEnPantalla(tramos: Tramo[], palabras: Palabra[], pasoSinVoz: number): TextoEnPantalla[] {
  return agrupar(tramos, (t) => t.texto?.trim() || undefined).map((g) => {
    const conVoz = g.tramos.filter((t): t is TramoConVoz => !esSinVoz(t));
    const dichas = conVoz.length
      ? palabras
          .filter((w) => w.type === "word" && w.start >= conVoz[0].desde - 0.05 && w.start < conVoz.at(-1)!.hasta)
          .map((w) => ({ text: w.text, start: vozAReel(w.start, tramos) }))
      : [];
    return {
      texto: g.clave,
      inicio: g.inicio,
      fin: g.fin,
      momentos: momentosDePalabras(palabrasDeTexto(g.clave), dichas, g.inicio, g.fin, pasoSinVoz),
    };
  });
}

/** Palabras de un texto, en el orden en que aparecen (los saltos de línea no cuentan). */
export function palabrasDeTexto(texto: string): string[] {
  return texto.split(/\s+/).filter(Boolean);
}

function normalizar(s: string): string {
  return s
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Números que en el texto van con cifras y se dicen con palabras
const NUMEROS: Record<string, string[]> = {
  "1": ["un", "uno", "una"],
  "2": ["dos"],
  "3": ["tres"],
  "4": ["cuatro"],
  "5": ["cinco"],
  "6": ["seis"],
  "7": ["siete"],
  "8": ["ocho"],
  "9": ["nueve"],
  "10": ["diez"],
};

function seDice(delTexto: string, dicha: string): boolean {
  const a = normalizar(delTexto);
  const b = normalizar(dicha);
  return a !== "" && (a === b || (NUMEROS[a]?.includes(b) ?? false));
}

/**
 * Cuándo aparece cada palabra del texto: cuando se dice. Las que no se dicen aparecen junto con la siguiente
 * que sí se dice, o `paso` segundos después de la anterior si no hay ninguna. Nunca para atrás.
 */
export function momentosDePalabras(
  delTexto: string[],
  dichas: { text: string; start: number }[],
  inicio: number,
  fin: number,
  paso: number,
): number[] {
  const dicho: (number | undefined)[] = [];
  let buscarDesde = 0;
  for (const palabra of delTexto) {
    const j = dichas.findIndex((d, k) => k >= buscarDesde && seDice(palabra, d.text));
    dicho.push(j >= 0 ? dichas[j].start : undefined);
    if (j >= 0) buscarDesde = j + 1;
  }

  const tope = Math.max(inicio, fin - 0.1);
  const momentos: number[] = [];
  for (let i = 0; i < delTexto.length; i++) {
    const anterior = i === 0 ? inicio : momentos[i - 1];
    const siguienteDicha = dicho.slice(i).find((m) => m !== undefined);
    const momento = siguienteDicha ?? (i === 0 ? inicio : anterior + paso);
    momentos.push(Math.min(Math.max(momento, anterior), tope));
  }
  return momentos;
}
