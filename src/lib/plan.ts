import { existsSync } from "node:fs";
import path from "node:path";
import { encuadreValido, type Encuadre } from "./encuadre.js";
import { info } from "./ffmpeg.js";
import { leerJson, segundos, type Proyecto } from "./proyecto.js";

/**
 * El plan lo escribe Claude (o vos) en edit/plan.json.
 * Los tiempos "desde" y "hasta" son sobre la VOZ LIMPIA (no sobre el clip).
 * "arrancaEn" es desde qué segundo del clip se toma la imagen.
 */
export interface Tramo {
  desde: number;
  hasta: number;
  clip: string;
  arrancaEn: number;
  /** Hacia dónde recortar si el clip no es vertical. Por defecto "centro". */
  encuadre?: Encuadre;
  nota?: string;
}

export interface Plan {
  tramos: Tramo[];
}

const TOLERANCIA = 0.05;

export async function validarPlan(p: Proyecto) {
  const errores: string[] = [];
  const avisos: string[] = [];

  if (!existsSync(p.vozLimpia)) errores.push("Falta edit/voz-limpia.wav (corré el paso 1).");
  if (!existsSync(p.plan)) errores.push("Falta edit/plan.json.");
  if (errores.length) return { ok: false, errores, avisos, plan: undefined, duracionVoz: 0 };

  const duracionVoz = (await info(p.vozLimpia)).duracion;
  const plan = leerJson<Plan>(p.plan);
  if (!Array.isArray(plan.tramos) || plan.tramos.length === 0) {
    errores.push("El plan no tiene tramos.");
    return { ok: false, errores, avisos, plan, duracionVoz };
  }

  const duraciones = new Map<string, number>();
  let esperado = 0;

  for (const [i, t] of plan.tramos.entries()) {
    const n = `Tramo ${i + 1}`;
    if (Math.abs(t.desde - esperado) > TOLERANCIA) {
      errores.push(`${n}: arranca en ${segundos(t.desde)} pero el anterior termina en ${segundos(esperado)}. Tienen que ir pegados, sin huecos ni encimados.`);
    }
    const dur = t.hasta - t.desde;
    if (dur <= 0) errores.push(`${n}: "hasta" tiene que ser mayor que "desde".`);
    else if (dur < 0.4) avisos.push(`${n}: dura ${segundos(dur)} s, muy corto, puede verse como un parpadeo.`);

    if (t.encuadre !== undefined && !encuadreValido(t.encuadre)) {
      errores.push(`${n}: "encuadre" tiene que ser "izquierda", "centro", "derecha", "arriba", "abajo" o un número entre 0 y 1.`);
    }

    const ruta = path.join(p.carpetaClips, t.clip);
    if (!existsSync(ruta)) {
      errores.push(`${n}: no existe el clip "${t.clip}".`);
    } else {
      if (!duraciones.has(t.clip)) duraciones.set(t.clip, (await info(ruta)).duracion);
      const durClip = duraciones.get(t.clip)!;
      if (t.arrancaEn < 0) errores.push(`${n}: "arrancaEn" no puede ser negativo.`);
      if (t.arrancaEn + dur > durClip + 0.01) {
        errores.push(`${n}: necesita ${segundos(dur)} s de "${t.clip}" desde ${segundos(t.arrancaEn)}, pero el clip dura ${segundos(durClip)} s.`);
      }
    }
    esperado = t.hasta;
  }

  const ultimo = plan.tramos.at(-1)!.hasta;
  if (ultimo < duracionVoz - TOLERANCIA) {
    errores.push(`El plan termina en ${segundos(ultimo)} s pero la voz dura ${segundos(duracionVoz)} s. Falta cubrir el final.`);
  }
  if (ultimo > duracionVoz + 1) {
    avisos.push(`El plan dura ${segundos(ultimo - duracionVoz)} s más que la voz. Ese final va a quedar sin narración.`);
  }

  return { ok: errores.length === 0, errores, avisos, plan, duracionVoz };
}
