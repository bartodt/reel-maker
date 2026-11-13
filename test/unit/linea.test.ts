import assert from "node:assert/strict";
import { test } from "node:test";
import { armarLinea, momentosDePalabras, segmentosDeAudio, textosEnPantalla, vozAReel } from "../../src/lib/linea.js";
import type { Tramo } from "../../src/lib/plan.js";

// Gancho sin voz, dos tramos con voz, alguien del clip hablando, otro tramo con voz y un cierre sin voz
const tramos: Tramo[] = [
  { duracion: 1, clip: "pancho.mov", arrancaEn: 0, texto: "LO DE PANCHO" },
  { desde: 0, hasta: 2, clip: "cartel.mov", arrancaEn: 0 },
  { desde: 2, hasta: 3, clip: "chico.mov", arrancaEn: 1 },
  { duracion: 1.5, clip: "chico.mov", arrancaEn: 2, audioDelClip: true },
  { desde: 3, hasta: 5, clip: "local.mov", arrancaEn: 0 },
  { duracion: 2, clip: "tren.mov", arrancaEn: 0, logo: true },
];

test("ubica cada tramo en el reel terminado", () => {
  const { piezas, duracion } = armarLinea(tramos);
  assert.equal(duracion, 9.5);
  assert.deepEqual(
    piezas.map((p) => [p.inicio, p.fin]),
    [[0, 1], [1, 3], [3, 4], [4, 5.5], [5.5, 7.5], [7.5, 9.5]],
  );
});

test("si los tramos con voz tienen huecos de centésimas, la imagen no se desfasa de la voz", () => {
  const corridos: Tramo[] = [
    { desde: 0, hasta: 2, clip: "a.mov", arrancaEn: 0 },
    { desde: 2.04, hasta: 3, clip: "b.mov", arrancaEn: 0 },
    { duracion: 1, clip: "c.mov", arrancaEn: 0 },
    { desde: 2.97, hasta: 5, clip: "d.mov", arrancaEn: 0 },
  ];
  assert.deepEqual(armarLinea(corridos).piezas.map((p) => [p.inicio, p.fin]), [[0, 2], [2, 3], [3, 4], [4, 6]]);
  assert.deepEqual(segmentosDeAudio(corridos), [
    { tipo: "voz", desde: 0, hasta: 3 },
    { tipo: "silencio", duracion: 1 },
    { tipo: "voz", desde: 3, hasta: 5 },
  ]);
});

test("pasa segundos de la voz al reel sumando los tramos sin voz que van antes", () => {
  assert.equal(vozAReel(0, tramos), 1); // después del gancho
  assert.equal(vozAReel(2.5, tramos), 3.5);
  assert.equal(vozAReel(3, tramos), 5.5); // después de que habla el chico
  assert.equal(vozAReel(4.9, tramos), 7.4); // el cierre va después de la voz
});

test("arma el audio en orden: silencio, voz, audio del clip, voz, silencio", () => {
  assert.deepEqual(segmentosDeAudio(tramos), [
    { tipo: "silencio", duracion: 1 },
    { tipo: "voz", desde: 0, hasta: 3 },
    { tipo: "clip", clip: "chico.mov", arrancaEn: 2, duracion: 1.5 },
    { tipo: "voz", desde: 3, hasta: 5 },
    { tipo: "silencio", duracion: 2 },
  ]);
});

test("las palabras del texto aparecen cuando se dicen", () => {
  const dichas = [
    { text: "Hoy", start: 1.0 },
    { text: "tenis", start: 1.4 },
    { text: "en", start: 1.8 },
    { text: "San", start: 2.0 },
    { text: "Isidro.", start: 2.3 },
  ];
  assert.deepEqual(momentosDePalabras(["TENIS", "EN", "SAN", "ISIDRO"], dichas, 1, 4, 0.15), [1.4, 1.8, 2.0, 2.3]);
});

test("las que no se dicen aparecen con la siguiente que sí, o un poquito después de la anterior", () => {
  const dichas = [{ text: "panchos", start: 3 }];
  assert.deepEqual(momentosDePalabras(["COMBO", "PANCHOS", "$10.000"], dichas, 2, 3.2, 0.5), [3, 3, 3.1]);
  assert.deepEqual(momentosDePalabras(["HOLA", "CHAU"], [], 2, 5, 0.5), [2, 2.5]);
});

test("reconoce números escritos con cifras y dichos con palabras", () => {
  const dichas = [{ text: "dos", start: 1 }, { text: "panchos", start: 1.3 }];
  assert.deepEqual(momentosDePalabras(["2", "PANCHOS"], dichas, 0, 3, 0.15), [1, 1.3]);
});

test("junta los tramos seguidos con el mismo texto", () => {
  const conTextos: Tramo[] = [
    { desde: 0, hasta: 1, clip: "a.mov", arrancaEn: 0, texto: "PROMO" },
    { desde: 1, hasta: 2, clip: "b.mov", arrancaEn: 0, texto: "PROMO" },
    { desde: 2, hasta: 3, clip: "c.mov", arrancaEn: 0 },
  ];
  const textos = textosEnPantalla(conTextos, [], 0.15);
  assert.equal(textos.length, 1);
  assert.deepEqual([textos[0].inicio, textos[0].fin], [0, 2]);
});
