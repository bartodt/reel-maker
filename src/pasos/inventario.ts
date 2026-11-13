// Paso 3: arma un inventario de los clips y saca capturas para ver qué hay en cada uno.
// Salida: edit/inventario.json y edit/capturas/<clip>.jpg (una grilla con más o menos una captura por segundo)
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import { CAPTURAS } from "../config.js";
import { etiquetaCaptura, momentosDeCaptura } from "../lib/capturas.js";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info } from "../lib/ffmpeg.js";
import { enParalelo } from "../lib/paralelo.js";
import { guardarJson, leerJson, segundos, type Proyecto } from "../lib/proyecto.js";
import { detectarVoz } from "../lib/vad.js";
import { tramosAConservar, type Tramo } from "../lib/voz.js";

// Ancho máximo de la grilla de capturas (píxeles), para que los clips horizontales no queden enormes
const ANCHO_MAXIMO_GRILLA = 1800;
// Cuántos clips y cuántas capturas de cada clip se procesan a la vez
const CLIPS_A_LA_VEZ = 3;
const CAPTURAS_A_LA_VEZ = Math.max(1, Math.floor(availableParallelism() / CLIPS_A_LA_VEZ));

export interface ClipInventario {
  archivo: string;
  duracion: number;
  ancho?: number;
  alto?: number;
  fps?: number;
  orientacion: "vertical" | "horizontal" | "cuadrado" | "?";
  captura: string;
  momentosCaptura: number[];
  /** Partes del clip donde alguien habla (segundos del clip) */
  conVoz: Tramo[];
  /** Se completa después de mirar la captura (Claude o a mano) */
  descripcion: string;
}

export async function inventario(p: Proyecto, log = console.log): Promise<ClipInventario[]> {
  const clips = p.clips();
  if (clips.length === 0) throw new ErrorReel(`No hay videos en ${p.carpetaClips}`);

  // Si ya había descripciones, se conservan
  const anteriores = new Map<string, string>();
  if (existsSync(p.inventario)) {
    for (const c of leerJson<ClipInventario[]>(p.inventario)) anteriores.set(c.archivo, c.descripcion);
  }

  mkdirSync(p.capturas, { recursive: true });
  const temporal = path.join(p.capturas, ".tmp");

  let resultado: ClipInventario[];
  try {
    resultado = await enParalelo(clips, CLIPS_A_LA_VEZ, async (archivo) => {
      const ruta = path.join(p.carpetaClips, archivo);
      const datos = await info(ruta);
      const momentos = momentosDeCaptura(datos.duracion, CAPTURAS);
      const conVoz = datos.tieneAudio ? await partesConVoz(ruta, datos.duracion) : [];

      // Una foto por momento, con el segundo escrito abajo
      const fotos = path.join(temporal, path.parse(archivo).name);
      mkdirSync(fotos, { recursive: true });
      const tamanoLetra = Math.round(CAPTURAS.alto * 0.07);
      await enParalelo(momentos, CAPTURAS_A_LA_VEZ, async (t, i) => {
        const rotulo =
          `drawtext=text='${etiquetaCaptura(t, conVoz)}':x=8:y=h-th-10:fontsize=${tamanoLetra}` +
          `:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6`;
        await ffmpeg([
          "-ss", String(t),
          "-i", ruta,
          "-frames:v", "1",
          "-vf", `scale=-2:${CAPTURAS.alto},${rotulo}`,
          "-q:v", "4",
          path.join(fotos, `${String(i).padStart(2, "0")}.jpg`),
        ]);
      });

      // Todas juntas en una grilla
      const anchoFoto = datos.ancho && datos.alto ? (CAPTURAS.alto * datos.ancho) / datos.alto : CAPTURAS.alto;
      const columnas = Math.max(1, Math.min(CAPTURAS.columnas, momentos.length, Math.floor(ANCHO_MAXIMO_GRILLA / anchoFoto)));
      const filas = Math.ceil(momentos.length / columnas);
      const captura = path.join(p.capturas, `${path.parse(archivo).name}.jpg`);
      await ffmpeg([
        "-i", path.join(fotos, "%02d.jpg"),
        "-vf", `tile=${columnas}x${filas}:padding=4:color=white`,
        "-frames:v", "1",
        "-q:v", "4",
        captura,
      ]);

      let orientacion: ClipInventario["orientacion"] = "?";
      if (datos.ancho && datos.alto) {
        orientacion = datos.ancho > datos.alto ? "horizontal" : datos.ancho < datos.alto ? "vertical" : "cuadrado";
      }

      const habla = conVoz.length ? `, habla en ${conVoz.map((t) => `${segundos(t.desde)}-${segundos(t.hasta)}`).join(", ")}` : "";
      log(`${archivo}: ${segundos(datos.duracion)} s, ${datos.ancho}x${datos.alto}, ${orientacion}${habla}`);
      return {
        archivo,
        duracion: datos.duracion,
        ancho: datos.ancho,
        alto: datos.alto,
        fps: datos.fps,
        orientacion,
        captura: path.relative(p.edit, captura),
        momentosCaptura: momentos,
        conVoz,
        descripcion: anteriores.get(archivo) ?? "",
      };
    });
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }

  guardarJson(p.inventario, resultado);
  log(`Listo: ${p.inventario}`);
  log("Ahora mirá las capturas en edit/capturas/ y completá 'descripcion' de cada clip.");
  return resultado;
}

/** Dónde habla alguien en el clip: pausas cortas unidas, sin ruiditos sueltos, redondeado a décimas. */
async function partesConVoz(ruta: string, duracion: number): Promise<Tramo[]> {
  const tramos = tramosAConservar(await detectarVoz(ruta), duracion, { margen: 0, pausaMinimaParaCortar: 0.3 });
  const redondear = (n: number) => Math.round(n * 10) / 10;
  return tramos
    .filter((t) => t.hasta - t.desde >= 0.2)
    .map((t) => ({ desde: redondear(t.desde), hasta: redondear(t.hasta) }));
}
