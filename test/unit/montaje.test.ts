import assert from "node:assert/strict";
import { test } from "node:test";
import { armarMontaje, corregirSubtitulos, diferenciasConEdits, ratosConAudioDelClip, type ElementoDeEdits, type Montaje } from "../../src/lib/montaje.js";
import type { Plan } from "../../src/lib/plan.js";
import type { Palabra } from "../../src/lib/transcripcion.js";

// Gancho sin voz con texto, voz, alguien del clip hablando, voz acelerada, cierre congelado con logo
const plan: Plan = {
  tramos: [
    { duracion: 1, clip: "pancho.mov", arrancaEn: 3, texto: "EL PANCHO" },
    { desde: 0, hasta: 2, clip: "cartel.mov", arrancaEn: 10 },
    { duracion: 1.5, clip: "chico.mov", arrancaEn: 2, audioDelClip: true, texto: "SÁCATE LAS GANAS" },
    { desde: 2, hasta: 4, clip: "promo.mov", arrancaEn: 1, texto: "2 X $10.000" },
    { desde: 4, hasta: 5, clip: "promo.mov", arrancaEn: 5, texto: "2 X $10.000" },
    { desde: 5, hasta: 7, clip: "calle.mov", arrancaEn: 0, velocidad: 4 },
    { duracion: 2, clip: "tren.mov", arrancaEn: 6.8, velocidad: 0, logo: true },
  ],
};

test("ubica cada plano en el reel y calcula qué pedazo del clip usa", () => {
  const m = armarMontaje(plan);
  assert.equal(m.duracion, 11.5);
  assert.deepEqual(
    m.planos.map((p) => [p.clip, p.inicio, p.fin, p.desde, p.hasta]),
    [
      ["pancho.mov", 0, 1, 3, 4],
      ["cartel.mov", 1, 3, 10, 12],
      ["chico.mov", 3, 4.5, 2, 3.5],
      ["promo.mov", 4.5, 6.5, 1, 3],
      ["promo.mov", 6.5, 7.5, 5, 6],
      ["calle.mov", 7.5, 9.5, 0, 8],
      ["tren.mov", 9.5, 11.5, 6.8, 6.8],
    ],
  );
  assert.deepEqual(m.planos.map((p) => p.audioDelClip), [false, false, true, false, false, false, false]);
  assert.equal(m.planos[6].congelado, true);
});

test("parte la voz donde habla alguien del clip", () => {
  assert.deepEqual(armarMontaje(plan).voz, [
    { desde: 0, hasta: 2, inicio: 1 },
    { desde: 2, hasta: 7, inicio: 4.5 },
  ]);
});

test("junta los textos y logos de tramos seguidos, y usa un fundido en los textos cortos", () => {
  const m = armarMontaje(plan);
  assert.deepEqual(
    m.textos.map((t) => [t.texto, t.inicio, t.fin, t.animacion]),
    [
      ["EL PANCHO", 0, 1, "fadeIn"],
      ["SÁCATE LAS GANAS", 3, 4.5, "fligStepByStep"],
      ["2 X $10.000", 4.5, 7.5, "fligStepByStep"],
    ],
  );
  assert.deepEqual(m.logos, [{ inicio: 9.5, fin: 11.5 }]);
});

test("respeta un plan sin subtítulos", () => {
  assert.equal(armarMontaje(plan).subtitulos, true);
  assert.equal(armarMontaje({ ...plan, subtitulos: false }).subtitulos, false);
});

const palabra = (text: string, start: number, end: number): Palabra => ({ text, start, end, type: "word" });

test("corrige los subtítulos de Edits con la transcripción, sin el punto final que Edits saca, y borra lo que dice alguien del clip", () => {
  // Sobre la voz limpia: "En Martínez abrió" (0-2), "podés comer rico" (2-4)
  const palabras = [
    palabra("En", 0.1, 0.4),
    palabra("Martínez", 0.5, 1.2),
    palabra("abrió", 1.3, 1.9),
    palabra("podés", 2.1, 2.6),
    palabra("comer", 2.7, 3.2),
    palabra("rico.", 3.3, 3.9),
  ];
  const m = armarMontaje(plan);
  // En el reel la voz arranca en 1 y se corta entre 3 y 4.5 (habla el chico)
  const subtitulos = [
    { id: "a", text: "En Martínez abrió", startTime: 1.1, endTime: 2.9 },
    { id: "b", text: "la concha de la", startTime: 3.4, endTime: 4.2 },
    { id: "c", text: "puedes comer", startTime: 4.6, endTime: 5.7 },
    { id: "d", text: "rico", startTime: 5.8, endTime: 6.4 },
  ];
  assert.deepEqual(corregirSubtitulos(subtitulos, palabras, plan.tramos, ratosConAudioDelClip(m)), [
    { id: "b", accion: "borrar" },
    { id: "c", accion: "cambiar", texto: "podés comer" },
  ]);
});

