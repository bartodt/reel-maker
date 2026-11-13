import { existsSync } from "node:fs";
import path from "node:path";
import { RITMO } from "../config.js";
import { encuadreValido, type Encuadre } from "./encuadre.js";
import { info, type InfoMedio } from "./ffmpeg.js";
import { leerJson, segundos, type Proyecto } from "./proyecto.js";

/**
 * El plan lo escribe Claude (o vos) en edit/plan.json: los tramos en el orden en que se ven.
 * - Tramo con voz: "desde" y "hasta" son segundos de la VOZ LIMPIA. Mientras dura, suena la voz en off.
 * - Tramo sin voz: dura "duracion" segundos y la voz en off espera. Sirve para el gancho, el cierre
 *   o para escuchar a alguien que habla en el clip ("audioDelClip").
 * "arrancaEn" es desde qué segundo del clip se toma la imagen.
 */
interface TramoBase {
  clip: string;
  arrancaEn: number;
  /** Hacia dónde recortar si el clip no es vertical. Por defecto "centro". */
  encuadre?: Encuadre;
  /** 1 = normal, 2 = el doble de rápido, 0.5 = cámara lenta, 0 = imagen congelada. Por defecto 1. */
  velocidad?: number;
  /** Texto grande en pantalla. Si varios tramos seguidos tienen el mismo texto, queda fijo entre todos. */
  texto?: string;
  /** Muestra el logo en el centro (para el cierre) */
  logo?: boolean;
  nota?: string;
}

export interface TramoConVoz extends TramoBase {
  desde: number;
  hasta: number;
}

export interface TramoSinVoz extends TramoBase {
  duracion: number;
  /** Se escucha el audio del clip, por ejemplo alguien hablando a cámara */
  audioDelClip?: boolean;
}

export type Tramo = TramoConVoz | TramoSinVoz;
export type Ritmo = keyof typeof RITMO;

export interface Plan {
  /** Qué tan seguido se corta. Si no está, no se revisa. */
  ritmo?: Ritmo;
  tramos: Tramo[];
}

export function esSinVoz(t: Tramo): t is TramoSinVoz {
  return (t as TramoSinVoz).duracion !== undefined;
}

export function duracionEnPantalla(t: Tramo): number {
  return esSinVoz(t) ? t.duracion : t.hasta - t.desde;
}

/** Cuánto dura un plano típico: la mitad de los tramos con voz dura menos que esto. */
export function planoTipico(tramos: Tramo[]): number {
  const duraciones = tramos.filter((t) => !esSinVoz(t)).map(duracionEnPantalla).sort((a, b) => a - b);
  if (duraciones.length === 0) return 0;
  const medio = duraciones.length >> 1;
  return duraciones.length % 2 ? duraciones[medio] : (duraciones[medio - 1] + duraciones[medio]) / 2;
}

const TOLERANCIA = 0.05;
const VELOCIDAD_MAXIMA = 8;

