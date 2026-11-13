// Cambios chicos al plan que se hacen desde la app: cambiar un plano, mover un corte, partir o sacar un plano.
// Cada función devuelve un plan nuevo; el original no se toca.
import { encuadreValido, type Encuadre } from "./encuadre.js";
import { ErrorReel } from "./errores.js";
import { esSinVoz, type Plan, type Tramo, type TramoConVoz, type TramoSinVoz } from "./plan.js";

/** Lo que se puede cambiar de un tramo. null (o texto vacío) saca el campo. */
export interface Cambios {
  clip?: string;
  arrancaEn?: number;
  duracion?: number;
  encuadre?: Encuadre | null;
  velocidad?: number | null;
  texto?: string | null;
  logo?: boolean | null;
  audioDelClip?: boolean | null;
}

export type Edicion =
  | { op: "cambiar"; indice: number; cambios: Cambios }
  | { op: "corte"; indice: number; segundo: number }
  | { op: "partir"; indice: number; segundo: number }
  | { op: "quitar"; indice: number };

// Un plano no puede quedar más corto que esto al mover un corte o partirlo (segundos)
const MINIMO = 0.1;
const redondear = (n: number) => Math.round(n * 100) / 100;

function buscar(plan: Plan, i: number): Tramo {
  const t = plan.tramos[i];
  if (!t) throw new ErrorReel("Ese plano ya no existe. Recargá la página.");
  return t;
}

function siguienteConVoz(plan: Plan, i: number): TramoConVoz | undefined {
  return plan.tramos.slice(i + 1).find((t): t is TramoConVoz => !esSinVoz(t));
}

export function cambiarTramo(plan: Plan, i: number, cambios: Cambios): Plan {
  const nuevo = structuredClone(plan);
  const t = buscar(nuevo, i) as Partial<TramoConVoz & TramoSinVoz> & Tramo;
  const sinVoz = esSinVoz(t);

  if (cambios.clip !== undefined) t.clip = cambios.clip;
  if (cambios.arrancaEn !== undefined) t.arrancaEn = redondear(Math.max(0, cambios.arrancaEn));
  if (cambios.duracion !== undefined) {
    if (!sinVoz) throw new ErrorReel("Lo que dura un plano con voz lo marca la voz: mové el corte.");
    if (!(cambios.duracion > 0)) throw new ErrorReel("La duración tiene que ser mayor que 0.");
    t.duracion = redondear(cambios.duracion);
  }
  for (const campo of ["encuadre", "velocidad", "texto", "logo", "audioDelClip"] as const) {
    const valor = cambios[campo];
    if (valor === undefined) continue;
    const sacar =
      valor === null ||
      valor === false ||
      (typeof valor === "string" && !valor.trim()) ||
      (campo === "velocidad" && valor === 1) ||
      (campo === "encuadre" && valor === "centro");
    if (sacar) delete t[campo];
    else Object.assign(t, { [campo]: valor });
  }
  if (t.audioDelClip) {
    if (!sinVoz) throw new ErrorReel("El audio del video solo se puede usar en planos sin voz en off.");
    // Para escuchar a alguien hablando, el video tiene que ir a velocidad normal
    delete t.velocidad;
  }
  return nuevo;
}

/** Mueve el corte entre un tramo con voz y el siguiente con voz. `segundo` es sobre la voz limpia. */
export function moverCorte(plan: Plan, i: number, segundo: number): Plan {
  const nuevo = structuredClone(plan);
  const t = buscar(nuevo, i);
  if (esSinVoz(t)) throw new ErrorReel("Este plano no tiene voz: cambiale la duración.");
  const siguiente = siguienteConVoz(nuevo, i);
  if (!siguiente) throw new ErrorReel("El último plano con voz termina cuando termina la voz.");
  if (segundo < t.desde + MINIMO || segundo > siguiente.hasta - MINIMO) {
    throw new ErrorReel("Con ese corte uno de los planos se queda sin nada.");
  }
  t.hasta = siguiente.desde = redondear(segundo);
  return nuevo;
}

