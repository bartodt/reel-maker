// Corrida a ciegas. Cómo y cuándo usarla: referencias/README.md, "Cómo correr una prueba".
import { execFileSync, spawn } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { entornoParaClaude } from "../src/lib/actividad.js";
import { expandirCasa, RAIZ_REPO } from "../src/lib/entorno.js";
import { ErrorReel } from "../src/lib/errores.js";
import { abrirProyecto, EXT_AUDIO, type Proyecto } from "../src/lib/proyecto.js";
import { leerReferencias, type FichaReferencia } from "../src/lib/referencias.js";
import { inventario } from "../src/pasos/inventario.js";
import { medir } from "../src/pasos/medir.js";
import { validar } from "../src/pasos/validar.js";
import { permisosParaClaude, promptParaClaude } from "../src/ui/trabajos.js";

const ESTILO_SIN_EJEMPLOS = expandirCasa("~/reels/pancho-y-coca-prueba/b-con-estilo/estilo.md");
const OCULTO_A_CLAUDE = ["referencias/", "docs/", "test/", "scripts/", ".github/", ".claude/skills/verify-edits/"];
const DELATAN_LA_RESPUESTA = /referencias|Downloads|plan-pasos/;
const DE_LA_VOZ = ["voz-limpia.wav", "voz-cortes.json", "transcripcion.json", "transcripcion.md"];
const callado = () => {};

function copiarSiFalta(desde: string, hacia: string) {
  if (!existsSync(desde)) throw new ErrorReel(`No encuentro ${desde}`);
  if (!existsSync(hacia)) copyFileSync(desde, hacia);
}

function armarRepoACiegas(destino: string) {
  if (existsSync(destino)) return;
  const temporal = `${destino}.tmp`;
  rmSync(temporal, { recursive: true, force: true });
  const archivos = execFileSync("git", ["ls-files"], { cwd: RAIZ_REPO, encoding: "utf8" })
    .split("\n")
    .filter((a) => a && !OCULTO_A_CLAUDE.some((c) => a.startsWith(c)) && existsSync(path.join(RAIZ_REPO, a)));
  for (const a of archivos) {
    mkdirSync(path.dirname(path.join(temporal, a)), { recursive: true });
    copyFileSync(path.join(RAIZ_REPO, a), path.join(temporal, a));
  }
  copyFileSync(ESTILO_SIN_EJEMPLOS, path.join(temporal, ".claude", "skills", "reel", "estilo.md"));
  symlinkSync(path.join(RAIZ_REPO, "node_modules"), path.join(temporal, "node_modules"));
  renameSync(temporal, destino);
}

async function armarCarpeta(f: FichaReferencia, destino: string): Promise<Proyecto> {
  mkdirSync(path.join(destino, "edit"), { recursive: true });
  if (!existsSync(path.join(destino, "clips"))) symlinkSync(path.join(f.carpeta, "clips"), path.join(destino, "clips"));
  const voz = readdirSync(f.carpeta).find((a) => path.parse(a).name === "voz" && EXT_AUDIO.includes(path.extname(a).toLowerCase()));
  if (!voz) throw new ErrorReel(`${f.nombre}: no hay voz en ${f.carpeta}`);
  copiarSiFalta(path.join(f.carpeta, voz), path.join(destino, voz));
  if (f.logo) copiarSiFalta(f.logo, path.join(destino, "logo.png"));
  if (f.guion) copiarSiFalta(f.guion, path.join(destino, "guion.md"));
  for (const a of DE_LA_VOZ) copiarSiFalta(path.join(f.carpeta, "edit", a), path.join(destino, "edit", a));

  const p = abrirProyecto(destino);
  try {
    await validar({ ...p, plan: f.archivoPlan }, callado);
  } catch (e) {
    if (e instanceof ErrorReel) throw new ErrorReel(`${f.nombre}: el plan real no pasa la validación en ${destino}:\n${e.message}`);
    throw e;
  }
  if (!existsSync(p.inventario)) await inventario(p, callado);
  return p;
}

function pedirElPlan(p: Proyecto, repo: string, registro: string): Promise<number | null> {
  const permisos = permisosParaClaude(p).filter((r) => !r.includes("estilo.md"));
  const args = ["-p", promptParaClaude(p, { modo: "armar", ritmo: "tranquilo" }), "--output-format", "stream-json", "--verbose", "--add-dir", p.raiz, "--allowedTools", ...permisos];
  const salida = openSync(registro, "w");
  return new Promise((resolver, rechazar) => {
    const proceso = spawn("claude", args, { cwd: repo, env: entornoParaClaude(process.env), stdio: ["ignore", salida, salida] });
    proceso.on("error", rechazar);
    proceso.on("close", (codigo) => {
      closeSync(salida);
      resolver(codigo);
    });
  });
}

