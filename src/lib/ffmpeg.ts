import { spawn } from "node:child_process";
import { statSync } from "node:fs";

/** Corre un comando y devuelve lo que imprime. Si falla, tira error con el detalle. */
export function correr(comando: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, args);
    const salida: Buffer[] = [];
    const errores: Buffer[] = [];
    proceso.stdout.on("data", (d: Buffer) => salida.push(d));
    proceso.stderr.on("data", (d: Buffer) => errores.push(d));
    proceso.on("error", (e) =>
      reject(new Error(`No se pudo ejecutar ${comando}. ¿Está instalado? (${e.message})`)),
    );
    proceso.on("close", (codigo) => {
      if (codigo === 0) return resolve(Buffer.concat(salida));
      const detalle = Buffer.concat(errores).toString().split("\n").slice(-15).join("\n");
      reject(new Error(`${comando} terminó con error (${codigo}):\n${detalle}`));
    });
  });
}

export function ffmpeg(args: string[]): Promise<Buffer> {
  return correr("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

export interface InfoMedio {
  duracion: number;
  ancho?: number;
  alto?: number;
  fps?: number;
  rotacion?: number;
  tieneAudio: boolean;
}

// Lo que ya se leyó con ffprobe, mientras el archivo no cambie (la app pregunta lo mismo muchas veces)
const yaLeidos = new Map<string, { version: string; datos: Promise<InfoMedio> }>();

/** Lee duración, tamaño y fps de un archivo con ffprobe. */
export function info(archivo: string): Promise<InfoMedio> {
  let version = "";
  try {
    const s = statSync(archivo);
    version = `${s.mtimeMs}:${s.size}`;
  } catch {
    // Si no existe, que ffprobe dé el error
  }
  const guardado = yaLeidos.get(archivo);
  if (version && guardado?.version === version) return guardado.datos;
  const datos = leerInfo(archivo);
  if (version) {
    yaLeidos.set(archivo, { version, datos });
    datos.catch(() => yaLeidos.delete(archivo));
  }
  return datos;
}

async function leerInfo(archivo: string): Promise<InfoMedio> {
  const json = await correr("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    archivo,
  ]);
  const datos = JSON.parse(json.toString());
  const video = datos.streams.find((s: any) => s.codec_type === "video");
  const audio = datos.streams.find((s: any) => s.codec_type === "audio");

  let fps: number | undefined;
  if (video?.avg_frame_rate && video.avg_frame_rate !== "0/0") {
    const [n, d] = video.avg_frame_rate.split("/").map(Number);
    fps = d ? Math.round((n / d) * 100) / 100 : undefined;
  }

  // Los videos de celular a veces vienen "acostados" con una marca de rotación
  const rotacion = Number(
    video?.side_data_list?.find((s: any) => s.rotation !== undefined)?.rotation ??
      video?.tags?.rotate ??
      0,
  );
  const girado = Math.abs(rotacion) === 90 || Math.abs(rotacion) === 270;

  return {
    duracion: Number(datos.format.duration),
    ancho: girado ? video?.height : video?.width,
    alto: girado ? video?.width : video?.height,
    fps,
    rotacion,
    tieneAudio: Boolean(audio),
  };
}

/** Decodifica un audio a mono, 16 kHz, como números para el detector de voz. */
export async function audioComoNumeros(archivo: string): Promise<Float32Array> {
  const crudo = await correr("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-i", archivo,
    "-ac", "1",
    "-ar", "16000",
    "-f", "f32le",
    "pipe:1",
  ]);
  // Copia a un buffer alineado para poder leerlo como Float32
  const alineado = new Uint8Array(crudo.byteLength);
  alineado.set(crudo);
  return new Float32Array(alineado.buffer);
}

/** Los segundos donde la imagen cambia de golpe: los cortes de un video ya editado. */
export async function detectarCortes(archivo: string, umbral: number): Promise<number[]> {
  const salida = await ffmpeg([
    "-i", archivo,
    "-an",
    "-vf", `scdet=threshold=${umbral},metadata=mode=print:key=lavfi.scd.time:file=pipe\\\\:1`,
    "-f", "null", "-",
  ]);
  return [...salida.toString().matchAll(/^lavfi\.scd\.time=([\d.]+)$/gm)].map((m) => Number(m[1]));
}

/** Cuadros chicos en gris, `porSegundo` por segundo desde el segundo 0: un byte por píxel, ancho × alto por cuadro. */
export async function cuadrosEnGris(archivo: string, porSegundo: number, ancho: number, alto: number): Promise<Uint8Array[]> {
  const crudo = await ffmpeg([
    "-i", archivo,
    "-an",
    "-vf", `fps=${porSegundo},scale=${ancho}:${alto}:flags=area,format=gray`,
    "-f", "rawvideo", "pipe:1",
  ]);
  const tamano = ancho * alto;
  const cuadros: Uint8Array[] = [];
  for (let i = 0; i + tamano <= crudo.length; i += tamano) cuadros.push(crudo.subarray(i, i + tamano));
  return cuadros;
}

/** Escapa una ruta para usarla dentro de un filtro de ffmpeg (por ejemplo ass=...). */
export function rutaParaFiltro(ruta: string): string {
  return ruta.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}
