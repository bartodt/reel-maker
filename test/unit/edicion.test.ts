import assert from "node:assert/strict";
import { test } from "node:test";
import { aplicarEdicion, cambiarTramo, moverCorte, partirTramo, ponerSubtitulos, quitarTramo } from "../../src/lib/edicion.js";
import { ErrorReel } from "../../src/lib/errores.js";
import type { Plan } from "../../src/lib/plan.js";

const PLAN: Plan = {
  ritmo: "normal",
  tramos: [
    { duracion: 1, clip: "gancho.mov", arrancaEn: 2, texto: "HOLA", nota: "Gancho" },
    { desde: 0, hasta: 2, clip: "a.mov", arrancaEn: 1, nota: "primera frase" },
    { desde: 2, hasta: 5, clip: "b.mov", arrancaEn: 0, velocidad: 2 },
    { duracion: 1.5, clip: "chico.mov", arrancaEn: 4, audioDelClip: true },
    { desde: 5, hasta: 8, clip: "c.mov", arrancaEn: 3, logo: true },
  ],
};

test("cambiar un plano no toca el plan original", () => {
  const nuevo = cambiarTramo(PLAN, 1, { clip: "otro.mov", arrancaEn: 3.456 });
  assert.equal(nuevo.tramos[1].clip, "otro.mov");
  assert.equal(nuevo.tramos[1].arrancaEn, 3.46);
  assert.equal(PLAN.tramos[1].clip, "a.mov");
});

test("null, texto vacío o el valor por defecto sacan el campo", () => {
  const nuevo = cambiarTramo(PLAN, 2, { velocidad: 1, texto: "  ", encuadre: "centro" });
  assert.ok(!("velocidad" in nuevo.tramos[2]));
  assert.ok(!("texto" in nuevo.tramos[2]));
  assert.ok(!("encuadre" in nuevo.tramos[2]));
  const sinLogo = cambiarTramo(PLAN, 4, { logo: false });
  assert.ok(!("logo" in sinLogo.tramos[4]));
  const sinTexto = cambiarTramo(PLAN, 0, { texto: null });
  assert.ok(!("texto" in sinTexto.tramos[0]));
});

test("el audio del video solo va sin voz, y deja la velocidad normal", () => {
  assert.throws(() => cambiarTramo(PLAN, 1, { audioDelClip: true }), ErrorReel);
  const nuevo = cambiarTramo({ tramos: [{ duracion: 1, clip: "x.mov", arrancaEn: 0, velocidad: 0.5 }] }, 0, { audioDelClip: true });
  assert.deepEqual(nuevo.tramos[0], { duracion: 1, clip: "x.mov", arrancaEn: 0, audioDelClip: true });
});

test("la duración solo se cambia en planos sin voz", () => {
  assert.equal((cambiarTramo(PLAN, 0, { duracion: 2.5 }).tramos[0] as { duracion: number }).duracion, 2.5);
  assert.throws(() => cambiarTramo(PLAN, 1, { duracion: 3 }), ErrorReel);
});

test("mover un corte cambia el final de un plano y el principio del siguiente con voz", () => {
  const nuevo = moverCorte(PLAN, 2, 6.2);
  assert.equal((nuevo.tramos[2] as { hasta: number }).hasta, 6.2);
  assert.equal((nuevo.tramos[4] as { desde: number }).desde, 6.2);
  // El plano sin voz del medio no se mueve
  assert.deepEqual(nuevo.tramos[3], PLAN.tramos[3]);
});

test("no se puede mover un corte hasta dejar un plano vacío", () => {
  assert.throws(() => moverCorte(PLAN, 1, 0), ErrorReel);
  assert.throws(() => moverCorte(PLAN, 1, 5), ErrorReel);
  assert.throws(() => moverCorte(PLAN, 4, 7), ErrorReel); // es el último con voz
  assert.throws(() => moverCorte(PLAN, 0, 0.5), ErrorReel); // no tiene voz
});

