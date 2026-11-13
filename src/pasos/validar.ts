// Paso 4: revisa que edit/plan.json esté bien armado antes de renderizar.
import { ErrorReel } from "../lib/errores.js";
import { validarPlan } from "../lib/plan.js";
import { segundos, type Proyecto } from "../lib/proyecto.js";

export async function validar(p: Proyecto, log = console.log) {
  const r = await validarPlan(p);
  for (const a of r.avisos) console.warn(`Aviso: ${a}`);
  if (!r.ok) throw new ErrorReel(r.errores.map((e) => `Error: ${e}`).join("\n"));

  log(`Plan OK: ${r.plan!.tramos.length} tramos, ${segundos(r.duracionVoz)} s de reel.`);
  for (const [i, t] of r.plan!.tramos.entries()) {
    const extra = [t.encuadre !== undefined ? `encuadre: ${t.encuadre}` : "", t.nota ?? ""].filter(Boolean).join(" | ");
    log(`  ${i + 1}. [${segundos(t.desde)} - ${segundos(t.hasta)}] ${t.clip} desde ${segundos(t.arrancaEn)}${extra ? `  (${extra})` : ""}`);
  }
  return r;
}
