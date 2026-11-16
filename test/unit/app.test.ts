// Lógica de la app: en qué paso está un reel, nombres de carpetas y archivos, qué está haciendo Claude y el interruptor de subtítulos.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { describirHerramienta, entornoParaClaude, leerLinea, leerSesion } from "../../src/lib/actividad.js";
import { etapaActual, pasosHechos, type Archivos } from "../../src/lib/estado.js";
import { nombreDeArchivoSeguro, nombreDeCarpeta, nombreLibre, tituloDeCarpeta } from "../../src/lib/nombres.js";
import { abrirProyecto } from "../../src/lib/proyecto.js";
import { deshacer, ponerSubtitulos } from "../../src/ui/reels.js";
import { PLAN_VALIDO, escribirPlan } from "../lib/fixtures.js";

const COMPLETO: Archivos = {
  clips: ["a.mov", "b.mov"],
  voz: { nombre: "voz.wav", modificado: 1000 },
  vozLimpia: { modificado: 2000, original: "voz.wav" },
  transcripcion: 3000,
  inventario: { modificado: 3000, clips: ["a.mov", "b.mov"] },
  plan: 4000,
  final: 5000,
};

test("un reel con todo hecho está listo", () => {
  const p = pasosHechos(COMPLETO);
  assert.deepEqual(p, { material: true, limpio: true, transcripto: true, inventario: true, plan: true, final: true, finalViejo: false });
  assert.equal(etapaActual(p, true), "listo");
  assert.equal(etapaActual(p, false), "cortes");
});

test("sin videos o sin voz falta material", () => {
  assert.equal(etapaActual(pasosHechos({ clips: [] }), false), "material");
  assert.equal(etapaActual(pasosHechos({ ...COMPLETO, voz: undefined }), true), "material");
});

test("si cambia la voz hay que limpiarla y transcribirla de nuevo", () => {
  const nueva = pasosHechos({ ...COMPLETO, voz: { nombre: "voz.wav", modificado: 9000 } });
  assert.equal(nueva.limpio, false);
  assert.equal(nueva.transcripto, false);
  const otroArchivo = pasosHechos({ ...COMPLETO, voz: { nombre: "voz.mp3", modificado: 1000 } });
  assert.equal(otroArchivo.limpio, false);
  // Copiar un archivo puede correr la fecha un poquito: eso no cuenta como cambio
  assert.equal(pasosHechos({ ...COMPLETO, voz: { nombre: "voz.wav", modificado: 2500 } }).limpio, true);
});

test("si se agrega un video hay que volver a mirarlos", () => {
  const p = pasosHechos({ ...COMPLETO, clips: ["a.mov", "b.mov", "c.mov"] });
  assert.equal(p.inventario, false);
  assert.equal(etapaActual(p, true), "preparar");
});

test("si el plan cambió después del reel terminado, hay que volver a crearlo", () => {
  const p = pasosHechos({ ...COMPLETO, plan: 9000 });
  assert.equal(p.finalViejo, true);
  assert.equal(etapaActual(p, true), "reel");
});

test("si se sabe con qué plan se creó el reel, se compara el contenido y no la fecha", () => {
  // Cambió y después se deshizo: la fecha es nueva pero el plan es el mismo
  assert.equal(pasosHechos({ ...COMPLETO, plan: 9000, planIgualAlDelFinal: true }).finalViejo, false);
  assert.equal(pasosHechos({ ...COMPLETO, plan: 4000, planIgualAlDelFinal: false }).finalViejo, true);
});

test("nombres de carpeta a partir del título", () => {
  assert.equal(nombreDeCarpeta("Café de la Esquina!"), "cafe-de-la-esquina");
  assert.equal(nombreDeCarpeta("  ¿¿??  "), "");
  assert.equal(nombreDeCarpeta("a".repeat(80)).length, 60);
  assert.equal(tituloDeCarpeta("cafe-de-la-esquina"), "Cafe de la esquina");
});