export async function validarPlan(p: Proyecto) {
  const errores: string[] = [];
  const avisos: string[] = [];
  const vacio = { ok: false, errores, avisos, plan: undefined as Plan | undefined, duracionVoz: 0, duracionTotal: 0 };

  if (!existsSync(p.vozLimpia)) errores.push("Falta edit/voz-limpia.wav (corré el paso 1).");
  if (!existsSync(p.plan)) errores.push("Falta edit/plan.json.");
  if (errores.length) return vacio;

  const duracionVoz = (await info(p.vozLimpia)).duracion;
  const plan = leerJson<Plan>(p.plan);
  if (!Array.isArray(plan.tramos) || plan.tramos.length === 0) {
    errores.push("El plan no tiene tramos.");
    return { ...vacio, plan, duracionVoz };
  }
  if (plan.ritmo !== undefined && !(plan.ritmo in RITMO)) {
    errores.push(`"ritmo" tiene que ser "tranquilo", "normal" o "rapido".`);
  }

  const clips = new Map<string, InfoMedio>();
  let esperado = 0;
  let tramosConVoz = 0;
  let duracionSinVoz = 0;
  let faltaLogo = false;

  for (const [i, t] of plan.tramos.entries()) {
    const n = `Tramo ${i + 1}`;
    const crudo = t as Partial<TramoConVoz & TramoSinVoz>;
    const vaConVoz = crudo.desde !== undefined || crudo.hasta !== undefined;
    const vaSinVoz = crudo.duracion !== undefined;
    if (vaConVoz === vaSinVoz) {
      errores.push(`${n}: tiene que tener "desde" y "hasta" (va con voz) o "duracion" (va sin voz), una de las dos.`);
      continue;
    }

    let dur: number;
    if (vaSinVoz) {
      dur = Number(crudo.duracion);
      if (!(dur > 0)) {
        errores.push(`${n}: "duracion" tiene que ser un número mayor que 0.`);
        continue;
      }
      duracionSinVoz += dur;
    } else {
      tramosConVoz++;
      const { desde, hasta } = crudo;
      if (typeof desde !== "number" || typeof hasta !== "number") {
        errores.push(`${n}: "desde" y "hasta" tienen que ser números.`);
        continue;
      }
      if (Math.abs(desde - esperado) > TOLERANCIA) {
        errores.push(
          `${n}: arranca en ${segundos(desde)} pero el tramo con voz anterior termina en ${segundos(esperado)}. ` +
            `Tienen que ir pegados, sin huecos ni encimados (los tramos sin voz no cuentan).`,
        );
      }
      esperado = hasta;
      dur = hasta - desde;
      if (dur <= 0) {
        errores.push(`${n}: "hasta" tiene que ser mayor que "desde".`);
        continue;
      }
    }
    if (dur < 0.4) avisos.push(`${n}: dura ${segundos(dur)} s, muy corto, puede verse como un parpadeo.`);

    if (t.encuadre !== undefined && !encuadreValido(t.encuadre)) {
      errores.push(`${n}: "encuadre" tiene que ser "izquierda", "centro", "derecha", "arriba", "abajo" o un número entre 0 y 1.`);
    }
    const velocidad = t.velocidad ?? 1;
    if (typeof velocidad !== "number" || velocidad < 0 || velocidad > VELOCIDAD_MAXIMA) {
      errores.push(`${n}: "velocidad" tiene que ser un número entre 0 (imagen congelada) y ${VELOCIDAD_MAXIMA}.`);
    }
    if (t.texto !== undefined && (typeof t.texto !== "string" || !t.texto.trim())) {
      errores.push(`${n}: "texto" no puede estar vacío.`);
    }
    if (t.logo !== undefined && typeof t.logo !== "boolean") errores.push(`${n}: "logo" tiene que ser true o false.`);
    if (t.logo && !p.logo) faltaLogo = true;
    if (crudo.audioDelClip !== undefined) {
      if (!vaSinVoz) errores.push(`${n}: "audioDelClip" solo va en tramos sin voz (los que tienen "duracion").`);
      if (typeof crudo.audioDelClip !== "boolean") errores.push(`${n}: "audioDelClip" tiene que ser true o false.`);
      if (crudo.audioDelClip && velocidad !== 1) errores.push(`${n}: con "audioDelClip" la velocidad tiene que ser 1.`);
    }

    const ruta = path.join(p.carpetaClips, t.clip);
    if (!existsSync(ruta)) {
      errores.push(`${n}: no existe el clip "${t.clip}".`);
      continue;
    }
    if (!clips.has(t.clip)) clips.set(t.clip, await info(ruta));
    const clip = clips.get(t.clip)!;
    if (t.arrancaEn < 0) errores.push(`${n}: "arrancaEn" no puede ser negativo.`);
    if (velocidad === 0) {
      if (t.arrancaEn >= clip.duracion) {
        errores.push(`${n}: la imagen congelada sale del segundo ${segundos(t.arrancaEn)}, pero "${t.clip}" dura ${segundos(clip.duracion)} s.`);
      }
    } else if (t.arrancaEn + dur * velocidad > clip.duracion + 0.01) {
      const aVelocidad = velocidad !== 1 ? ` (a velocidad ${velocidad})` : "";
      errores.push(
        `${n}: necesita ${segundos(dur * velocidad)} s de "${t.clip}" desde ${segundos(t.arrancaEn)}${aVelocidad}, ` +
          `pero el clip dura ${segundos(clip.duracion)} s.`,
      );
    }
    if (crudo.audioDelClip && !clip.tieneAudio) errores.push(`${n}: "${t.clip}" no tiene audio.`);
  }

  if (faltaLogo) errores.push(`Hay tramos con "logo" pero no encontré el logo. Poné logo.png en la carpeta del reel o en recursos/ del repo.`);

  if (tramosConVoz === 0) {
    errores.push(`El plan no tiene ningún tramo con voz (con "desde" y "hasta").`);
  } else {
    if (esperado < duracionVoz - TOLERANCIA) {
      errores.push(`El último tramo con voz termina en ${segundos(esperado)} s pero la voz dura ${segundos(duracionVoz)} s. Falta cubrir el final.`);
    }
    if (esperado > duracionVoz + 1) {
      avisos.push(`El último tramo con voz termina ${segundos(esperado - duracionVoz)} s después de la voz. Ese pedazo va a quedar sin narración.`);
    }
  }

  if (plan.ritmo && plan.ritmo in RITMO && errores.length === 0) {
    const tipico = planoTipico(plan.tramos);
    const { desde, hasta } = RITMO[plan.ritmo];
    if (tipico < desde || tipico > hasta) {
      avisos.push(
        `El ritmo es "${plan.ritmo}" (planos de ${segundos(desde)} a ${segundos(hasta)} s) pero el plano típico dura ${segundos(tipico)} s. ` +
          (tipico < desde ? "Juntá tramos o usá planos más largos." : "Partí los tramos largos en más planos."),
      );
    }
  }

  return { ok: errores.length === 0, errores, avisos, plan, duracionVoz, duracionTotal: duracionVoz + duracionSinVoz };
}
