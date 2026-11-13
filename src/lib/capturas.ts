import type { Tramo } from "./voz.js";

export interface OpcionesCapturas {
  porSegundo: number;
  minimo: number;
  maximo: number;
}

/** En qué segundos del clip sacar capturas: más o menos una por segundo, repartidas parejo y sin tocar los bordes. */
export function momentosDeCaptura(duracion: number, o: OpcionesCapturas): number[] {
  const cantidad = Math.min(o.maximo, Math.max(o.minimo, Math.round(duracion * o.porSegundo)));
  const paso = duracion / cantidad;
  return Array.from({ length: cantidad }, (_, i) => Math.round((i + 0.5) * paso * 10) / 10);
}

/** Texto que va sobre cada captura: el segundo, y si en ese momento alguien habla en el clip. */
export function etiquetaCaptura(segundo: number, conVoz: Tramo[]): string {
  const habla = conVoz.some((t) => segundo >= t.desde && segundo <= t.hasta);
  return `${segundo.toFixed(1)} s${habla ? " · habla" : ""}`;
}
