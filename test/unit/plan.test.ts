import assert from "node:assert/strict";
import { test } from "node:test";
import { validarPlan } from "../../src/lib/plan.js";
import { DURACION_VOZ, PLAN_VALIDO, crearProyectoDePrueba, escribirPlan } from "../lib/fixtures.js";

const p = await crearProyectoDePrueba();

test("un plan bien armado pasa", async () => {
  escribirPlan(p.raiz, PLAN_VALIDO);
  const r = await validarPlan(p);
  assert.deepEqual(r.errores, []);
  assert.ok(r.ok);
});

test("detecta huecos entre tramos", async () => {
  escribirPlan(p.raiz, {
    tramos: [
      { desde: 0, hasta: 2, clip: "horizontal.mp4", arrancaEn: 0 },
      { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0 },
    ],
  });
  const r = await validarPlan(p);
  assert.ok(!r.ok);
  assert.ok(r.errores.some((e) => e.includes("pegados")));
});

test("detecta cuando el clip no alcanza", async () => {
  escribirPlan(p.raiz, {
    tramos: [{ desde: 0, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 1 }],
  });
  const r = await validarPlan(p);
  assert.ok(r.errores.some((e) => e.includes("el clip dura")));
});

test("detecta clips inexistentes, encuadres inválidos y final sin cubrir", async () => {
  escribirPlan(p.raiz, {
    tramos: [{ desde: 0, hasta: 2, clip: "no-existe.mp4", arrancaEn: 0, encuadre: "costado" as any }],
  });
  const r = await validarPlan(p);
  assert.ok(r.errores.some((e) => e.includes("no existe")));
  assert.ok(r.errores.some((e) => e.includes("encuadre")));
  assert.ok(r.errores.some((e) => e.includes("Falta cubrir el final")));
});
