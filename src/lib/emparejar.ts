// Reconstruye una edición ya publicada: qué clip y qué momento se ve en cada plano, y a qué velocidad.
// Lógica pura: recibe los cuadros chicos en gris que ya leyó ffmpeg.
import type { Referencia, TramoReferencia } from "./comparar.js";
import type { Tramo as TramoVoz } from "./voz.js";

/** Un cuadro chico en gris con media 0 y largo 1: multiplicar dos firmas da su parecido, de -1 a 1. */
export type Firma = Float32Array;

export interface ClipLeido {
  clip: string;
  /** Una firma cada 1/fps segundos, desde el segundo 0 */
  firmas: Firma[];
}

/** Dónde se miran los cuadros de cada plano publicado, como parte de su duración. */
export const PARTES_DEL_PLANO = {
  /** Eligen el clip, el momento y la velocidad */
  ajuste: [0.25, 0.5, 0.75],
  /** Revisan que la velocidad sea pareja en todo el plano */
  puntas: [0.05, 0.95],
} as const;

export interface PlanoPublicado {
  duracion: number;
  ajuste: [Firma, Firma, Firma];
  puntas: [Firma, Firma];
}

export interface Emparejado {
  clip: string;
  /** Segundo del clip donde arranca el plano */
  arrancaEn: number;
  /** Segundo del clip que se ve en la mitad del plano */
  medio: number;
  velocidad: number;
  parecido: number;
  /** Parecido de las puntas del plano con el clip, a esa velocidad. Bajo si la velocidad cambia adentro del plano. */
  puntas: [number, number];
  /** Parecido bajo o puntas que no siguen la velocidad: hay que mirarlo a mano */
  revisar: boolean;
  /** El mejor de los otros clips */
  segundo?: { clip: string; parecido: number };
  /** Otros clips que se parecen casi igual: muestran lo mismo */
  alternativas: string[];
}

export interface PlanoReconstruido extends Emparejado {
  /** Segundos del publicado */
  desde: number;
  hasta: number;
}

// Velocidades que se prueban: congelado y de 0,25x a 8x, de a 0,05
const VELOCIDADES = [0, ...Array.from({ length: Math.round((8 - 0.25) / 0.05) + 1 }, (_, i) => Math.round((0.25 + i * 0.05) * 100) / 100)];
// Si la velocidad normal da casi el mismo parecido que la mejor, queda la normal (en una escena quieta todas dan igual)
const EMPATE_VELOCIDAD = 0.01;
// Un clip cuyo mejor cuadro se parece a la mitad del plano casi tanto como el del elegido muestra lo mismo, aunque
// sea otra toma. En Casa Giro, las otras tomas de la cocina y del frente quedaron a 0,03 y 0,09 del elegido, y el
// resto de los clips a 0,2 o más.
const EMPATE_CLIP = 0.1;
// Debajo de esto, el plano o sus puntas no coinciden bien con el clip. En Casa Giro y Pancho y Coca, los planos que
// coinciden en todo su largo dan 0,84 o más, y el que cambia de velocidad adentro da -0,34 al principio.
const DUDOSO = 0.8;

export function firma(gris: Uint8Array): Firma {
  let media = 0;
  for (const v of gris) media += v;
  media /= gris.length;
  const f = new Float32Array(gris.length);
  let largo = 0;
  for (let i = 0; i < gris.length; i++) {
    f[i] = gris[i] - media;
    largo += f[i] * f[i];
  }
  largo = Math.sqrt(largo) || 1;
  for (let i = 0; i < f.length; i++) f[i] /= largo;
  return f;
}

function parecido(a: Firma, b: Firma): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Parte el publicado en planos. Dos cortes muy juntos (una transición de un par de cuadros) cuentan como uno. */
export function planosDeCortes(cortes: number[], duracion: number, minimo = 0.2): { desde: number; hasta: number }[] {
  const bordes = [0];
  for (const c of [...cortes].sort((a, b) => a - b)) {
    if (c - bordes.at(-1)! >= minimo && duracion - c >= minimo) bordes.push(c);
  }
  bordes.push(duracion);
  return bordes.slice(1).map((hasta, i) => ({ desde: bordes[i], hasta }));
}

