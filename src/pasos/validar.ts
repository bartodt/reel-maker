// Paso 4: revisa que edit/plan.json esté bien armado antes de renderizar.
import { ErrorReel } from "../lib/errores.js";
import { esSinVoz, planoTipico, validarPlan } from "../lib/plan.js";
import { segundos, type Proyecto } from "../lib/proyecto.js";

export async function validar(p: Proyecto, log = console.log) {
  const r = await validarPlan(p);
  for (const a of r.avisos) console.warn(`Aviso: ${a}`);
  if (!r.ok) throw new ErrorReel(r.errores.map((e) => `Error: ${e}`).join("\n"));

  const { tramos, ritmo } = r.plan!;
  log(
    `Plan OK: ${tramos.length} tramos, ${segundos(r.duracionTotal)} s de reel (${segundos(r.duracionVoz)} s de voz). ` +
      `Plano típico: ${segundos(planoTipico(tramos))} s${ritmo ? `, ritmo ${ritmo}` : ""}.`,
  );
  for (const [i, t] of tramos.entries()) {
    const cuando = esSinVoz(t) ? `sin voz, ${segundos(t.duracion)} s` : `${segundos(t.desde)} - ${segundos(t.hasta)}`;
    const velocidad = t.velocidad ?? 1;
    const extra = [
      t.encuadre !== undefined ? `encuadre: ${t.encuadre}` : "",
      velocidad === 0 ? "congelado" : velocidad !== 1 ? `velocidad ${velocidad}` : "",
      esSinVoz(t) && t.audioDelClip ? "con el audio del clip" : "",
      t.texto ? `texto: "${t.texto.replace(/\s*\n\s*/g, " / ")}"` : "",
      t.logo ? "logo" : "",
      t.nota ?? "",
    ]
      .filter(Boolean)
      .join(" | ");
    log(`  ${i + 1}. [${cuando}] ${t.clip} desde ${segundos(t.arrancaEn)}${extra ? `  (${extra})` : ""}`);
  }
  return r;
}