test("los archivos subidos no se pueden salir de su carpeta ni pisar otros", () => {
  assert.equal(nombreDeArchivoSeguro("../../etc/passwd"), "passwd");
  assert.equal(nombreDeArchivoSeguro("C:\\fotos\\playa.mov"), "playa.mov");
  assert.equal(nombreDeArchivoSeguro(".oculto.mov"), "oculto.mov");
  assert.equal(nombreDeArchivoSeguro(""), "archivo");
  const hay = new Set(["playa.mov", "playa (2).mov"]);
  assert.equal(nombreLibre("playa.mov", (n) => hay.has(n)), "playa (3).mov");
  assert.equal(nombreLibre("cafe.mov", (n) => hay.has(n)), "cafe.mov");
});

test("lo que hace Claude se cuenta en palabras simples", () => {
  assert.equal(describirHerramienta("Read", { file_path: "/r/edit/capturas/playa.jpg" }), "Mirando el video playa");
  assert.equal(describirHerramienta("Write", { file_path: "/r/edit/plan.json" }), "Escribiendo los cortes");
  assert.equal(describirHerramienta("Bash", { command: "npm run validar -- /r" }), "Revisando que los cortes cierren");
  assert.equal(describirHerramienta("Glob", {}), undefined);

  const mensaje = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "..." }, { type: "tool_use", name: "Read", input: { file_path: "/r/guion.md" } }] },
  });
  assert.deepEqual(leerLinea(mensaje), { actividades: ["Leyendo el guion"] });
  assert.deepEqual(leerLinea(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: " Listo. " })), {
    actividades: [],
    resultado: { texto: "Listo.", error: false },
  });
  assert.equal(leerLinea(JSON.stringify({ type: "result", subtype: "error_max_turns" })).resultado?.error, true);
  assert.deepEqual(leerLinea("esto no es json"), { actividades: [] });
});

test("Claude se llama sin colgarse de otra sesión de Claude Code", () => {
  const entorno = entornoParaClaude(
    {
      HOME: "/Users/x",
      PATH: "/bin",
      ANTHROPIC_API_KEY: "clave",
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "abc",
      CLAUDE_AGENT_SDK_VERSION: "1",
    },
    process.execPath,
  );
  assert.equal(entorno.CLAUDECODE, undefined);
  assert.equal(entorno.CLAUDE_CODE_SESSION_ID, undefined);
  assert.equal(entorno.CLAUDE_AGENT_SDK_VERSION, undefined);
  assert.equal(entorno.ANTHROPIC_API_KEY, "clave");
});

test("los comandos de Claude usan el Node de la app aunque haya otro antes en PATH", () => {
  const viejo = mkdtempSync(path.join(tmpdir(), "reel-node-viejo-"));
  writeFileSync(path.join(viejo, "node"), "#!/bin/sh\necho v16\n", { mode: 0o755 });
  const entorno = entornoParaClaude({ PATH: `${viejo}:/usr/bin:/bin` }, process.execPath);
  const version = execFileSync("/bin/sh", ["-c", '. "$CLAUDE_ENV_FILE"; node -v'], { env: entorno, encoding: "utf8" });
  assert.equal(version.trim(), process.version);
});

test("sabe si Claude tiene la sesión iniciada", () => {
  assert.equal(leerSesion('{"loggedIn": false, "authMethod": "none"}'), false);
  assert.equal(leerSesion('{"loggedIn": true}'), true);
  assert.equal(leerSesion("Usage: claude ..."), true); // versión vieja sin "auth status": se prueba igual
});

test("el interruptor de subtítulos cambia el plan y se puede deshacer", () => {
  const p = abrirProyecto(mkdtempSync(path.join(tmpdir(), "reel-subtitulos-")));
  escribirPlan(p.raiz, PLAN_VALIDO);
  const plan = () => JSON.parse(readFileSync(p.plan, "utf8"));

  ponerSubtitulos(p, true);
  assert.throws(() => deshacer(p), /nada para deshacer/, "si no cambió nada, no deja nada para deshacer");

  ponerSubtitulos(p, false);
  assert.equal(plan().subtitulos, false);
  assert.deepEqual(plan().tramos, PLAN_VALIDO.tramos);
  deshacer(p);
  assert.ok(!("subtitulos" in plan()));
  assert.throws(() => deshacer(p), /nada para deshacer/);

  ponerSubtitulos(p, false);
  ponerSubtitulos(p, true);
  assert.ok(!("subtitulos" in plan()), "prendidos es lo que viene por defecto: no hace falta anotarlo");
});