interface Bloque {
  type?: string;
  name?: string;
  input?: unknown;
}

function leerRegistro(registro: string, permitidas: string[]) {
  const resumen = { modelo: "?", minutos: 0, error: true, fuera: new Set<string>() };
  for (const linea of readFileSync(registro, "utf8").split("\n")) {
    let e: { type?: string; subtype?: string; model?: string; is_error?: boolean; duration_ms?: number; message?: { content?: Bloque[] } };
    try {
      e = JSON.parse(linea);
    } catch {
      continue;
    }
    if (e.type === "system" && e.subtype === "init" && e.model) resumen.modelo = e.model;
    if (e.type === "result") {
      resumen.error = e.is_error === true || e.subtype !== "success";
      resumen.minutos = (e.duration_ms ?? 0) / 60_000;
    }
    for (const b of e.type === "assistant" ? (e.message?.content ?? []) : []) {
      if (b.type !== "tool_use") continue;
      const entrada = JSON.stringify(b.input ?? {});
      if (DELATAN_LA_RESPUESTA.test(entrada)) resumen.fuera.add(`${b.name}: ${entrada}`);
      for (const ruta of entrada.match(/(?:~|\/Users|\/private|\/tmp|\/Volumes)[^\s"'`,;)]*/g) ?? []) {
        if (!permitidas.some((r) => ruta.startsWith(r))) resumen.fuera.add(`${b.name}: ${ruta}`);
      }
    }
  }
  return resumen;
}

async function correrUna(f: FichaReferencia, corrida: string, repo: string) {
  const empieza = Date.now();
  const p = await armarCarpeta(f, path.join(corrida, f.nombre));
  console.log(`${f.nombre}: carpeta lista en ${Math.round((Date.now() - empieza) / 1000)} s (${p.raiz})`);
  if (existsSync(p.plan)) {
    console.log(`${f.nombre}: ya tiene plan, no se le pide otro a Claude`);
    return;
  }
  mkdirSync(path.join(corrida, "claude"), { recursive: true });
  const registro = path.join(corrida, "claude", `${f.nombre}.jsonl`);
  console.log(`${f.nombre}: Claude arma el plan desde ${new Date().toISOString()} (registro en ${registro})`);
  const codigo = await pedirElPlan(p, repo, registro);
  const r = leerRegistro(registro, [p.raiz, path.join(repo, ".claude", "skills", "reel")]);
  console.log(`${f.nombre}: Claude (${r.modelo}) terminó en ${r.minutos.toFixed(1)} min${r.error || codigo !== 0 ? `, con error (código ${codigo})` : ""}`);
  console.log(r.fuera.size ? `${f.nombre}: miró fuera de su carpeta y de la skill:\n  ${[...r.fuera].join("\n  ")}` : `${f.nombre}: a ciegas, no miró nada fuera de su carpeta ni de la skill`);
  if (!existsSync(p.plan)) throw new ErrorReel(`${f.nombre}: Claude no escribió edit/plan.json. Mirá ${registro}`);
}

async function correr(carpeta: string | undefined, nombres: string[]) {
  if (!carpeta) throw new ErrorReel("Falta la carpeta de la corrida. Ejemplo: npm run corrida-a-ciegas -- ~/reels/_verificacion/corrida-1");
  const corrida = expandirCasa(carpeta);
  const todas = leerReferencias();
  const desconocidas = nombres.filter((n) => !todas.some((f) => f.nombre === n));
  if (desconocidas.length) throw new ErrorReel(`No hay referencias con esos nombres: ${desconocidas.join(", ")}. Son: ${todas.map((f) => f.nombre).join(", ")}.`);
  const fichas = todas.filter((f) => nombres.length === 0 || nombres.includes(f.nombre));

  mkdirSync(corrida, { recursive: true });
  const repo = path.join(corrida, "repo");
  armarRepoACiegas(repo);
  const fallas = (await Promise.allSettled(fichas.map((f) => correrUna(f, corrida, repo)))).filter((r) => r.status === "rejected");
  if (fallas.length) throw fallas[0].reason;

  const empieza = Date.now();
  await medir(corrida);
  console.log(`Medido en ${((Date.now() - empieza) / 1000).toFixed(1)} s`);
}

try {
  await correr(process.argv[2], process.argv.slice(3));
} catch (e) {
  if (!(e instanceof ErrorReel)) throw e;
  console.error(e.message);
  process.exitCode = 1;
}
