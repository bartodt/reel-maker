import assert from "node:assert/strict";
import { test } from "node:test";
import { etiquetaCaptura, momentosDeCaptura } from "../../src/lib/capturas.js";

const opciones = { porSegundo: 1, minimo: 4, maximo: 24 };

test("saca más o menos una captura por segundo", () => {
  assert.deepEqual(momentosDeCaptura(6, opciones), [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]);
});

test("en clips cortos saca el mínimo, repartido parejo", () => {
  assert.deepEqual(momentosDeCaptura(1.6, opciones), [0.2, 0.6, 1, 1.4]);
});

test("en clips largos no pasa del máximo", () => {
  const m = momentosDeCaptura(52, opciones);
  assert.equal(m.length, 24);
  assert.ok(m[0] > 0 && m.at(-1)! < 52);
});

test("marca las capturas donde alguien habla", () => {
  const conVoz = [{ desde: 2, hasta: 3.5 }];
  assert.equal(etiquetaCaptura(1.5, conVoz), "1.5 s");
  assert.equal(etiquetaCaptura(2.5, conVoz), "2.5 s · habla");
});
