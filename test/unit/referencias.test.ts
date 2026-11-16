import assert from "node:assert/strict";
import { linkSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Referencia } from "../../src/lib/comparar.js";
import { RAIZ_REPO } from "../../src/lib/entorno.js";
import { ffmpeg } from "../../src/lib/ffmpeg.js";
import { duracionEnPantalla, validarPlan } from "../../src/lib/plan.js";
import { abrirProyecto, leerJson } from "../../src/lib/proyecto.js";
import { escribirPlan } from "../lib/fixtures.js";

// Un solo clip de relleno, tan largo como el que más pide el plan: el test revisa los campos, no los crudos
async function proyectoALaMedida(plan: Referencia) {
  const raiz = mkdtempSync(path.join(tmpdir(), "reel-referencia-"));
  mkdirSync(path.join(raiz, "clips"));
  mkdirSync(path.join(raiz, "edit"));
  const necesario = Math.max(...plan.tramos.map((t) => t.arrancaEn + Math.max(0.1, duracionEnPantalla(t) * (t.velocidad ?? 1))));
  const relleno = path.join(raiz, "relleno.mov");
  await ffmpeg(["-f", "lavfi", "-i", "color=c=gray:s=16x16:r=1", "-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", String(necesario + 1), "-c:a", "pcm_s16le", relleno]);
  for (const clip of new Set(plan.tramos.map((t) => t.clip))) linkSync(relleno, path.join(raiz, "clips", clip));
  const voz = Math.max(...plan.tramos.map((t) => ("hasta" in t ? t.hasta : 0)));
  await ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", String(voz), path.join(raiz, "edit", "voz-limpia.wav")]);
  await ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=30x15", "-frames:v", "1", path.join(raiz, "logo.png")]);
  return abrirProyecto(raiz);
}

for (const referencia of ["casa-giro", "pancho-y-coca"]) {
  test(`el plan real de ${referencia} está bien armado`, async (t) => {
    const plan = leerJson<Referencia>(path.join(RAIZ_REPO, "referencias", referencia, "plan-real.json"));
    const p = await proyectoALaMedida(plan);
    t.after(() => rmSync(p.raiz, { recursive: true, force: true }));
    escribirPlan(p.raiz, plan);
    assert.deepEqual((await validarPlan(p)).errores, []);
  });
}
