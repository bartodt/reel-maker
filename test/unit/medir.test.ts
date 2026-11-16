import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ErrorReel } from "../../src/lib/errores.js";
import { leerJson } from "../../src/lib/proyecto.js";
import { leerReferencias } from "../../src/lib/referencias.js";
import { medir } from "../../src/pasos/medir.js";

const casaGiro = leerReferencias().find((r) => r.nombre === "casa-giro")!;
const callado = () => {};

function corrida(planes: Record<string, string>) {
  const raiz = mkdtempSync(path.join(tmpdir(), "reel-corrida-"));
  for (const [referencia, contenido] of Object.entries(planes)) {
    mkdirSync(path.join(raiz, referencia, "edit"), { recursive: true });
    writeFileSync(path.join(raiz, referencia, "edit", "plan.json"), contenido);
  }
  return raiz;
}

test("una referencia sin plan sale como sin plan y no cuenta en el promedio", async () => {
  const raiz = corrida({ "casa-giro": readFileSync(casaGiro.archivoPlan, "utf8") });
  await medir(raiz, callado);

  const perfecto = { mismoContenido: 1, mismoClip: 1, mismoMomento: 1, cortes: 1 };
  assert.deepEqual(leerJson(path.join(raiz, "medicion.json")), {
    referencias: leerReferencias().map(({ nombre }) =>
      nombre === "casa-giro" ? { referencia: nombre, ...perfecto } : { referencia: nombre, sinPlan: true },
    ),
    promedio: { ...perfecto, referenciasMedidas: 1 },
  });
});

const tramo = { desde: 0, hasta: 2, clip: "a.mov", arrancaEn: 0 };
const planesMalArmados: [string, unknown, string][] = [
  ["un JSON cortado", '{ "tramos": [', "no es un JSON válido"],
  ["un tramo vacío", { tramos: [null] }, "Tramo 1: no es un tramo"],
  ["un desde con texto", { tramos: [{ ...tramo, desde: "x" }] }, '"desde" y "hasta" tienen que ser números'],
  ["un tramo sin clip", { tramos: [{ ...tramo, clip: undefined }] }, 'falta "clip"'],
];

for (const [caso, plan, problema] of planesMalArmados) {
  test(`un plan con ${caso} da un error que nombra la referencia y el problema, sin medir`, async () => {
    const raiz = corrida({ "casa-giro": typeof plan === "string" ? plan : JSON.stringify(plan) });
    await assert.rejects(
      medir(raiz, callado),
      (e) => e instanceof ErrorReel && e.message.startsWith("casa-giro:") && e.message.includes(problema),
    );
    assert.equal(existsSync(path.join(raiz, "medicion.json")), false);
  });
}

test("si falta el plan de una referencia o la tabla, avisa con un error que se entiende", async () => {
  const raiz = corrida({ "casa-giro": readFileSync(casaGiro.archivoPlan, "utf8") });
  const sinArchivo = { ...casaGiro, archivoPlan: path.join(raiz, "no-existe.json") };
  await assert.rejects(
    medir(raiz, callado, [sinArchivo]),
    (e) => e instanceof ErrorReel && e.message.startsWith("casa-giro: No encuentro el plan de referencia"),
  );
  assert.throws(() => leerReferencias(path.join(raiz, "no-existe.json")), (e) => e instanceof ErrorReel && e.message.includes("No encuentro"));
});

test("una corrida sin ningún plan avisa y no escribe nada", async () => {
  const raiz = corrida({});
  await assert.rejects(medir(raiz, callado), ErrorReel);
  assert.equal(existsSync(path.join(raiz, "medicion.json")), false);
});
