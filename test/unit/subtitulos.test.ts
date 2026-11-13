import assert from "node:assert/strict";
import { test } from "node:test";
import { SUBTITULOS } from "../../src/config.js";
import { armarAss, tiempoAss } from "../../src/lib/subtitulos.js";

const w = (text: string, start: number, end: number) => ({ text, start, end, type: "word" });
const dialogos = (ass: string, estilo: string) => ass.split("\n").filter((l) => l.startsWith("Dialogue:") && l.includes(`,${estilo},`));

test("formatea tiempos como pide el formato ASS", () => {
  assert.equal(tiempoAss(0), "0:00:00.00");
  assert.equal(tiempoAss(61.257), "0:01:01.26");
  assert.equal(tiempoAss(3725.5), "1:02:05.50");
});

test("arma bloques cortos, en mayúsculas si se pide", () => {
  const palabras = [w("hola", 0, 0.2), w("qué", 0.25, 0.4), w("tal", 0.45, 0.6), w("todo", 0.65, 0.9)];
  const lineas = dialogos(armarAss(palabras, [], { ...SUBTITULOS, palabrasPorBloque: 3, mayusculas: true }), "Reel");
  assert.equal(lineas.length, 2);
  assert.ok(lineas[0].endsWith("HOLA QUÉ TAL"));
  assert.ok(lineas[1].endsWith("TODO"));
});

test("de a una palabra y en minúscula", () => {
  const palabras = [w("Hola", 0, 0.2), w("qué", 0.25, 0.4)];
  const lineas = dialogos(armarAss(palabras, [], { ...SUBTITULOS, palabrasPorBloque: 1, mayusculas: false }), "Reel");
  assert.deepEqual(lineas.map((l) => l.split(",").at(-1)), ["Hola", "qué"]);
});

test("saca llaves y barras que romperían el formato", () => {
  const ass = armarAss([w("{raro}\\N", 0, 0.5)], [], { ...SUBTITULOS, mayusculas: true });
  assert.ok(ass.includes(",RARON"));
});

test("los textos grandes se completan palabra por palabra sin moverse", () => {
  const ass = armarAss([], [{ texto: "2 PANCHOS\n$10.000", inicio: 1, fin: 3, momentos: [1, 1.5, 2] }]);
  const lineas = dialogos(ass, "Titulo");
  assert.equal(lineas.length, 3);
  assert.ok(lineas[0].includes("0:00:01.00,0:00:01.50"));
  assert.ok(lineas[0].endsWith("2 {\\alpha&HFF&}PANCHOS\\N$10.000"));
  assert.ok(lineas[1].endsWith("2 PANCHOS\\N{\\alpha&HFF&}$10.000"));
  assert.ok(lineas[2].includes("0:00:02.00,0:00:03.00"));
  assert.ok(lineas[2].endsWith("{\\fad(0,150)}2 PANCHOS\\N$10.000"));
});
