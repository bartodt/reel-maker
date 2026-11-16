import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PARTES_DEL_PLANO,
  aVozLimpia,
  emparejar,
  firma,
  planDesdePublicado,
  planosDeCortes,
  type ClipLeido,
  type Firma,
  type PlanoPublicado,
} from "../../src/lib/emparejar.js";

const FPS = 10;

// Cuadros al azar pero siempre los mismos: cada cuadro de un clip es distinto de los demás
function azar(semilla: number) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipAlAzar(clip: string, cuadros: number, semilla: number): ClipLeido {
  const r = azar(semilla);
  return { clip, firmas: Array.from({ length: cuadros }, () => firma(Uint8Array.from({ length: 576 }, () => r() * 255))) };
}

function casiIgual(clip: string, original: ClipLeido): ClipLeido {
  const r = azar(99);
  const ruido = (f: Firma) => firma(Uint8Array.from(f, (v) => Math.max(0, Math.min(255, 128 + v * 1500 + (r() - 0.5) * 20))));
  return { clip, firmas: original.firmas.map(ruido) };
}

function plano(clip: ClipLeido, duracion: number, arrancaEn: number, velocidad: number): PlanoPublicado {
  const cuadros = (partes: readonly number[]) => partes.map((parte) => clip.firmas[Math.round((arrancaEn + duracion * parte * velocidad) * FPS)]);
  return {
    duracion,
    ajuste: cuadros(PARTES_DEL_PLANO.ajuste) as [Firma, Firma, Firma],
    puntas: cuadros(PARTES_DEL_PLANO.puntas) as [Firma, Firma],
  };
}

const playa = clipAlAzar("playa.mov", 100, 1);
const cafe = clipAlAzar("cafe.mov", 80, 2);
const plaza = clipAlAzar("plaza.mov", 60, 3);

test("un plano que sale de un clip se encuentra en ese clip y en su momento", () => {
  const r = emparejar(plano(cafe, 2, 3.5, 1), [playa, cafe, plaza], FPS);
  assert.equal(r.clip, "cafe.mov");
  assert.equal(r.velocidad, 1);
  assert.ok(Math.abs(r.arrancaEn - 3.5) < 0.11, `arranca en ${r.arrancaEn}`);
  assert.ok(r.parecido > 0.99);
  assert.ok(r.segundo && r.segundo.clip !== "cafe.mov" && r.segundo.parecido < 0.5);
  assert.deepEqual(r.alternativas, []);
});

test("dos clips casi iguales salen como alternativa", () => {
  const otraToma = casiIgual("cafe-2.mov", cafe);
  const r = emparejar(plano(cafe, 2, 1, 1), [playa, otraToma, cafe], FPS);
  assert.equal(r.clip, "cafe.mov");
  assert.deepEqual(r.alternativas, ["cafe-2.mov"]);
});

test("otra toma que pasa por la misma imagen con otro movimiento es alternativa, pero no la elegida", () => {
  const mitad = plano(cafe, 2, 1, 1);
  const otroMovimiento = clipAlAzar("cafe-paneo.mov", 40, 7);
  otroMovimiento.firmas[20] = mitad.ajuste[1];
  const r = emparejar(mitad, [otroMovimiento, cafe, playa], FPS);
  assert.equal(r.clip, "cafe.mov");
  assert.deepEqual(r.alternativas, ["cafe-paneo.mov"]);
});

test("un plano al doble de velocidad sale con velocidad 2", () => {
  const r = emparejar(plano(playa, 2, 3, 2), [cafe, playa, plaza], FPS);
  assert.equal(r.clip, "playa.mov");
  assert.equal(r.velocidad, 2);
  assert.ok(Math.abs(r.arrancaEn - 3) < 0.11, `arranca en ${r.arrancaEn}`);
});

test("un plano que cambia de velocidad adentro queda para revisar a mano", () => {
  const parejo = emparejar(plano(playa, 4, 1, 2), [cafe, playa], FPS);
  assert.equal(parejo.revisar, false);

  const cambia = plano(playa, 4, 1, 2);
  cambia.puntas[0] = playa.firmas[Math.round((1 + 4 * 0.05 * 2 - 0.5) * FPS)];
  const r = emparejar(cambia, [cafe, playa], FPS);
  assert.equal(r.clip, "playa.mov");
  assert.equal(r.velocidad, 2);
  assert.equal(r.revisar, true);
});

test("una imagen congelada sale con velocidad 0, y una escena quieta con velocidad normal", () => {
  const congelado = plano(plaza, 3, 2, 0);
  assert.equal(emparejar(congelado, [playa, cafe, plaza], FPS).velocidad, 0);

  const quieto = { clip: "pared.mov", firmas: Array(50).fill(plaza.firmas[0]) };
  const r = emparejar(plano(quieto, 2, 1, 1), [playa, quieto], FPS);
  assert.equal(r.clip, "pared.mov");
  assert.equal(r.velocidad, 1);
});

test("dos cortes casi pegados (una transición de un cuadro) cuentan como uno", () => {
  assert.deepEqual(planosDeCortes([18.033, 2, 18, 10], 20), [
    { desde: 0, hasta: 2 },
    { desde: 2, hasta: 10 },
    { desde: 10, hasta: 18 },
    { desde: 18, hasta: 20 },
  ]);
});

test("los segundos del publicado pasan a la voz limpia descontando los silencios que se sacaron", () => {
  const conservados = [
    { desde: 0.25, hasta: 10 },
    { desde: 12, hasta: 20 },
  ];
  assert.equal(aVozLimpia(0, conservados), 0);
  assert.equal(aVozLimpia(5.25, conservados), 5);
  assert.equal(aVozLimpia(11, conservados), 9.75);
  assert.equal(aVozLimpia(13, conservados), 10.75);
  assert.equal(aVozLimpia(25, conservados), 17.75);
});

test("el borrador del plan va pegado sobre la voz limpia y arranca cada clip donde empieza a verse", () => {
  const base = { medio: 0, parecido: 0.9, puntas: [0.9, 0.9] as [number, number], revisar: false, alternativas: [] };
  const plan = planDesdePublicado(
    [
      { ...base, desde: 0, hasta: 2.25, clip: "a.mov", arrancaEn: 1, velocidad: 2 },
      { ...base, desde: 2.25, hasta: 4, clip: "b.mov", arrancaEn: 0, velocidad: 1, alternativas: ["c.mov"] },
      { ...base, desde: 4, hasta: 5, clip: "d.mov", arrancaEn: 3, velocidad: 0 },
    ],
    [{ desde: 0.25, hasta: 4.5 }],
  );
  assert.deepEqual(plan.tramos, [
    { desde: 0, hasta: 2, clip: "a.mov", arrancaEn: 1.5, velocidad: 2 },
    { desde: 2, hasta: 3.75, clip: "b.mov", arrancaEn: 0, alternativas: ["c.mov"] },
    { desde: 3.75, hasta: 4.25, clip: "d.mov", arrancaEn: 3, velocidad: 0 },
  ]);
});
