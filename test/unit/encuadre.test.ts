import assert from "node:assert/strict";
import { test } from "node:test";
import { encuadreValido, filtroEncuadre, posicion } from "../../src/lib/encuadre.js";

test("centro es el valor por defecto", () => {
  assert.equal(posicion(undefined), 0.5);
  assert.ok(filtroEncuadre(undefined, 1080, 1920).includes("(iw-ow)*0.500"));
});

test("traduce nombres a posiciones", () => {
  assert.equal(posicion("izquierda"), 0);
  assert.equal(posicion("derecha"), 1);
  assert.equal(posicion("arriba"), 0);
  assert.equal(posicion(0.3), 0.3);
});

test("rechaza valores raros", () => {
  assert.equal(encuadreValido("costado"), false);
  assert.equal(encuadreValido(1.5), false);
  assert.equal(encuadreValido("derecha"), true);
});