test("partir un plano con voz sigue el video donde quedó, teniendo en cuenta la velocidad", () => {
  const nuevo = partirTramo(PLAN, 2, 3);
  assert.equal(nuevo.tramos.length, PLAN.tramos.length + 1);
  assert.deepEqual(nuevo.tramos[2], { desde: 2, hasta: 3, clip: "b.mov", arrancaEn: 0, velocidad: 2 });
  assert.deepEqual(nuevo.tramos[3], { desde: 3, hasta: 5, clip: "b.mov", arrancaEn: 2, velocidad: 2 });
});

test("partir un plano sin voz reparte la duración y no copia la nota", () => {
  const nuevo = partirTramo(PLAN, 0, 0.4);
  assert.deepEqual(nuevo.tramos[0], { duracion: 0.4, clip: "gancho.mov", arrancaEn: 2, texto: "HOLA", nota: "Gancho" });
  assert.deepEqual(nuevo.tramos[1], { duracion: 0.6, clip: "gancho.mov", arrancaEn: 2.4, texto: "HOLA" });
});

test("sacar un plano con voz le pasa su voz al de al lado", () => {
  const sinSegundo = quitarTramo(PLAN, 2);
  assert.equal(sinSegundo.tramos.length, 4);
  assert.equal((sinSegundo.tramos[1] as { hasta: number }).hasta, 5);

  // El primero con voz no tiene uno con voz antes: se lo lleva el siguiente
  const sinPrimero = quitarTramo(PLAN, 1);
  assert.equal((sinPrimero.tramos[1] as { desde: number }).desde, 0);

  // Uno sin voz simplemente desaparece
  assert.equal(quitarTramo(PLAN, 3).tramos.length, 4);
});

test("no se puede sacar el único plano de un pedazo de voz", () => {
  const plan: Plan = {
    tramos: [
      { desde: 0, hasta: 2, clip: "a.mov", arrancaEn: 0 },
      { duracion: 1, clip: "x.mov", arrancaEn: 0 },
      { desde: 2, hasta: 4, clip: "b.mov", arrancaEn: 0 },
      { duracion: 1, clip: "y.mov", arrancaEn: 0 },
    ],
  };
  assert.throws(() => quitarTramo(plan, 2), ErrorReel);
});

test("aplicarEdicion revisa lo que llega de la app", () => {
  assert.equal(aplicarEdicion(PLAN, { op: "cambiar", indice: 1, cambios: { clip: "z.mov", basura: 1 } }).tramos[1].clip, "z.mov");
  assert.ok(!("basura" in aplicarEdicion(PLAN, { op: "cambiar", indice: 1, cambios: { basura: 1 } }).tramos[1]));
  assert.throws(() => aplicarEdicion(PLAN, { op: "cambiar", indice: 9, cambios: {} }), /ya no existe/);
  assert.throws(() => aplicarEdicion(PLAN, { op: "cambiar", indice: 1, cambios: { encuadre: "diagonal" } }), ErrorReel);
  assert.throws(() => aplicarEdicion(PLAN, { op: "cambiar", indice: 1, cambios: { velocidad: -1 } }), ErrorReel);
  assert.throws(() => aplicarEdicion(PLAN, { op: "borrar todo", indice: 1 }), ErrorReel);
  assert.throws(() => aplicarEdicion(PLAN, { op: "corte", indice: 1 }), ErrorReel);
  assert.equal(aplicarEdicion(PLAN, { op: "quitar", indice: 3 }).tramos.length, 4);
});

test("apagar y prender los subtítulos del reel", () => {
  const sin = aplicarEdicion(PLAN, { op: "subtitulos", activos: false });
  assert.equal(sin.subtitulos, false);
  assert.ok(!("subtitulos" in PLAN));
  const con = ponerSubtitulos(sin, true);
  assert.ok(!("subtitulos" in con));
  assert.deepEqual(con.tramos, PLAN.tramos);
  assert.throws(() => aplicarEdicion(PLAN, { op: "subtitulos", activos: "si" }), ErrorReel);
});