test("una palabra que cae entre dos subtítulos va al más cercano", () => {
  const palabras = [palabra("hola", 0, 0.4), palabra("che", 0.55, 0.75)];
  const tramos = [{ desde: 0, hasta: 1, clip: "a.mov", arrancaEn: 0 }];
  const subtitulos = [
    { id: "a", text: "ola", startTime: 0, endTime: 0.5 },
    { id: "b", text: "", startTime: 0.7, endTime: 1 },
  ];
  assert.deepEqual(corregirSubtitulos(subtitulos, palabras, tramos, []), [
    { id: "a", accion: "cambiar", texto: "hola" },
    { id: "b", accion: "cambiar", texto: "che" },
  ]);
});

/** Lo que leería `elements` si Edits armó todo bien, con cada tiempo corrido como el redondeo más grande que se vio en Edits. */
function lineaComoEnEdits(m: Montaje): ElementoDeEdits[] {
  const redondeado = (n: number) => n + 0.013;
  return [
    ...m.planos.map((p, i) => ({
      id: `plano-${i}`,
      trackId: "principal",
      trackType: "video",
      content: p.congelado ? "photo" : "video",
      startTime: redondeado(p.inicio),
      endTime: redondeado(p.fin),
      sourceInPoint: p.congelado ? 0 : p.desde,
      speed: p.congelado ? 1 : p.velocidad,
      volume: p.congelado || p.audioDelClip ? 1 : 0,
    })),
    ...m.voz.map((v, i) => ({
      id: `voz-${i}`,
      trackId: "voz",
      trackType: "audio",
      content: "music",
      startTime: redondeado(v.inicio),
      endTime: redondeado(v.inicio + v.hasta - v.desde),
      sourceInPoint: v.desde,
      sourceOutPoint: v.hasta,
    })),
    ...m.textos.map((t, i) => ({
      id: `texto-${i}`,
      trackId: "textos",
      trackType: "overlay",
      content: "text",
      startTime: redondeado(t.inicio),
      endTime: redondeado(t.fin),
      text: t.texto,
      animation: t.animacion,
    })),
    ...m.logos.map((l, i) => ({ id: `logo-${i}`, trackId: "logo", trackType: "overlay", content: "photo", startTime: redondeado(l.inicio), endTime: redondeado(l.fin) })),
  ];
}

const palabrasDelPlan = [
  palabra("En", 0.1, 0.4),
  palabra("Martínez", 0.5, 1.2),
  palabra("abrió", 1.3, 1.9),
  palabra("podés", 2.1, 2.6),
  palabra("comer", 2.7, 3.2),
  palabra("rico.", 3.3, 3.9),
];
const subtitulosBien = [
  { id: "a", text: "En Martínez abrió", startTime: 1.1, endTime: 2.9 },
  { id: "c", text: "podés comer", startTime: 4.6, endTime: 5.7 },
  { id: "d", text: "rico", startTime: 5.8, endTime: 6.4 },
];

test("una línea de tiempo armada como pide el plan coincide, aunque Edits redondee a sus cuadros", () => {
  const m = armarMontaje(plan);
  const captions = subtitulosBien.map((c) => ({ ...c, trackId: "subtitulos", trackType: "overlay", content: "text" }));
  assert.deepEqual(diferenciasConEdits(m, [...lineaComoEnEdits(m), ...captions], subtitulosBien, palabrasDelPlan, plan.tramos), []);
});

test("encuentra un texto que Edits dejó donde estaba el cursor y no donde se pidió", () => {
  const m = armarMontaje(plan);
  const elementos = lineaComoEnEdits(m).map((e) => (e.text === "2 X $10.000" ? { ...e, startTime: 3, endTime: 6 } : e));
  assert.deepEqual(diferenciasConEdits(m, elementos, subtitulosBien, palabrasDelPlan, plan.tramos), [
    'Texto "2 X $10.000": en Edits va de 3.00 a 6.00 s y en el plan de 4.50 a 7.50 s.',
  ]);
});

test("encuentra un plano que quedó fuera de la pista principal y un pedazo de voz que falta", () => {
  const m = armarMontaje(plan);
  const elementos = lineaComoEnEdits(m)
    .map((e) => (e.id === "plano-6" ? { ...e, trackId: "otra", trackType: "overlay" } : e))
    .filter((e) => e.id !== "voz-1");
  assert.deepEqual(diferenciasConEdits(m, elementos, subtitulosBien, palabrasDelPlan, plan.tramos), [
    "En la pista principal hay 6 planos y el plan tiene 7.",
    "Voz 2: no está el pedazo de 2.00 a 7.00 s de la voz en el segundo 4.50.",
  ]);
});

test("encuentra un plano que suena cuando tenía que ir callado, y subtítulos sin corregir", () => {
  const m = armarMontaje(plan);
  const elementos = lineaComoEnEdits(m).map((e) => (e.id === "plano-1" ? { ...e, volume: 1 } : e));
  const subtitulos = [
    subtitulosBien[0],
    { id: "b", text: "la concha de la", startTime: 3.4, endTime: 4.2 },
    { id: "c", text: "puedes comer", startTime: 4.6, endTime: 5.7 },
    subtitulosBien[2],
  ];
  assert.deepEqual(diferenciasConEdits(m, elementos, subtitulos, palabrasDelPlan, plan.tramos), [
    "Plano 2: tenía que ir sin el audio del clip y suena.",
    'Subtítulo "la concha de la" (3.40 s): cae donde habla alguien del clip.',
    'Subtítulo "puedes comer" (4.60 s): tenía que decir "podés comer".',
  ]);
});
