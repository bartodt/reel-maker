import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparFrases } from "../../src/lib/transcripcion.js";

const w = (text: string, start: number, end: number) => ({ text, start, end, type: "word" });

test("corta frases en el punto final", () => {
  const f = agruparFrases([w("Hola", 0, 0.3), w("mundo.", 0.35, 0.7), w("Chau", 0.75, 1)]);
  assert.deepEqual(
    f.map((x) => x.texto),
    ["Hola mundo.", "Chau"],
  );
});

test("corta frases cuando hay una pausa larga", () => {
  const f = agruparFrases([w("uno", 0, 0.3), w("dos", 1.5, 1.8)]);
  assert.equal(f.length, 2);
  assert.equal(f[1].desde, 1.5);
});

test("ignora espacios y eventos de audio", () => {
  const f = agruparFrases([
    w("hola", 0, 0.3),
    { text: " ", start: 0.3, end: 0.35, type: "spacing" },
    { text: "(risas)", start: 0.35, end: 0.5, type: "audio_event" },
    w("che", 0.5, 0.7),
  ]);
  assert.deepEqual(
    f.map((x) => x.texto),
    ["hola che"],
  );
});
