// Cotas de la medida. Cómo y cuándo usarla: referencias/README.md, "Cómo correr una prueba".
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { mulberry32, cortesEnLaVoz, planAlAzar, type ClipDisponible, type Referencia } from "../src/lib/comparar.js";
import { expandirCasa } from "../src/lib/entorno.js";
import { ErrorReel } from "../src/lib/errores.js";
import { info } from "../src/lib/ffmpeg.js";
import { duracionEnPantalla, esSinVoz, type Plan, type Tramo } from "../src/lib/plan.js";
import { EXT_VIDEO, guardarJson, leerJson } from "../src/lib/proyecto.js";
import { leerReferencias, type FichaReferencia } from "../src/lib/referencias.js";
import { agruparFrases, type Palabra } from "../src/lib/transcripcion.js";
import { medir } from "../src/pasos/medir.js";

const SEMILLAS = 20;
const CADA = 0.6;
const COLUMNAS = ["mismoContenido", "mismoClip", "mismoMomento", "cortes"] as const;
type Columna = (typeof COLUMNAS)[number];

interface Material {
  ficha: FichaReferencia;
  referencia: Referencia;
  clips: ClipDisponible[];
  duracionVoz: number;
  frases: number[];
}

async function leerMaterial(ficha: FichaReferencia): Promise<Material> {
  const carpeta = path.join(ficha.carpeta, "clips");
  const archivos = readdirSync(carpeta)
    .filter((a) => EXT_VIDEO.includes(path.extname(a).toLowerCase()) && !a.startsWith("."))
    .sort();
  const clips = await Promise.all(archivos.map(async (archivo) => ({ archivo, duracion: (await info(path.join(carpeta, archivo))).duracion })));
  const referencia = leerJson<Referencia>(ficha.archivoPlan);
  const duracionVoz = Math.max(...referencia.tramos.map((t) => (esSinVoz(t) ? 0 : t.hasta)));
  const { words } = leerJson<{ words: Palabra[] }>(path.join(ficha.carpeta, "edit", "transcripcion.json"));
  const frases = agruparFrases(words).slice(1).map((f) => f.desde);
  return { ficha, referencia, clips, duracionVoz, frases };
}

function copiarPorOrdenDeFilmacion(origen: Material, destino: Material): Plan {
  const escala = destino.duracionVoz / origen.duracionVoz;
  const lugar = (archivo: string) => origen.clips.findIndex((c) => c.archivo === archivo) / Math.max(1, origen.clips.length - 1);
  const tramos = origen.referencia.tramos.map((t): Tramo => {
    const desdeOrigen = origen.clips.find((c) => c.archivo === t.clip)!;
    const clip = destino.clips[Math.round(lugar(t.clip) * (destino.clips.length - 1))];
    const tiempos = esSinVoz(t) ? { duracion: t.duracion * escala } : { desde: t.desde * escala, hasta: t.hasta * escala };
    const largo = duracionEnPantalla(t) * escala;
    const velocidad = t.velocidad === 0 ? 0 : Math.min(t.velocidad ?? 1, clip.duracion / largo);
    const arrancaEn = Math.max(0, Math.min((t.arrancaEn / desdeOrigen.duracion) * clip.duracion, clip.duracion - largo * velocidad));
    return { ...tiempos, clip: clip.archivo, arrancaEn, ...(velocidad !== 1 && { velocidad }), ...(t.logo && { logo: true }) };
  });
  return { ritmo: origen.referencia.ritmo, tramos };
}

function cortesAlAzar(m: Material, azar: () => number) {
  return Array.from({ length: cortesEnLaVoz(m.referencia.tramos).length }, () => azar() * m.duracionVoz);
}

function cadaTanto(m: Material) {
  return Array.from({ length: Math.floor(m.duracionVoz / CADA) }, (_, i) => (i + 1) * CADA);
}

function armarCorridas(materiales: Material[]): Record<string, Record<string, Plan>> {
  const corridas: Record<string, Record<string, Plan>> = {};
  const porReferencia = (nombre: string, plan: (m: Material, i: number) => Plan | undefined) => {
    corridas[nombre] = {};
    for (const [i, m] of materiales.entries()) {
      const p = plan(m, i);
      if (p) corridas[nombre][m.ficha.nombre] = p;
    }
  };
  porReferencia("techo", (m) => m.referencia);
  for (let s = 1; s <= SEMILLAS; s++) {
    porReferencia(`azar-${s}`, (m, i) => { const azar = mulberry32(s * 100 + i); return planAlAzar(m.duracionVoz, cortesAlAzar(m, azar), m.clips, azar); });
    porReferencia(`azar-con-sus-cortes-${s}`, (m, i) => planAlAzar(m.duracionVoz, cortesEnLaVoz(m.referencia.tramos), m.clips, mulberry32(s * 100 + i)));
    porReferencia(`cada-${CADA}-s-${s}`, (m, i) => planAlAzar(m.duracionVoz, cadaTanto(m), m.clips, mulberry32(s * 100 + i)));
    porReferencia(`en-cada-frase-${s}`, (m, i) => planAlAzar(m.duracionVoz, m.frases, m.clips, mulberry32(s * 100 + i)));
  }
  const masClips = Math.max(...materiales.map((m) => m.clips.length));
  for (let k = 0; k < masClips; k++) {
    porReferencia(`un-clip-${k + 1}`, (m) => (m.clips[k] ? planAlAzar(m.duracionVoz, [], [m.clips[k]], () => 0) : undefined));
  }
  const pyc = materiales.find((m) => m.ficha.nombre === "pancho-y-coca");
  const cg = materiales.find((m) => m.ficha.nombre === "casa-giro");
  if (pyc && cg) corridas["copia-pancho-y-coca"] = { "casa-giro": copiarPorOrdenDeFilmacion(pyc, cg) };
  return corridas;
}

