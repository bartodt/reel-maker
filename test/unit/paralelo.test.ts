import assert from "node:assert/strict";
import { test } from "node:test";
import { enParalelo } from "../../src/lib/paralelo.js";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("devuelve los resultados en el orden original aunque terminen desordenados", async () => {
  const r = await enParalelo([30, 10, 20], 3, async (ms) => {
    await esperar(ms);
    return ms * 2;
  });
  assert.deepEqual(r, [60, 20, 40]);
});

test("no corre más de `limite` a la vez", async () => {
  let activos = 0;
  let maximo = 0;
  await enParalelo([1, 2, 3, 4, 5, 6], 2, async () => {
    activos++;
    maximo = Math.max(maximo, activos);
    await esperar(5);
    activos--;
  });
  assert.equal(maximo, 2);
});
