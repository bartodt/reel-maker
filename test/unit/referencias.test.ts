import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { comparar, cortesEnLaVoz, type Referencia } from "../../src/lib/comparar.js";
import { ErrorReel } from "../../src/lib/errores.js";
import { ffmpeg } from "../../src/lib/ffmpeg.js";
import { duracionEnPantalla, validarPlan } from "../../src/lib/plan.js";
import { abrirProyecto, leerJson } from "../../src/lib/proyecto.js";
import { leerReferencias } from "../../src/lib/referencias.js";
import { escribirPlan } from "../lib/fixtures.js";

async function proyectoALaMedida(plan: Referencia) {
  const raiz = mkdtempSync(path.join(tmpdir(), "reel-referencia-"));
  mkdirSync(path.join(raiz, "clips"));
  mkdirSync(path.join(raiz, "edit"));
  const necesario = new Map<string, number>();
  const conAudio = new Set(plan.tramos.filter((t) => "audioDelClip" in t && t.audioDelClip).map((t) => t.clip));
  for (const t of plan.tramos) {
    const v = t.velocidad ?? 1;
    necesario.set(t.clip, Math.max(necesario.get(t.clip) ?? 0, t.arrancaEn + (v === 0 ? 0.1 : duracionEnPantalla(t) * v)));
  }
  for (const [clip, segundos] of necesario) {
    const audio = conAudio.has(clip) ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono"] : [];
    await ffmpeg(["-f", "lavfi", "-i", "color=c=gray:s=16x16:r=10", ...audio, "-t", String(segundos + 0.2), path.join(raiz, "clips", clip)]);
  }
  const voz = Math.max(...plan.tramos.map((t) => ("hasta" in t ? t.hasta : 0)));
  await ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", String(voz), path.join(raiz, "edit", "voz-limpia.wav")]);
  await ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=30x15", "-frames:v", "1", path.join(raiz, "logo.png")]);
  return abrirProyecto(raiz);
}

function tablaDePrueba(contenido: unknown) {
  const archivo = path.join(mkdtempSync(path.join(tmpdir(), "reel-tabla-")), "referencias.json");
  writeFileSync(archivo, JSON.stringify(contenido));
  return archivo;
}

for (const r of leerReferencias()) {
  test(`el plan real de ${r.nombre} existe y está bien armado`, async () => {
    assert.ok(existsSync(r.archivoPlan), r.archivoPlan);
    const plan = leerJson<Referencia>(r.archivoPlan);
    const p = await proyectoALaMedida(plan);
    escribirPlan(p.raiz, plan);
    assert.deepEqual((await validarPlan(p)).errores, []);
  });
}

test("los cortes de cada referencia son los que se ven en el publicado, no cada tramo", () => {
  const esperados: Record<string, number> = { "casa-giro": 17, "pancho-y-coca": 14 };
  for (const r of leerReferencias()) {
    const plan = leerJson<Referencia>(r.archivoPlan);
    assert.equal(cortesEnLaVoz(plan.tramos).length, esperados[r.nombre], r.nombre);
    assert.equal(comparar(plan, plan).cortes, 1, r.nombre);
  }
});

test("la carpeta sale con ~ resuelto y el plan relativo a la tabla", () => {
  const archivo = tablaDePrueba({ playa: { carpeta: "~/reels/playa", plan: "playa/plan-real.json" } });
  assert.deepEqual(leerReferencias(archivo), [
    { nombre: "playa", carpeta: path.join(process.env.HOME!, "reels", "playa"), archivoPlan: path.join(path.dirname(archivo), "playa", "plan-real.json") },
  ]);
});

test("avisa si a una referencia de la tabla le falta el plan", () => {
  const archivo = tablaDePrueba({ "casa-giro": { carpeta: "~/reels/hola-luli" } });
  assert.throws(() => leerReferencias(archivo), (e) => e instanceof ErrorReel && e.message.includes('"casa-giro"'));
});