type Fila = { referencia: string; sinPlan?: true } & Partial<Record<Columna, number>>;

function percentil(valores: number[], q: number) {
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.round(q * (v.length - 1))];
}

function resumir(medidas: Record<string, Fila[]>, materiales: Material[]) {
  const familias: [string, RegExp][] = [
    ["techo", /^techo$/],
    [`azar (${SEMILLAS} semillas)`, /^azar-\d+$/],
    [`azar con los cortes de la referencia (${SEMILLAS})`, /^azar-con-sus-cortes-/],
    [`corte cada ${CADA} s, clips al azar (${SEMILLAS})`, /^cada-/],
    [`corte en cada frase, clips al azar (${SEMILLAS})`, /^en-cada-frase-/],
    ["un solo clip, todos los clips", /^un-clip-/],
    ["copia de Pancho y Coca", /^copia-/],
  ];
  const resumen: Record<string, Record<string, Record<Columna, { p10: number; mediana: number; p90: number; mejor: number; n: number }>>> = {};
  for (const [familia, patron] of familias) {
    resumen[familia] = {};
    for (const m of materiales) {
      const filas = Object.entries(medidas)
        .filter(([nombre]) => patron.test(nombre))
        .map(([, filas]) => filas.find((f) => f.referencia === m.ficha.nombre))
        .filter((f): f is Fila => f !== undefined && !f.sinPlan);
      if (filas.length === 0) continue;
      resumen[familia][m.ficha.nombre] = Object.fromEntries(
        COLUMNAS.map((k) => {
          const v = filas.map((f) => f[k]!);
          return [k, { p10: percentil(v, 0.1), mediana: percentil(v, 0.5), p90: percentil(v, 0.9), mejor: Math.max(...v), n: v.length }];
        }),
      ) as Record<Columna, { p10: number; mediana: number; p90: number; mejor: number; n: number }>;
    }
  }
  return resumen;
}

async function correr(carpeta: string | undefined) {
  if (!carpeta) throw new ErrorReel("Falta la carpeta donde guardar las cotas. Ejemplo: npm run cotas -- ~/reels/_verificacion/cotas");
  const raiz = expandirCasa(carpeta);
  const materiales = await Promise.all(leerReferencias().map(leerMaterial));
  const corridas = armarCorridas(materiales);

  const medidas: Record<string, Fila[]> = {};
  for (const [nombre, planes] of Object.entries(corridas)) {
    const corrida = path.join(raiz, nombre);
    rmSync(corrida, { recursive: true, force: true });
    for (const [referencia, plan] of Object.entries(planes)) {
      mkdirSync(path.join(corrida, referencia, "edit"), { recursive: true });
      guardarJson(path.join(corrida, referencia, "edit", "plan.json"), plan);
    }
    medidas[nombre] = (await medir(corrida, () => {})).filas as Fila[];
  }
  const unClip = Object.fromEntries(
    materiales.map((m) => {
      const filas = m.clips.map((c, k) => ({ clip: c.archivo, ...medidas[`un-clip-${k + 1}`].find((f) => f.referencia === m.ficha.nombre) }));
      return [m.ficha.nombre, filas.sort((a, b) => (b.mismoContenido ?? 0) - (a.mismoContenido ?? 0)).slice(0, 3)];
    }),
  );
  const resumen = resumir(medidas, materiales);
  guardarJson(path.join(raiz, "cotas.json"), { resumen, mejoresDeUnClip: unClip, medidas });

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  for (const [familia, porReferencia] of Object.entries(resumen)) {
    console.log(familia);
    for (const [referencia, columnas] of Object.entries(porReferencia)) {
      const celdas = COLUMNAS.map((k) => {
        const c = columnas[k];
        return c.n === 1 ? pct(c.mediana) : `${pct(c.mediana)} (${pct(c.p10)}-${pct(c.p90)}, mejor ${pct(c.mejor)})`;
      });
      console.log(`  ${referencia.padEnd(14)} ${celdas.join(" | ")}`);
    }
  }
  console.log("Mejor clip solo:");
  for (const [referencia, filas] of Object.entries(unClip)) {
    console.log(`  ${referencia.padEnd(14)} ${filas.map((f) => `${f.clip} ${pct(f.mismoContenido ?? 0)}`).join(", ")}`);
  }
  console.log(`Guardado en ${path.join(raiz, "cotas.json")}`);
}

try {
  await correr(process.argv[2]);
} catch (e) {
  if (!(e instanceof ErrorReel)) throw e;
  console.error(e.message);
  process.exitCode = 1;
}
