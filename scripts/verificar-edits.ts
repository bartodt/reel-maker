// Prueba contra Edits real. Cuándo y cómo correrla: .claude/skills/verify-edits/SKILL.md
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cargarEnv, expandirCasa } from "../src/lib/entorno.js";
import { conectarConEdits, ErrorDeEdits, type Edits, type IdDeProyecto, type ProyectoDeEdits } from "../src/lib/edits.js";
import { ErrorReel } from "../src/lib/errores.js";
import { ffmpeg } from "../src/lib/ffmpeg.js";
import { armarMontaje, diferenciasConEdits } from "../src/lib/montaje.js";
import type { Plan } from "../src/lib/plan.js";
import { abrirProyecto, guardarJson, leerJson } from "../src/lib/proyecto.js";
import type { Palabra } from "../src/lib/transcripcion.js";
import { carpetaParaEdits, mandarAEdits } from "../src/pasos/edits.js";

const MATERIAL = expandirCasa("~/reels/pancho-y-coca-prueba");
const PRUEBAS = expandirCasa("~/reels/_verificacion/verificar-edits");
const FIN_DE_LA_VOZ = 6.288;
const CANDADO = expandirCasa("~/.reel-maker-edits.lock");
const ESPERA_POR_EL_CANDADO = { cadaSegundos: 30, intentos: 60 };

const PLAN: Plan = {
  tramos: [
    { duracion: 0.97, clip: "IMG_0672.MOV", arrancaEn: 3, texto: "El Pancho\ny la Coca" },
    { desde: 0, hasta: 1.165, clip: "IMG_0655.MOV", arrancaEn: 48.17 },
    { desde: 1.165, hasta: 2.682, clip: "IMG_0638.MOV", arrancaEn: 7.3 },
    { duracion: 1.75, clip: "IMG_0638.MOV", arrancaEn: 8.817, audioDelClip: true, texto: "SÁCATE\nLAS GANAS" },
    { desde: 2.682, hasta: 3.815, clip: "IMG_0635.MOV", arrancaEn: 1.433 },
    { desde: 3.815, hasta: FIN_DE_LA_VOZ, clip: "IMG_0671.MOV", arrancaEn: 1.7, velocidad: 1.15 },
    { duracion: 1.5, clip: "IMG_0642.MOV", arrancaEn: 6.8, velocidad: 0, logo: true },
  ],
};

async function armarReelDePrueba(titulo: string) {
  for (const f of ["clips", "referencia/logo.png", "edit/voz-limpia.wav", "edit/transcripcion.json"].map((f) => path.join(MATERIAL, f))) {
    if (!existsSync(f)) throw new ErrorReel(`Para la prueba falta ${f} (el material de Pancho y Coca).`);
  }
  const raiz = path.join(PRUEBAS, titulo);
  mkdirSync(path.join(raiz, "edit"), { recursive: true });
  symlinkSync(path.join(MATERIAL, "clips"), path.join(raiz, "clips"));
  copyFileSync(path.join(MATERIAL, "referencia/logo.png"), path.join(raiz, "logo.png"));
  await ffmpeg(["-i", path.join(MATERIAL, "edit/voz-limpia.wav"), "-t", String(FIN_DE_LA_VOZ), path.join(raiz, "edit/voz-limpia.wav")]);
  const { words } = leerJson<{ words: Palabra[] }>(path.join(MATERIAL, "edit/transcripcion.json"));
  guardarJson(path.join(raiz, "edit/transcripcion.json"), { words: words.filter((w) => w.end <= FIN_DE_LA_VOZ) });
  guardarJson(path.join(raiz, "edit/plan.json"), PLAN);
  return abrirProyecto(raiz);
}

async function loAbiertoEsDeLaPrueba(edits: Edits, pantalla: "cargando" | "editor", titulo: string, antes: Set<IdDeProyecto>) {
  // En "cargando" Edits solo deja preguntar la pantalla y cerrar, y lo único que puede estar abriendo es lo que la prueba acaba de crear
  if (pantalla === "cargando") return true;
  const abierto = await edits.titulo();
  return abierto === titulo || (await edits.proyectos()).some((x) => x.nombre === abierto && !antes.has(x.id));
}

async function cerrarElDeLaPrueba(edits: Edits, titulo: string, antes: Set<IdDeProyecto>) {
  const pantalla = await edits.pantalla();
  if (pantalla === "inicio") return undefined;
  if (!(await loAbiertoEsDeLaPrueba(edits, pantalla, titulo, antes))) {
    throw new ErrorReel("En Edits quedó abierto un proyecto que no es de la prueba. No lo toqué.");
  }
  const cerrado = await edits.cerrarProyecto();
  if (cerrado && antes.has(cerrado)) throw new ErrorReel(`Cerré en Edits un proyecto que ya existía antes de la prueba (${cerrado}). No lo borré.`);
  return cerrado;
}

