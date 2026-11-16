// Para probar la herramienta: compara los planes de una corrida con todas las referencias de referencias/referencias.json.
import { existsSync } from "node:fs";
import path from "node:path";
import { comparar, type Referencia } from "../lib/comparar.js";
import { expandirCasa } from "../lib/entorno.js";
import { ErrorReel } from "../lib/errores.js";
import type { Plan } from "../lib/plan.js";
import { guardarJson, leerJson } from "../lib/proyecto.js";
import { leerReferencias, type FichaReferencia } from "../lib/referencias.js";

const TITULOS = {
  mismoContenido: "Mismo contenido",
  mismoClip: "Mismo clip",
  mismoMomento: "Mismo momento",
  cortes: "Cortes",
} as const;
type Columna = keyof typeof TITULOS;
type Medida = Record<Columna, number>;
type FilaMedida = { referencia: string } & Medida;
type Fila = FilaMedida | { referencia: string; sinPlan: true };
const COLUMNAS = Object.keys(TITULOS) as Columna[];

export async function medir(carpeta: string | undefined, log = console.log, fichas = leerReferencias()) {
  if (!carpeta) throw new ErrorReel("Falta la carpeta de la corrida. Ejemplo: npm run medir -- ~/reels/_verificacion/m2/corrida");
  const corrida = expandirCasa(carpeta);
  if (!existsSync(corrida)) throw new ErrorReel(`No existe la carpeta: ${corrida}`);

  const filas: Fila[] = fichas.map((f) => {
    const ruta = path.join(corrida, f.nombre, "edit", "plan.json");
    return existsSync(ruta) ? { referencia: f.nombre, ...medirUna(f, ruta) } : { referencia: f.nombre, sinPlan: true };
  });
  const medidas = filas.filter((f): f is FilaMedida => !("sinPlan" in f));
  if (medidas.length === 0) {
    const nombres = fichas.map((f) => f.nombre).join(", ");
    throw new ErrorReel(`No hay ningún plan en ${corrida}. Cada uno va en <referencia>/edit/plan.json, y las referencias son: ${nombres}.`);
  }
  const promedio = redondear(Object.fromEntries(COLUMNAS.map((k) => [k, medidas.reduce((s, m) => s + m[k], 0) / medidas.length])) as Medida);
  const archivo = path.join(corrida, "medicion.json");
  guardarJson(archivo, { referencias: filas, promedio: { ...promedio, referenciasMedidas: medidas.length } });

  const nombrePromedio = `Promedio (${medidas.length} de ${filas.length})`;
  const ancho = Math.max(nombrePromedio.length, ...filas.map((f) => f.referencia.length)) + 2;
  const fila = (nombre: string, celdas: string[]) =>
    `  ${nombre.padEnd(ancho)}${celdas.map((c, i) => c.padStart(TITULOS[COLUMNAS[i]].length + 3)).join("")}`;
  const porcentajes = (m: Medida) => COLUMNAS.map((k) => `${Math.round(m[k] * 100)}%`);

  log(`Medición de ${corrida}`);
  log("");
  log(fila("", Object.values(TITULOS)));
  for (const f of filas) log(fila(f.referencia, "sinPlan" in f ? ["sin plan"] : porcentajes(f)));
  log(fila(nombrePromedio, porcentajes(promedio)));
  log("");
  log(`Guardado en ${archivo}`);
  return { filas, promedio };
}

function medirUna(f: FichaReferencia, ruta: string): Medida {
  const referencia = leerJson<Referencia>(f.archivoPlan);
  let plan: Plan;
  try {
    plan = leerJson<Plan>(ruta);
  } catch {
    throw new ErrorReel(`${f.nombre}: el plan no es un JSON válido (${ruta}).`);
  }
  if (!Array.isArray(plan?.tramos)) throw new ErrorReel(`${f.nombre}: el plan no tiene "tramos" (${ruta}).`);
  try {
    return redondear(comparar(plan, referencia));
  } catch (e) {
    if (e instanceof ErrorReel) throw new ErrorReel(`${f.nombre}: ${e.message}`);
    throw e;
  }
}

function redondear(m: Medida): Medida {
  return Object.fromEntries(COLUMNAS.map((k) => [k, Math.round(m[k] * 1000) / 1000])) as Medida;
}
