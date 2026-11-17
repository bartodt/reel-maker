import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { VIDEO } from "../../src/config.js";
import { info } from "../../src/lib/ffmpeg.js";
import { render } from "../../src/pasos/render.js";
import { DURACION_VOZ, LIMITE, PLAN_VALIDO, crearProyectoDePrueba, escribirPlan } from "../lib/fixtures.js";

const silencio = () => {};

/** Volumen promedio (dB) de un pedazo del audio. ffmpeg lo informa por la salida de errores. */
function volumen(archivo: string, desde: number, duracion: number): number {
  const { stderr } = spawnSync("ffmpeg", [
    "-hide_banner", "-ss", String(desde), "-t", String(duracion), "-i", archivo,
    "-af", "volumedetect", "-vn", "-f", "null", "-",
  ]);
  const medido = /mean_volume: (-?[\d.]+) dB/.exec(stderr.toString())?.[1];
  assert.ok(medido, `no se pudo medir el volumen:\n${stderr}`);
  return Number(medido);
}

for (const conMusica of [false, true]) {
  test(`render completo ${conMusica ? "con" : "sin"} música`, LIMITE, async () => {
    const p = await crearProyectoDePrueba({ conMusica });
    escribirPlan(p.raiz, PLAN_VALIDO);
    await render(p, silencio);

    assert.ok(existsSync(p.final));
    const final = await info(p.final);
    assert.equal(final.ancho, VIDEO.ancho);
    assert.equal(final.alto, VIDEO.alto);
    assert.equal(final.fps, VIDEO.fps);
    assert.ok(final.tieneAudio);
    assert.ok(Math.abs(final.duracion - DURACION_VOZ) < 0.1, `duró ${final.duracion} s`);
    assert.ok(readFileSync(`${p.edit}/subtitulos.ass`, "utf8").includes(",Reel,"), "tenía que tener subtítulos");
  });
}

test("render con gancho, alguien del clip hablando, velocidad, texto, imagen congelada, logo y sin subtítulos", LIMITE, async () => {
  const p = await crearProyectoDePrueba();
  escribirPlan(p.raiz, {
    subtitulos: false,
    tramos: [
      { duracion: 1, clip: "vertical.mov", arrancaEn: 0, texto: "HOLA\nPRUEBA" },
      { desde: 0, hasta: 2.5, clip: "horizontal.mp4", arrancaEn: 0, velocidad: 2 },
      { duracion: 1.5, clip: "con-audio.mp4", arrancaEn: 1, audioDelClip: true },
      { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0.2 },
      { duracion: 1, clip: "vertical.mov", arrancaEn: 3.9, velocidad: 0, logo: true },
    ],
  });
  await render(p, silencio);

  const final = await info(p.final);
  const esperado = DURACION_VOZ + 3.5;
  assert.ok(Math.abs(final.duracion - esperado) < 0.1, `duró ${final.duracion} s y tenía que durar ${esperado}`);

  // Sin música: durante el gancho y el cierre no suena nada; donde habla alguien del clip, sí
  assert.ok(volumen(p.final, 0.2, 0.6) < -60, "el gancho tenía que ir sin voz");
  assert.ok(volumen(p.final, 3.7, 1) > -30, "tenía que escucharse el audio del clip");
  assert.ok(volumen(p.final, 8.7, 0.6) < -60, "el cierre tenía que ir sin voz");

  const ass = readFileSync(`${p.edit}/subtitulos.ass`, "utf8");
  assert.ok(ass.includes(",Titulo,") && ass.includes("HOLA\\NPRUEBA"));
  assert.ok(!ass.includes(",Reel,"), "no tenía que tener subtítulos");
});
