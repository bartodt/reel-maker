// Paso 3: arma un inventario de los clips y saca capturas para ver qué hay en cada uno.
// Salida: edit/inventario.json y edit/capturas/<clip>.jpg (4 capturas en fila por clip)
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info } from "../lib/ffmpeg.js";
import { guardarJson, leerJson, segundos, type Proyecto } from "../lib/proyecto.js";

const MOMENTOS = [0.1, 0.35, 0.6, 0.85];

export interface ClipInventario {
  archivo: string;
  duracion: number;
  ancho?: number;
  alto?: number;
  fps?: number;
  orientacion: "vertical" | "horizontal" | "cuadrado" | "?";
  captura: string;
  momentosCaptura: number[];
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
  mkdirSync(temporal, { recursive: true });

  const resultado: ClipInventario[] = [];
  try {
    for (const archivo of clips) {
      const ruta = path.join(p.carpetaClips, archivo);
      const datos = await info(ruta);
      const momentos = MOMENTOS.map((m) => Math.round(datos.duracion * m * 100) / 100);

      const fotos: string[] = [];
      for (const [i, t] of momentos.entries()) {
        const foto = path.join(temporal, `${i}.jpg`);
        await ffmpeg(["-ss", String(t), "-i", ruta, "-frames:v", "1", "-vf", "scale=-2:360", "-q:v", "4", foto]);
        fotos.push(foto);
      }
      const captura = path.join(p.capturas, `${path.parse(archivo).name}.jpg`);
      await ffmpeg([
        ...fotos.flatMap((f) => ["-i", f]),
        "-filter_complex", `${fotos.map((_, i) => `[${i}:v]`).join("")}hstack=inputs=${fotos.length}`,
        "-q:v", "4",
        captura,
      ]);

      let orientacion: ClipInventario["orientacion"] = "?";
      if (datos.ancho && datos.alto) {
        orientacion = datos.ancho > datos.alto ? "horizontal" : datos.ancho < datos.alto ? "vertical" : "cuadrado";
      }

      resultado.push({
        archivo,
        duracion: datos.duracion,
        ancho: datos.ancho,
        alto: datos.alto,
        fps: datos.fps,
        orientacion,
        captura: path.relative(p.edit, captura),
        momentosCaptura: momentos,
        descripcion: anteriores.get(archivo) ?? "",
      });
      log(`${archivo}: ${segundos(datos.duracion)} s, ${datos.ancho}x${datos.alto}, ${orientacion}`);
    }
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }

  guardarJson(p.inventario, resultado);
  log(`Listo: ${p.inventario}`);
  log("Ahora mirá las capturas en edit/capturas/ y completá 'descripcion' de cada clip.");
  return resultado;
}
