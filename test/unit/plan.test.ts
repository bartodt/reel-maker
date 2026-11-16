import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Referencia } from "../../src/lib/comparar.js";
import { RAIZ_REPO } from "../../src/lib/entorno.js";
import { ffmpeg } from "../../src/lib/ffmpeg.js";
import { duracionEnPantalla, planoTipico, validarPlan, type Plan } from "../../src/lib/plan.js";
import { abrirProyecto, leerJson } from "../../src/lib/proyecto.js";
import { DURACION_VOZ, PLAN_VALIDO, crearProyectoDePrueba, escribirPlan } from "../lib/fixtures.js";

const p = await crearProyectoDePrueba();

async function validarCon(plan: Plan) {
  escribirPlan(p.raiz, plan);
  return validarPlan(p);
}

test("un plan bien armado pasa", async () => {
  const r = await validarCon(PLAN_VALIDO);
  assert.deepEqual(r.errores, []);
  assert.ok(r.ok);
});

test("detecta huecos entre tramos", async () => {
  const r = await validarCon({
    tramos: [
      { desde: 0, hasta: 2, clip: "horizontal.mp4", arrancaEn: 0 },
      { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0 },
    ],
  });
  assert.ok(!r.ok);
  assert.ok(r.errores.some((e) => e.includes("pegados")));
});

test("detecta cuando el clip no alcanza", async () => {
  const r = await validarCon({ tramos: [{ desde: 0, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 1 }] });
  assert.ok(r.errores.some((e) => e.includes("el clip dura")));
});

test("detecta clips inexistentes, encuadres inválidos y final sin cubrir", async () => {
  const r = await validarCon({
    tramos: [{ desde: 0, hasta: 2, clip: "no-existe.mp4", arrancaEn: 0, encuadre: "costado" as any }],
  });
  assert.ok(r.errores.some((e) => e.includes("no existe")));
  assert.ok(r.errores.some((e) => e.includes("encuadre")));
  assert.ok(r.errores.some((e) => e.includes("Falta cubrir el final")));
});

test("acepta tramos sin voz en el medio: gancho, alguien del clip hablando y cierre", async () => {
  const r = await validarCon({
    tramos: [
      { duracion: 1, clip: "vertical.mov", arrancaEn: 0, texto: "HOLA" },
      { desde: 0, hasta: 2.5, clip: "horizontal.mp4", arrancaEn: 0, velocidad: 2 },
      { duracion: 1.5, clip: "con-audio.mp4", arrancaEn: 1, audioDelClip: true },
      { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0.2 },
      { duracion: 1, clip: "vertical.mov", arrancaEn: 3.9, velocidad: 0, logo: true },
    ],
  });
  assert.deepEqual(r.errores, []);
  assert.equal(r.duracionTotal, DURACION_VOZ + 3.5);
});

test("un tramo va con voz o sin voz, no las dos cosas", async () => {
  const r = await validarCon({
    tramos: [{ desde: 0, hasta: DURACION_VOZ, duracion: 2, clip: "horizontal.mp4", arrancaEn: 0 } as any],
  });
  assert.ok(r.errores.some((e) => e.includes("una de las dos")));
});

test("el audio del clip solo va en tramos sin voz y en clips con audio", async () => {
  const r = await validarCon({
    tramos: [
      { duracion: 1, clip: "vertical.mov", arrancaEn: 0, audioDelClip: true },
      { desde: 0, hasta: DURACION_VOZ, clip: "horizontal.mp4", arrancaEn: 0, audioDelClip: true } as any,
    ],
  });
  assert.ok(r.errores.some((e) => e.includes("no tiene audio")));
  assert.ok(r.errores.some((e) => e.includes("solo va en tramos sin voz")));
});

test("con velocidad necesita más clip, y la imagen congelada tiene que estar dentro del clip", async () => {
  const r = await validarCon({
    tramos: [
      { desde: 0, hasta: 3, clip: "vertical.mov", arrancaEn: 0, velocidad: 2 },
      { desde: 3, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 5, velocidad: 0 },
      { duracion: 1, clip: "vertical.mov", arrancaEn: 0, velocidad: 20 },
    ],
  });
  assert.ok(r.errores.some((e) => e.includes("a velocidad 2")));
  assert.ok(r.errores.some((e) => e.includes("imagen congelada sale del segundo")));
  assert.ok(r.errores.some((e) => e.includes('"velocidad" tiene que ser')));
});

test("avisa si los planos no siguen el ritmo pedido", async () => {
  const r = await validarCon({ ...PLAN_VALIDO, ritmo: "rapido" });
  assert.ok(r.ok);
  assert.ok(r.avisos.some((a) => a.includes('ritmo es "rapido"')));
  const mal = await validarCon({ ...PLAN_VALIDO, ritmo: "lento" as any });
  assert.ok(mal.errores.some((e) => e.includes('"ritmo"')));
});

test("el plano típico es la mitad de los tramos con voz", () => {
  const tramos = [1, 3, 2].map((d, i) => ({ desde: i * 3, hasta: i * 3 + d, clip: "x", arrancaEn: 0 }));
  assert.equal(planoTipico([...tramos, { duracion: 9, clip: "x", arrancaEn: 0 }]), 2);
});

test("acepta apagar los subtítulos y rechaza valores raros", async () => {
  const sin = await validarCon({ ...PLAN_VALIDO, subtitulos: false });
  assert.ok(sin.ok);
  const mal = await validarCon({ ...PLAN_VALIDO, subtitulos: "no" as any });
  assert.ok(mal.errores.some((e) => e.includes('"subtitulos"')));
});

/** Clips y voz limpia de relleno que duran lo justo para el plan: así se valida una referencia sin los crudos. */
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

for (const referencia of ["casa-giro", "pancho-y-coca"]) {
  test(`el plan real de ${referencia} está bien armado`, async () => {
    const plan = leerJson<Referencia>(path.join(RAIZ_REPO, "referencias", referencia, "plan-real.json"));
    const p = await proyectoALaMedida(plan);
    escribirPlan(p.raiz, plan);
    assert.deepEqual((await validarPlan(p)).errores, []);
  });
}