/** El clip, el momento y la velocidad que mejor explican el plano, con el clip que le sigue y las alternativas. */
export function emparejar(plano: PlanoPublicado, clips: ClipLeido[], fps: number): Emparejado {
  const candidatos = clips
    .map((c) => ({ clip: c.clip, firmas: c.firmas, ...mejorAjuste(plano, c.firmas, fps) }))
    .sort((a, b) => b.parecido - a.parecido || a.clip.localeCompare(b.clip));
  const [mejor, segundo] = candidatos;
  const medio = mejor.indice / fps;
  const enElClip = (parte: number) => {
    const i = Math.round((medio + (parte - 0.5) * plano.duracion * mejor.velocidad) * fps);
    return mejor.firmas[Math.min(mejor.firmas.length - 1, Math.max(0, i))];
  };
  const puntas = PARTES_DEL_PLANO.puntas.map((parte, i) => parecido(plano.puntas[i], enElClip(parte))) as [number, number];
  return {
    clip: mejor.clip,
    arrancaEn: Math.max(0, medio - (plano.duracion / 2) * mejor.velocidad),
    medio,
    velocidad: mejor.velocidad,
    parecido: mejor.parecido,
    puntas,
    revisar: Math.min(mejor.parecido, ...puntas) < DUDOSO,
    segundo: segundo && { clip: segundo.clip, parecido: segundo.parecido },
    alternativas: candidatos.slice(1).filter((c) => mejor.delMedio - c.delMedio <= EMPATE_CLIP).map((c) => c.clip),
  };
}

/**
 * Busca la recta "segundo del clip = medio + velocidad × segundos desde la mitad del plano" que mejor pasa por los
 * cuadros de ajuste del plano.
 */
function mejorAjuste(plano: PlanoPublicado, firmas: Firma[], fps: number) {
  const curvas = plano.ajuste.map((f) => firmas.map((g) => parecido(f, g)));
  const interpolado = (curva: number[], x: number) => {
    const i = Math.floor(x);
    return i + 1 < curva.length ? curva[i] + (curva[i + 1] - curva[i]) * (x - i) : curva[i];
  };
  const [antes, mitad] = PARTES_DEL_PLANO.ajuste;
  const porVelocidad = new Map<number, { parecido: number; indice: number }>();
  for (const velocidad of VELOCIDADES) {
    const salto = (mitad - antes) * plano.duracion * velocidad * fps;
    let mejor = { parecido: -Infinity, indice: 0 };
    for (let j = Math.ceil(salto); j + salto <= firmas.length - 1; j++) {
      const p = (interpolado(curvas[0], j - salto) + curvas[1][j] + interpolado(curvas[2], j + salto)) / 3;
      if (p > mejor.parecido) mejor = { parecido: p, indice: j };
    }
    if (mejor.parecido > -Infinity) porVelocidad.set(velocidad, mejor);
  }
  let elegida = 0;
  for (const [v, r] of porVelocidad) if (r.parecido > porVelocidad.get(elegida)!.parecido) elegida = v;
  const normal = porVelocidad.get(1);
  if (normal && normal.parecido >= porVelocidad.get(elegida)!.parecido - EMPATE_VELOCIDAD) elegida = 1;
  return { velocidad: elegida, ...porVelocidad.get(elegida)!, delMedio: Math.max(...curvas[1]) };
}

/** Pasa un segundo de la voz original al de la voz limpia: se descuenta lo que limpiar sacó antes de ese segundo. */
export function aVozLimpia(segundo: number, conservados: TramoVoz[]): number {
  let limpio = 0;
  for (const t of conservados) {
    if (segundo <= t.desde) break;
    limpio += Math.min(segundo, t.hasta) - t.desde;
  }
  return limpio;
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Un plan con los planos reconstruidos, cuando la voz del reel es el audio del publicado.
 * Lo que cae en silencios que limpiar sacó se pierde; un plano entero en un silencio queda como tramo sin voz.
 */
export function planDesdePublicado(planos: PlanoReconstruido[], conservados: TramoVoz[]): Referencia {
  const tramos = planos.map((p): TramoReferencia => {
    const desde = aVozLimpia(p.desde, conservados);
    const hasta = aVozLimpia(p.hasta, conservados);
    const extra = {
      ...(p.velocidad !== 1 && { velocidad: p.velocidad }),
      ...(p.alternativas.length > 0 && { alternativas: p.alternativas }),
    };
    if (hasta - desde < 0.05) return { duracion: redondear(p.hasta - p.desde), clip: p.clip, arrancaEn: redondear(p.arrancaEn), ...extra };
    const tramo = conservados.find((t) => t.hasta > p.desde);
    const seVeDesde = tramo ? Math.max(p.desde, tramo.desde) : p.desde;
    const arrancaEn = p.arrancaEn + (seVeDesde - p.desde) * p.velocidad;
    return { desde: redondear(desde), hasta: redondear(hasta), clip: p.clip, arrancaEn: redondear(arrancaEn), ...extra };
  });
  return { tramos };
}