/** La lista de projects tarda en ponerse al día después de closeProject: un proyecto borrado puede volver a aparecer. */
async function borrarProyectoDePrueba(edits: Edits, titulo: string, antes: Set<IdDeProyecto>, armado: IdDeProyecto | undefined) {
  const nuestros = new Set([armado, await cerrarElDeLaPrueba(edits, titulo, antes)]);
  let nuevos: ProyectoDeEdits[] = [];
  let seguidasSinVer = 0;
  for (let vuelta = 0; vuelta < 30 && seguidasSinVer < 2; vuelta++) {
    nuevos = (await edits.proyectos()).filter((x) => !antes.has(x.id));
    const quedan = nuevos.filter((x) => nuestros.has(x.id));
    seguidasSinVer = quedan.length ? 0 : seguidasSinVer + 1;
    for (const x of quedan) await edits.borrarProyecto(x.id).catch(() => {});
    await new Promise((listo) => setTimeout(listo, 500));
  }
  if (seguidasSinVer < 2) throw new ErrorReel(`No pude borrar el proyecto de prueba "${titulo}" de Edits.`);
  if (nuevos.length) {
    const cuales = nuevos.map((x) => `"${x.nombre}" (${x.id})`).join(", ");
    throw new ErrorReel(`En Edits quedó un proyecto nuevo que la prueba no reconoce: ${cuales}. Si es de la prueba, borralo a mano.`);
  }
  rmSync(path.join(carpetaParaEdits(), titulo), { recursive: true, force: true });
}

function avisar(e: unknown) {
  if (!(e instanceof ErrorReel)) throw e;
  console.error(e.message);
  if (e instanceof ErrorDeEdits) console.error(`Detalle: ${e.motivo}`);
  process.exitCode = 1;
}

async function limpiarSinTaparOtroError(edits: Edits, titulo: string, antes: Set<IdDeProyecto>, armado: IdDeProyecto | undefined) {
  try {
    await borrarProyectoDePrueba(edits, titulo, antes, armado);
    console.log("Proyecto de prueba borrado");
  } catch (e) {
    avisar(e);
  }
}

async function verificar(soloRevisar: boolean) {
  const edits = await conectarConEdits();
  if ((await edits.pantalla()) !== "inicio") {
    throw new ErrorReel("En Edits hay un proyecto abierto. Volvé a la pantalla de inicio de Edits y probá de nuevo. La prueba no tocó nada.");
  }
  console.log("Edits responde");
  if (soloRevisar) return;

  const titulo = `prueba-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const antes = new Set((await edits.proyectos()).map((x) => x.id));
  const p = await armarReelDePrueba(titulo);
  let armado: IdDeProyecto | undefined;
  let diferencias: string[] = [];
  try {
    armado = (await mandarAEdits(p)).proyecto;
    const m = armarMontaje(PLAN);
    const { words } = leerJson<{ words: Palabra[] }>(p.transcripcion);
    diferencias = diferenciasConEdits(m, await edits.elementos(), await edits.subtitulos(), words, PLAN.tramos);
    if (diferencias.length === 0) console.log("Coincide con el plan");
    else console.log(["No coincide con el plan:", ...diferencias.map((d) => `  ${d}`)].join("\n"));

    const carpeta = path.join(p.edit, "verificacion");
    mkdirSync(carpeta, { recursive: true });
    const medio = (x: { inicio: number; fin: number }) => Math.round(((x.inicio + x.fin) / 2) * 100) / 100;
    const momentos = [medio(m.planos[0]), medio(m.planos[4]), medio(m.logos[0])];
    for (const [i, t] of momentos.entries()) writeFileSync(path.join(carpeta, `cuadro-${i + 1}-${t}s.jpg`), await edits.cuadro(t));
    console.log(`Cuadros en edit/verificacion/ (${carpeta})`);
  } finally {
    await limpiarSinTaparOtroError(edits, titulo, antes, armado);
  }
  if (diferencias.length) throw new ErrorReel("Edits no armó el reel como dice el plan.");
}

async function conElCandado(prueba: () => Promise<void>) {
  const dueno = () => (existsSync(path.join(CANDADO, "dueno")) ? readFileSync(path.join(CANDADO, "dueno"), "utf8").trim() : "no dice quién");
  for (let intento = 1; ; intento++) {
    try {
      mkdirSync(CANDADO);
      break;
    } catch (e) {
      if (!(e instanceof Error && "code" in e && e.code === "EEXIST")) throw e;
      if (intento === 1) console.log(`Otra prueba está usando Edits (${dueno()}). Espero a que termine.`);
      if (intento === ESPERA_POR_EL_CANDADO.intentos) {
        throw new ErrorReel(`Edits sigue ocupado por otra prueba (${dueno()}). Si ya no está corriendo, pedile al operador que borre ${CANDADO}.`);
      }
      await new Promise((listo) => setTimeout(listo, ESPERA_POR_EL_CANDADO.cadaSegundos * 1000));
    }
  }
  writeFileSync(path.join(CANDADO, "dueno"), `verificar-edits (proceso ${process.pid}) ${new Date().toString()}\n`);
  const soltar = () => rmSync(CANDADO, { recursive: true, force: true });
  const alCortar = (senal: NodeJS.Signals) => {
    soltar();
    process.kill(process.pid, senal);
  };
  process.once("SIGINT", alCortar);
  process.once("SIGTERM", alCortar);
  try {
    await prueba();
  } finally {
    soltar();
  }
}

cargarEnv();
try {
  if (process.argv.includes("--revisar")) await verificar(true);
  else await conElCandado(() => verificar(false));
} catch (e) {
  avisar(e);
}
