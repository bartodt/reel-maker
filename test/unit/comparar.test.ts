import assert from "node:assert/strict";
import { test } from "node:test";
import { azarConSemilla, comparar, cortesEnLaVoz, describirSinVoz, planAlAzar, type Referencia } from "../../src/lib/comparar.js";
import type { Plan } from "../../src/lib/plan.js";
import { leerJson } from "../../src/lib/proyecto.js";
import { leerReferencias } from "../../src/lib/referencias.js";

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

const tresPlanos: Referencia = {
  tramos: [
    { desde: 0, hasta: 2, clip: "a.mov", arrancaEn: 0 },
    { desde: 2, hasta: 4, clip: "b.mov", arrancaEn: 0 },
    { desde: 4, hasta: 6, clip: "c.mov", arrancaEn: 0 },
  ],
};

test("pone los cortes en segundos de la voz, también los de los tramos sin voz", () => {
  assert.deepEqual(cortesEnLaVoz(referencia.tramos), [0, 2, 4]);
});

test("un plan igual a la referencia tiene todos los cortes en el mismo lugar", () => {
  const c = comparar(referencia, referencia, 0.1);
  assert.equal(c.cortes, 1);
  assert.equal(c.cortesQueCoinciden, 3);
});

test("con cada corte 0,5 s tarde no coincide ningún corte, y el contenido solo pierde esos 0,5 s", () => {
  const plan: Plan = {
    tramos: [
      { desde: 0, hasta: 2.5, clip: "a.mov", arrancaEn: 0 },
      { desde: 2.5, hasta: 4.5, clip: "b.mov", arrancaEn: 0 },
      { desde: 4.5, hasta: 6, clip: "c.mov", arrancaEn: 0 },
    ],
  };
  const c = comparar(plan, tresPlanos, 0.1);
  assert.equal(c.cortes, 0);
  assert.ok(Math.abs(c.mismoContenido - 5 / 6) < 0.02, String(c.mismoContenido));
});

test("un plan sin cortes no tiene ninguno en el mismo lugar", () => {
  const c = comparar({ tramos: [{ desde: 0, hasta: 6, clip: "a.mov", arrancaEn: 0 }] }, tresPlanos, 0.1);
  assert.equal(c.cortes, 0);
  assert.deepEqual(c.totalCortes, { plan: 0, referencia: 2 });
});

test("partir una toma para cambiarle la velocidad o el texto no es un corte, saltar dentro del clip sí", () => {
  const partida: Plan = {
    tramos: [
      { desde: 0, hasta: 1, clip: "a.mov", arrancaEn: 0 },
      { desde: 1, hasta: 2, clip: "a.mov", arrancaEn: 1, velocidad: 2, texto: "LA PLAYA" },
      ...tresPlanos.tramos.slice(1),
    ],
  };
  const conSegundo = (arrancaEn: number) => partida.tramos.map((t, i) => (i === 1 ? { ...t, arrancaEn } : t));
  assert.equal(comparar(partida, tresPlanos, 0.1).cortes, 1);
  assert.deepEqual(cortesEnLaVoz(conSegundo(1.43)), [2, 4], "un salto de 0,43 s, como el de la caminata de Pancho y Coca, sigue la toma");
  assert.deepEqual(cortesEnLaVoz(conSegundo(8)), [1, 2, 4]);
});

test("cada corte de la referencia empareja con uno solo del plan, así que los que sobran bajan", () => {
  const plan: Plan = {
    tramos: [
      { desde: 0, hasta: 1.9, clip: "a.mov", arrancaEn: 0 },
      { desde: 1.9, hasta: 2.1, clip: "x.mov", arrancaEn: 0 },
      ...tresPlanos.tramos.slice(1).map((t, i) => (i === 0 ? { ...t, desde: 2.1 } : t)),
    ],
  };
  const c = comparar(plan, tresPlanos, 0.1);
  assert.equal(c.cortesQueCoinciden, 2);
  assert.equal(c.cortes, (2 * 2) / (3 + 2));
});

test("dos cortes a 0,3 s justos no forman pareja, en cualquier segundo de la voz", () => {
  const unCorte = (s: number): Plan => ({
    tramos: [
      { desde: 0, hasta: s, clip: "a.mov", arrancaEn: 0 },
      { desde: s, hasta: 10, clip: "b.mov", arrancaEn: 0 },
    ],
  });
  for (const s of [1, 5, 6.288]) {
    assert.equal(comparar(unCorte(s + 0.3), unCorte(s), 0.1).cortes, 0, `${s} y ${s + 0.3}`);
    assert.equal(comparar(unCorte(s + 0.299), unCorte(s), 0.1).cortes, 1, `${s} y ${s + 0.299}`);
  }
});

test("avisa si alguno no tiene tramos con voz", () => {
  assert.throws(() => comparar({ tramos: [{ duracion: 1, clip: "a.mov", arrancaEn: 0 }] }, referencia), /al menos un tramo con voz/);
});

test("un plan al azar llena la voz entre los cortes que se le piden, con momentos que entran en el clip", () => {
  const plan = planAlAzar(6, [4, 2], [{ archivo: "a.mov", duracion: 3 }, { archivo: "b.mov", duracion: 10 }], azarConSemilla(1));
  assert.deepEqual(plan.tramos.map((t) => ("desde" in t ? [t.desde, t.hasta] : [])), [[0, 2], [2, 4], [4, 6]]);
  for (const t of plan.tramos) assert.ok(t.arrancaEn >= 0 && t.arrancaEn + 2 <= (t.clip === "a.mov" ? 3 : 10), JSON.stringify(t));
});

test("un plan al azar queda debajo de 30% de mismo contenido en cada referencia, aunque elija solo entre los clips de la referencia", () => {
  for (const r of leerReferencias()) {
    const real = leerJson<Referencia>(r.archivoPlan);
    const clips = [...new Set(real.tramos.flatMap((t) => [t.clip, ...(t.alternativas ?? [])]))].map((archivo) => ({ archivo, duracion: 60 }));
    const voz = Math.max(...real.tramos.map((t) => ("hasta" in t ? t.hasta : 0)));
    const contenido = Array.from({ length: 20 }, (_, s) => {
      const azar = azarConSemilla(s + 1);
      const cortes = cortesEnLaVoz(real.tramos).map(() => azar() * voz);
      return comparar(planAlAzar(voz, cortes, clips, azar), real).mismoContenido;
    }).sort((a, b) => a - b);
    assert.ok(contenido[10] < 0.3, `${r.nombre}: ${contenido.map((c) => Math.round(c * 100)).join(" ")}`);
  }
});
