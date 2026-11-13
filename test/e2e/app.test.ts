// La app de punta a punta: crear un reel, subir material, editar los cortes, deshacer y crear el reel.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, renameSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { crearServidor } from "../../src/ui/servidor.js";
import { PLAN_VALIDO, crearProyectoDePrueba, escribirPlan } from "../lib/fixtures.js";

const base = mkdtempSync(path.join(tmpdir(), "reels-app-"));
const servidor = crearServidor({ carpetaReels: base });
let url = "";
let raiz = "";

before(async () => {
  const p = await crearProyectoDePrueba();
  raiz = path.join(base, "prueba");
  renameSync(p.raiz, raiz);
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  url = `http://localhost:${(servidor.address() as AddressInfo).port}`;
});

after(() => servidor.close());

async function pedir(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; encabezados?: Record<string, string>; datos?: Buffer } = {}) {
  const r = await fetch(url + ruta, {
    method: opciones.metodo ?? "GET",
    headers: { "x-reel": "1", ...(opciones.cuerpo !== undefined ? { "content-type": "application/json" } : {}), ...opciones.encabezados },
    body: opciones.datos ?? (opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined),
  });
  const tipo = r.headers.get("content-type") ?? "";
  return { estado: r.status, tipo, datos: tipo.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
}

test("lista los reels y dice qué hay instalado", async () => {
  const r = await pedir("/api/inicio");
  assert.equal(r.estado, 200);
  assert.deepEqual(r.datos.reels.map((x: { nombre: string }) => x.nombre), ["prueba"]);
  assert.equal(r.datos.ffmpeg, "ok");
});

test("no acepta cambios que no vengan de la app ni pedidos de otros sitios", async () => {
  const sinMarca = await fetch(`${url}/api/reels`, { method: "POST", body: JSON.stringify({ titulo: "x" }) });
  assert.equal(sinMarca.status, 403);
  // fetch no deja cambiar el Host: se arma el pedido a mano, como lo haría una página que apunta a esta compu con otro nombre
  const otroSitio = await new Promise<number>((resolver) =>
    http.get(`${url}/api/inicio`, { headers: { host: "malo.com" } }, (r) => (r.resume(), resolver(r.statusCode ?? 0))),
  );
  assert.equal(otroSitio, 403);
  const afuera = await pedir("/api/reels/prueba/archivo/..%2F..%2Fetc%2Fpasswd");
  assert.equal(afuera.estado, 400);
  const otroReel = await pedir("/api/reels/..%2Fprueba");
  assert.equal(otroReel.estado, 400);
});

test("crea un reel nuevo y sube videos sin pisar ninguno", async () => {
  const nuevo = await pedir("/api/reels", { metodo: "POST", cuerpo: { titulo: "Café nuevo" } });
  assert.equal(nuevo.datos.nombre, "cafe-nuevo");
  assert.ok(existsSync(path.join(base, "cafe-nuevo", "clips")));

  const video = readFileSync(path.join(raiz, "clips", "vertical.mov"));
  const subir = (nombre: string, tipo = "clip") =>
    pedir(`/api/reels/cafe-nuevo/subir?${new URLSearchParams({ tipo, nombre })}`, { metodo: "PUT", datos: video });
  assert.equal((await subir("../../playa.mov")).datos.archivo, "playa.mov");
  assert.equal((await subir("playa.mov")).datos.archivo, "playa (2).mov");
  assert.equal((await subir("foto.png")).estado, 400);
  assert.ok(existsSync(path.join(base, "cafe-nuevo", "clips", "playa (2).mov")));

  const reel = await pedir("/api/reels/cafe-nuevo");
  assert.equal(reel.datos.material.clips.length, 2);
  assert.equal(reel.datos.etapa, "material"); // falta la voz

  // La voz puede venir en formatos menos comunes (.mpeg, .opus de WhatsApp, .caf del iPhone...)
  assert.equal((await subir("mi voz.mpeg", "voz")).datos.archivo, "voz.mpeg");
  assert.equal((await pedir("/api/reels/cafe-nuevo")).datos.material.voz.archivo, "voz.mpeg");
});

test("muestra el plan con la frase de cada plano, y se edita y deshace", async () => {
  escribirPlan(raiz, PLAN_VALIDO);
  const reel = await pedir("/api/reels/prueba");
  assert.equal(reel.datos.validacion.ok, true);
  assert.equal(reel.datos.plan.tramos[0].frase, "Hola esto es una prueba.");
  assert.equal(reel.datos.plan.hayAnterior, false);

  const partido = await pedir("/api/reels/prueba/plan", { metodo: "POST", cuerpo: { op: "partir", indice: 0, segundo: 1.2 } });
  assert.equal(partido.datos.plan.tramos.length, 3);
  assert.equal(partido.datos.plan.hayAnterior, true);
  assert.equal(partido.datos.validacion.ok, true);

  const mal = await pedir("/api/reels/prueba/plan", { metodo: "POST", cuerpo: { op: "corte", indice: 2, segundo: 1 } });
  assert.equal(mal.estado, 400);
  assert.match(mal.datos.error, /voz/);

  const deshecho = await pedir("/api/reels/prueba/deshacer", { metodo: "POST", cuerpo: {} });
  assert.equal(deshecho.datos.plan.tramos.length, 2);
  assert.equal(deshecho.datos.plan.hayAnterior, false);

  // Un cambio que deja todo igual no ensucia el historial
  const igual = await pedir("/api/reels/prueba/plan", { metodo: "POST", cuerpo: { op: "cambiar", indice: 0, cambios: { arrancaEn: 1 } } });
  assert.equal(igual.datos.plan.hayAnterior, false);
});

test("sirve cuadros de los videos y pedazos de archivos", async () => {
  const cuadro = await pedir("/api/reels/prueba/cuadro?archivo=clips/horizontal.mp4&t=1&vertical=1&encuadre=izquierda&alto=320");
  assert.equal(cuadro.estado, 200);
  assert.equal(cuadro.tipo, "image/jpeg");

  const pedazo = await pedir("/api/reels/prueba/archivo/clips/vertical.mov", { encabezados: { range: "bytes=0-99" } });
  assert.equal(pedazo.estado, 206);
  assert.equal((pedazo.datos as Buffer).length, 100);
});

test("crea el reel y después sabe si los cortes cambiaron", async () => {
  await pedir("/api/reels/prueba/render", { metodo: "POST", cuerpo: {} });
  let trabajo;
  for (let i = 0; i < 120; i++) {
    trabajo = (await pedir("/api/reels/prueba/huella")).datos.trabajo;
    if (trabajo?.estado !== "corriendo") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(trabajo.estado, "listo", trabajo.error);

  let reel = await pedir("/api/reels/prueba");
  assert.equal(reel.datos.pasos.final, true);
  assert.equal(reel.datos.pasos.finalViejo, false);
  assert.ok(existsSync(path.join(raiz, "edit", "final-plan.json")));

  // Cambiar y deshacer deja el plan igual: el reel sigue al día
  await pedir("/api/reels/prueba/plan", { metodo: "POST", cuerpo: { op: "cambiar", indice: 1, cambios: { velocidad: 2 } } });
  reel = await pedir("/api/reels/prueba");
  assert.equal(reel.datos.pasos.finalViejo, true);
  await pedir("/api/reels/prueba/deshacer", { metodo: "POST", cuerpo: {} });
  reel = await pedir("/api/reels/prueba");
  assert.equal(reel.datos.pasos.finalViejo, false);
});
