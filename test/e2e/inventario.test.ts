import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CAPTURAS } from "../../src/config.js";
import { info } from "../../src/lib/ffmpeg.js";
import { leerJson } from "../../src/lib/proyecto.js";
import { inventario, type ClipInventario } from "../../src/pasos/inventario.js";
import { LIMITE, crearProyectoDePrueba } from "../lib/fixtures.js";

test("inventario: una grilla de capturas por clip, sin perder las descripciones", LIMITE, async () => {
  const p = await crearProyectoDePrueba();
  const primero = await inventario(p, () => {});
  assert.deepEqual(primero.map((c) => c.archivo), ["con-audio.mp4", "horizontal.mp4", "vertical.mov"]);

  const vertical = primero.find((c) => c.archivo === "vertical.mov")!;
  assert.deepEqual(vertical.momentosCaptura, [0.5, 1.5, 2.5, 3.5]);
  const grilla = await info(path.join(p.edit, vertical.captura));
  assert.equal(grilla.alto, CAPTURAS.alto);
  assert.ok(primero.every((c) => Array.isArray(c.conVoz)));

  // Las capturas horizontales van en menos columnas
  const horizontal = primero.find((c) => c.archivo === "horizontal.mp4")!;
  assert.ok((await info(path.join(p.edit, horizontal.captura))).alto! > CAPTURAS.alto);

  // Si se vuelve a correr, las descripciones escritas se conservan
  const conDescripcion = primero.map((c) => ({ ...c, descripcion: `clip ${c.archivo}` }));
  writeFileSync(p.inventario, JSON.stringify(conDescripcion));
  await inventario(p, () => {});
  const segundo = leerJson<ClipInventario[]>(p.inventario);
  assert.equal(segundo.find((c) => c.archivo === "vertical.mov")!.descripcion, "clip vertical.mov");
  assert.ok(!existsSync(path.join(p.capturas, ".tmp")));
});
