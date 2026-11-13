import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { VIDEO } from "../../src/config.js";
import { info } from "../../src/lib/ffmpeg.js";
import { render } from "../../src/pasos/render.js";
import { DURACION_VOZ, PLAN_VALIDO, crearProyectoDePrueba, escribirPlan } from "../lib/fixtures.js";

const silencio = () => {};

for (const conMusica of [false, true]) {
  test(`render completo ${conMusica ? "con" : "sin"} música`, async () => {
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
    assert.ok(existsSync(`${p.edit}/subtitulos.ass`));
  });
}