/** Parte un tramo en dos. Con voz, `segundo` es sobre la voz limpia; sin voz, es desde que empieza el tramo. */
export function partirTramo(plan: Plan, i: number, segundo: number): Plan {
  const nuevo = structuredClone(plan);
  const t = buscar(nuevo, i);
  const velocidad = t.velocidad ?? 1;
  const segundaParte: Tramo = structuredClone(t);
  delete segundaParte.nota;

  if (esSinVoz(t)) {
    if (segundo < MINIMO || segundo > t.duracion - MINIMO) throw new ErrorReel("Elegí un momento más adentro del plano.");
    const corte = redondear(segundo);
    (segundaParte as TramoSinVoz).duracion = redondear(t.duracion - corte);
    segundaParte.arrancaEn = redondear(t.arrancaEn + corte * velocidad);
    t.duracion = corte;
  } else {
    if (segundo < t.desde + MINIMO || segundo > t.hasta - MINIMO) throw new ErrorReel("Elegí un momento más adentro del plano.");
    const corte = redondear(segundo);
    (segundaParte as TramoConVoz).desde = corte;
    segundaParte.arrancaEn = redondear(t.arrancaEn + (corte - t.desde) * velocidad);
    t.hasta = corte;
  }
  nuevo.tramos.splice(i + 1, 0, segundaParte);
  return nuevo;
}

/**
 * Saca un tramo. Si no tiene voz, simplemente desaparece.
 * Si tiene voz, ese pedazo de la voz pasa al plano con voz de al lado (el de antes, o si no el de después).
 */
export function quitarTramo(plan: Plan, i: number): Plan {
  const nuevo = structuredClone(plan);
  const t = buscar(nuevo, i);
  if (!esSinVoz(t)) {
    const antes = nuevo.tramos[i - 1];
    const despues = nuevo.tramos[i + 1];
    if (antes && !esSinVoz(antes)) antes.hasta = t.hasta;
    else if (despues && !esSinVoz(despues)) despues.desde = t.desde;
    else throw new ErrorReel("Este es el único plano para esa parte de la voz: cambiale el video en vez de sacarlo.");
  }
  nuevo.tramos.splice(i, 1);
  return nuevo;
}

const numero = (v: unknown, nombre: string) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ErrorReel(`Falta ${nombre}.`);
  return v;
};

/** Revisa lo que mandó la app (puede venir cualquier cosa) y aplica la edición. */
export function aplicarEdicion(plan: Plan, pedido: unknown): Plan {
  const e = (pedido ?? {}) as Record<string, unknown>;
  const indice = numero(e.indice, "el número de plano");
  switch (e.op) {
    case "cambiar":
      return cambiarTramo(plan, indice, leerCambios(e.cambios));
    case "corte":
      return moverCorte(plan, indice, numero(e.segundo, "el segundo del corte"));
    case "partir":
      return partirTramo(plan, indice, numero(e.segundo, "el segundo donde partir"));
    case "quitar":
      return quitarTramo(plan, indice);
    default:
      throw new ErrorReel("No entendí qué cambio hacer.");
  }
}

function leerCambios(crudo: unknown): Cambios {
  const c = (crudo ?? {}) as Record<string, unknown>;
  const cambios: Cambios = {};
  const opcional = <T>(v: unknown, ok: (v: unknown) => boolean, mensaje: string): T | null | undefined => {
    if (v === undefined || v === null) return v as null | undefined;
    if (!ok(v)) throw new ErrorReel(mensaje);
    return v as T;
  };
  const esNumero = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (c.clip !== undefined) {
    if (typeof c.clip !== "string" || !c.clip) throw new ErrorReel("Elegí un video.");
    cambios.clip = c.clip;
  }
  if (c.arrancaEn !== undefined) cambios.arrancaEn = numero(c.arrancaEn, "desde qué segundo del video");
  if (c.duracion !== undefined) cambios.duracion = numero(c.duracion, "la duración");
  cambios.encuadre = opcional<Encuadre>(c.encuadre, encuadreValido, "Ese encuadre no existe.");
  cambios.velocidad = opcional<number>(c.velocidad, (v) => esNumero(v) && (v as number) >= 0, "Esa velocidad no sirve.");
  cambios.texto = opcional<string>(c.texto, (v) => typeof v === "string", "El texto tiene que ser texto.");
  cambios.logo = opcional<boolean>(c.logo, (v) => typeof v === "boolean", "El logo va o no va.");
  cambios.audioDelClip = opcional<boolean>(c.audioDelClip, (v) => typeof v === "boolean", "El audio del video va o no va.");
  return cambios;
}
