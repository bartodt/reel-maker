import { ErrorReel } from "./errores.js";
import { esSinVoz, planoTipico, type Plan, type Tramo, type TramoConVoz } from "./plan.js";

/**
 * Un plan de referencia: lo que editó el usuario a mano, en el mismo formato que plan.json.
 * Cada tramo puede listar otros clips que muestran lo mismo ("alternativas"), y valen igual.
 */
export type TramoReferencia = Tramo & { alternativas?: string[] };
export interface Referencia extends Plan {
  tramos: TramoReferencia[];
}

export interface Diferencia {
  desde: number;
  hasta: number;
  plan: string;
  referencia: string;
}

export interface Comparacion {
  /** Parte del tiempo de voz (0 a 1) en que el plan muestra el clip de la referencia o una alternativa */
  mismoContenido: number;
  /** Parte del tiempo de voz en que usa exactamente el mismo clip */
  mismoClip: number;
  /** Parte del tiempo de voz en que usa el mismo clip y el mismo momento del clip (más o menos 1,5 s) */
  mismoMomento: number;
  planos: { plan: number; referencia: number };
  planoTipico: { plan: number; referencia: number };
  sinVoz: { plan: string[]; referencia: string[] };
  textos: { plan: number; referencia: number };
  logo: { plan: boolean; referencia: boolean };
  /** Tramos de la voz en que muestran otra cosa */
  diferencias: Diferencia[];
}

const MISMO_MOMENTO = 1.5;
const DIFERENCIA_MINIMA = 0.3;

export function comparar(plan: Plan, referencia: Referencia, paso = 0.05): Comparacion {
  const conVoz = <T extends Tramo>(tramos: T[]) => tramos.filter((t): t is T & TramoConVoz => !esSinVoz(t));
  const vozPlan = conVoz(plan.tramos);
  const vozReferencia = conVoz(referencia.tramos);
  if (vozPlan.length === 0 || vozReferencia.length === 0) {
    throw new ErrorReel("El plan y la referencia tienen que tener al menos un tramo con voz.");
  }
  const duracion = vozReferencia.at(-1)!.hasta;

  const enMomento = <T extends TramoConVoz>(tramos: T[], s: number) => {
    const t = tramos.find((x) => s >= x.desde && s < x.hasta) ?? tramos.at(-1)!;
    return { tramo: t, tiempo: t.arrancaEn + (s - t.desde) * (t.velocidad ?? 1) };
  };

  let muestras = 0;
  let contenido = 0;
  let clip = 0;
  let momento = 0;
  const diferencias: Diferencia[] = [];
  for (let s = 0; s < duracion; s += paso) {
    muestras++;
    const a = enMomento(vozPlan, s);
    const b = enMomento(vozReferencia, s);
    const aceptados = [b.tramo.clip, ...(b.tramo.alternativas ?? [])];
    if (aceptados.includes(a.tramo.clip)) {
      contenido++;
    } else {
      const ultima = diferencias.at(-1);
      const referenciaTexto = aceptados.join(" o ");
      if (ultima && ultima.plan === a.tramo.clip && ultima.referencia === referenciaTexto && s - ultima.hasta < paso * 1.5) {
        ultima.hasta = s + paso;
      } else {
        diferencias.push({ desde: s, hasta: s + paso, plan: a.tramo.clip, referencia: referenciaTexto });
      }
    }
    if (a.tramo.clip === b.tramo.clip) {
      clip++;
      if (Math.abs(a.tiempo - b.tiempo) < MISMO_MOMENTO) momento++;
    }
  }

  const total = Math.max(1, muestras);
  return {
    mismoContenido: contenido / total,
    mismoClip: clip / total,
    mismoMomento: momento / total,
    planos: { plan: vozPlan.length, referencia: vozReferencia.length },
    planoTipico: { plan: planoTipico(plan.tramos), referencia: planoTipico(referencia.tramos) },
    sinVoz: { plan: describirSinVoz(plan.tramos), referencia: describirSinVoz(referencia.tramos) },
    textos: { plan: contarTextos(plan.tramos), referencia: contarTextos(referencia.tramos) },
    logo: { plan: plan.tramos.some((t) => t.logo), referencia: referencia.tramos.some((t) => t.logo) },
    diferencias: diferencias.filter((d) => d.hasta - d.desde >= DIFERENCIA_MINIMA),
  };
}

/** "al principio: 1.0 s de IMG_0672", "en el segundo 2.7 de la voz: 1.8 s de IMG_0638 con su audio", ... */
export function describirSinVoz(tramos: Tramo[]): string[] {
  const ultimaVoz = tramos.filter((t) => !esSinVoz(t)).at(-1) as TramoConVoz | undefined;
  let posicion = 0;
  const r: string[] = [];
  for (const t of tramos) {
    if (!esSinVoz(t)) {
      posicion = t.hasta;
      continue;
    }
    const donde = posicion === 0 ? "al principio" : ultimaVoz && posicion >= ultimaVoz.hasta ? "al final" : `en el segundo ${posicion.toFixed(1)} de la voz`;
    r.push(`${donde}: ${t.duracion.toFixed(1)} s de ${t.clip}${t.audioDelClip ? " con su audio" : ""}`);
  }
  return r;
}

/** Cuántos textos grandes distintos aparecen (los tramos seguidos con el mismo texto cuentan una vez) */
function contarTextos(tramos: Tramo[]): number {
  return tramos.filter((t, i) => t.texto && t.texto !== tramos[i - 1]?.texto).length;
}
