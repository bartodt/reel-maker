import assert from "node:assert/strict";
import { test } from "node:test";
import { armarAss, tiempoAss } from "../../src/lib/subtitulos.js";

const w = (text: string, start: number, end: number) => ({ text, start, end, type: "word" });

test("formatea tiempos como pide el formato ASS", () => {
  assert.equal(tiempoAss(0), "0:00:00.00");
  assert.equal(tiempoAss(61.257), "0:01:01.26");
  assert.equal(tiempoAss(3725.5), "1:02:05.50");
});

test("arma bloques cortos en mayúsculas", () => {
  const ass = armarAss([w("hola", 0, 0.2), w("qué", 0.25, 0.4), w("tal", 0.45, 0.6), w("todo", 0.65, 0.9)]);
  const lineas = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.equal(lineas.length, 2);
  assert.ok(lineas[0].endsWith("HOLA QUÉ TAL"));
  assert.ok(lineas[1].endsWith("TODO"));
});

test("saca llaves y barras que romperían el formato", () => {
  const ass = armarAss([w("{raro}\\N", 0, 0.5)]);
  assert.ok(ass.includes(",RARON"));
});
