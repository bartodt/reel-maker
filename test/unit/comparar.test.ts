import assert from "node:assert/strict";
import { test } from "node:test";
import { comparar, describirSinVoz, type Referencia } from "../../src/lib/comparar.js";
import type { Plan } from "../../src/lib/plan.js";

const referencia: Referencia = {
  tramos: [
    { duracion: 1, clip: "pancho.mov", arrancaEn: 3, texto: "LO DE PANCHO" },
    { desde: 0, hasta: 2, clip: "cartel.mov", arrancaEn: 10, alternativas: ["cartel-calle.mov"] },
    { desde: 2, hasta: 4, clip: "licuado.mov", arrancaEn: 0 },
    { duracion: 3, clip: "tren.mov", arrancaEn: 0, logo: true },
  ],
};

test("cuenta como igual un clip alternativo, y separa mismo clip y mismo momento", () => {
  const plan: Plan = {
    tramos: [
      { desde: 0, hasta: 2, clip: "cartel-calle.mov", arrancaEn: 0 },
      { desde: 2, hasta: 3, clip: "licuado.mov", arrancaEn: 0 },
      { desde: 3, hasta: 4, clip: "licuado.mov", arrancaEn: 8 },
    ],
  };
  const c = comparar(plan, referencia, 0.1);
  assert.equal(Math.round(c.mismoContenido * 100), 100);
  assert.equal(Math.round(c.mismoClip * 100), 50);
  assert.equal(Math.round(c.mismoMomento * 100), 25);
  assert.deepEqual(c.planos, { plan: 3, referencia: 2 });
  assert.deepEqual(c.diferencias, []);
  assert.deepEqual(c.textos, { plan: 0, referencia: 1 });
  assert.deepEqual(c.logo, { plan: false, referencia: true });
});

test("junta los momentos en que muestran otra cosa", () => {
  const plan: Plan = { tramos: [{ desde: 0, hasta: 4, clip: "cartel.mov", arrancaEn: 10 }] };
  const c = comparar(plan, referencia, 0.1);
  assert.equal(c.diferencias.length, 1);
  assert.equal(c.diferencias[0].plan, "cartel.mov");
  assert.equal(c.diferencias[0].referencia, "licuado.mov");
  assert.ok(Math.abs(c.diferencias[0].desde - 2) < 0.11 && Math.abs(c.diferencias[0].hasta - 4) < 0.11);
});

test("describe dónde van los tramos sin voz", () => {
  assert.deepEqual(describirSinVoz(referencia.tramos), ["al principio: 1.0 s de pancho.mov", "al final: 3.0 s de tren.mov"]);
});

test("avisa si alguno no tiene tramos con voz", () => {
  assert.throws(() => comparar({ tramos: [{ duracion: 1, clip: "a.mov", arrancaEn: 0 }] }, referencia), /al menos un tramo con voz/);
});
