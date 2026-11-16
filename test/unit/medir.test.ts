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
    referencias: [
      { referencia: "pancho-y-coca", sinPlan: true },
      { referencia: "casa-giro", ...perfecto },
    ],
    promedio: { ...perfecto, referenciasMedidas: 1 },
  });
});

test("un plan roto da un error que nombra la referencia", async () => {
  const raiz = corrida({ "casa-giro": '{ "tramos": [' });
  await assert.rejects(medir(raiz, callado), (e) => e instanceof ErrorReel && e.message.startsWith("casa-giro:"));
});

test("una corrida sin ningún plan avisa y no escribe nada", async () => {
  const raiz = corrida({});
  await assert.rejects(medir(raiz, callado), ErrorReel);
  assert.equal(existsSync(path.join(raiz, "medicion.json")), false);
});
