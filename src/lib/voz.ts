export interface Tramo {
  desde: number;
  hasta: number;
}

export interface OpcionesCorte {
  /** Margen que se deja antes y después de cada frase (segundos) */
  margen: number;
  /** Pausas más cortas que esto no se cortan (segundos) */
  pausaMinimaParaCortar: number;
}

/**
 * Recibe los tramos donde el detector encontró voz y devuelve los tramos a conservar:
 * con margen agregado, sin pasarse del audio, y uniendo los que tienen pausas cortas en el medio.
 */
export function tramosAConservar(conVoz: Tramo[], duracion: number, o: OpcionesCorte): Tramo[] {
  const ordenados = [...conVoz].sort((a, b) => a.desde - b.desde);
  const resultado: Tramo[] = [];
  for (const t of ordenados) {
    const desde = Math.max(0, t.desde - o.margen);
    const hasta = Math.min(duracion, t.hasta + o.margen);
    if (hasta <= desde) continue;
    const anterior = resultado.at(-1);
    if (anterior && desde - anterior.hasta < o.pausaMinimaParaCortar) {
      anterior.hasta = Math.max(anterior.hasta, hasta);
    } else {
      resultado.push({ desde, hasta });
    }
  }
  return resultado;
}
