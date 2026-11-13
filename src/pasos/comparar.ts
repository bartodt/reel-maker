// Para probar la herramienta: compara edit/plan.json con un plan de referencia (lo que editó el usuario a mano).
import { existsSync } from "node:fs";
import path from "node:path";
import { comparar as compararPlanes, type Referencia } from "../lib/comparar.js";
import { ErrorReel } from "../lib/errores.js";
import type { Plan } from "../lib/plan.js";
import { leerJson, segundos, type Proyecto } from "../lib/proyecto.js";

export async function comparar(p: Proyecto, archivoReferencia: string | undefined, log = console.log) {
  if (!archivoReferencia) {
    throw new ErrorReel("Falta el plan de referencia. Ejemplo: npm run comparar -- <carpeta> referencias/pancho-y-coca/plan-real.json");
  }
  const rutaReferencia = path.resolve(archivoReferencia);
  if (!existsSync(rutaReferencia)) throw new ErrorReel(`No existe el plan de referencia: ${rutaReferencia}`);
  if (!existsSync(p.plan)) throw new ErrorReel("Falta edit/plan.json.");

  const c = compararPlanes(leerJson<Plan>(p.plan), leerJson<Referencia>(rutaReferencia));
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const fila = (nombre: string, plan: string, referencia: string) => `  ${nombre.padEnd(24)}${plan.padEnd(12)}${referencia}`;

  log(`Comparación con ${path.basename(path.dirname(rutaReferencia))}/${path.basename(rutaReferencia)}`);
  log("");
  log(`Sobre el tiempo de voz, el plan muestra:`);
  log(`  lo mismo que la referencia (o una alternativa): ${pct(c.mismoContenido)}`);
  log(`  exactamente el mismo clip:                      ${pct(c.mismoClip)}`);
  log(`  el mismo clip y el mismo momento del clip:      ${pct(c.mismoMomento)}`);
  log("");
  log(fila("", "Plan", "Referencia"));
  log(fila("Tramos con voz", String(c.planos.plan), String(c.planos.referencia)));
  log(fila("Plano típico", `${segundos(c.planoTipico.plan)} s`, `${segundos(c.planoTipico.referencia)} s`));
  log(fila("Textos grandes", String(c.textos.plan), String(c.textos.referencia)));
  log(fila("Logo", c.logo.plan ? "sí" : "no", c.logo.referencia ? "sí" : "no"));
  log("");
  log("Tramos sin voz:");
  log(`  plan:       ${c.sinVoz.plan.join(" · ") || "ninguno"}`);
  log(`  referencia: ${c.sinVoz.referencia.join(" · ") || "ninguno"}`);
  if (c.diferencias.length) {
    log("");
    log("Donde muestran otra cosa (segundos de la voz):");
    for (const d of c.diferencias) log(`  ${segundos(d.desde)} - ${segundos(d.hasta)}  plan: ${d.plan}  referencia: ${d.referencia}`);
  }
  return c;
}
