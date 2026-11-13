import assert from "node:assert/strict";
import { test } from "node:test";
import { tramosAConservar } from "../../src/lib/voz.js";

const opciones = { margen: 0.1, pausaMinimaParaCortar: 0.5 };

test("agrega margen antes y después de cada tramo", () => {
  const r = tramosAConservar([{ desde: 1, hasta: 2 }], 10, opciones);
  assert.deepEqual(r, [{ desde: 0.9, hasta: 2.1 }]);
});

test("no se pasa del principio ni del final del audio", () => {
  const r = tramosAConservar([{ desde: 0.05, hasta: 9.98 }], 10, opciones);
  assert.deepEqual(r, [{ desde: 0, hasta: 10 }]);
});

test("une tramos con pausas cortas y separa los de pausas largas", () => {
  const r = tramosAConservar(
    [
      { desde: 1, hasta: 2 },
      { desde: 2.4, hasta: 3 }, // pausa corta: se une
      { desde: 5, hasta: 6 }, // pausa larga: tramo nuevo
    ],
    10,
    opciones,
  );
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0].desde - 0.9) < 1e-9);
  assert.ok(Math.abs(r[0].hasta - 3.1) < 1e-9);
  assert.ok(Math.abs(r[1].desde - 4.9) < 1e-9);
});

test("acepta tramos desordenados", () => {
  const r = tramosAConservar(
    [
      { desde: 5, hasta: 6 },
      { desde: 1, hasta: 2 },
    ],
    10,
    opciones,
  );
  assert.ok(r[0].desde < r[1].desde);
});
