// Prueba contra Edits real. Cuándo y cómo correrla: .claude/skills/verify-edits/SKILL.md
import { copyFileSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cargarEnv, expandirCasa } from "../src/lib/entorno.js";
import { conectarConEdits, ErrorDeEdits, type Edits, type IdDeProyecto } from "../src/lib/edits.js";
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

/** La lista de projects de Edits tarda en ponerse al día después de closeProject: un proyecto borrado puede volver a aparecer. */
async function borrarProyectoDePrueba(edits: Edits, titulo: string, antes: Set<IdDeProyecto>) {
  if ((await edits.pantalla()) !== "inicio" && (await edits.titulo()) === titulo) await edits.cerrarProyecto();
  let seguidasSinVer = 0;
  for (let vuelta = 0; vuelta < 30 && seguidasSinVer < 2; vuelta++) {
    const nuestros = (await edits.proyectos()).filter((x) => x.nombre === titulo && !antes.has(x.id));
    seguidasSinVer = nuestros.length ? 0 : seguidasSinVer + 1;
    for (const x of nuestros) await edits.borrarProyecto(x.id).catch(() => {});
    await new Promise((listo) => setTimeout(listo, 500));
  }
  if (seguidasSinVer < 2) throw new ErrorReel(`No pude borrar el proyecto de prueba "${titulo}" de Edits.`);
  rmSync(path.join(carpetaParaEdits(), titulo), { recursive: true, force: true });
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
  let diferencias: string[] = [];
  try {
    await mandarAEdits(p);
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
    await borrarProyectoDePrueba(edits, titulo, antes);
    console.log("Proyecto de prueba borrado");
  }
  if (diferencias.length) throw new ErrorReel("Edits no armó el reel como dice el plan.");
}

cargarEnv();
try {
  await verificar(process.argv.includes("--revisar"));
} catch (e) {
  if (!(e instanceof ErrorReel)) throw e;
  console.error(e.message);
  if (e instanceof ErrorDeEdits) console.error(`Detalle: ${e.motivo}`);
  process.exitCode = 1;
}
