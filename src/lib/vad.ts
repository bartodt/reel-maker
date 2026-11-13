import { NonRealTimeVAD } from "@ricky0123/vad-node";
import { VOZ } from "../config.js";
import { audioComoNumeros } from "./ffmpeg.js";
import type { Tramo } from "./voz.js";

const MUESTRAS_POR_CUADRO = 512; // 32 ms a 16 kHz
const MS_POR_CUADRO = MUESTRAS_POR_CUADRO / 16;
const CUADROS_DE_GRACIA = 8;

// El modelo se carga una sola vez y se reusa. Como guarda estado mientras analiza,
// los análisis van en fila: uno empieza cuando termina el anterior.
let modelo: Promise<NonRealTimeVAD> | undefined;
let fila: Promise<unknown> = Promise.resolve();

/** Corre Silero VAD sobre un archivo y devuelve los tramos con voz (en segundos). */
export async function detectarVoz(archivo: string): Promise<Tramo[]> {
  const audio = await audioComoNumeros(archivo);
  modelo ??= NonRealTimeVAD.new({
    frameSamples: MUESTRAS_POR_CUADRO,
    positiveSpeechThreshold: VOZ.umbralVoz,
    negativeSpeechThreshold: Math.max(0.05, VOZ.umbralVoz - 0.15),
    redemptionFrames: CUADROS_DE_GRACIA,
    preSpeechPadFrames: 1,
    minSpeechFrames: 3,
  });
  const vad = await modelo;
  const analisis = fila.then(async () => {
    const tramos: Tramo[] = [];
    for await (const { start, end } of vad.run(audio, 16000)) {
      // El detector avisa el final después de esperar unos cuadros de silencio; los descontamos
      const finReal = end - CUADROS_DE_GRACIA * MS_POR_CUADRO;
      tramos.push({ desde: start / 1000, hasta: Math.max(start, finReal) / 1000 });
    }
    return tramos;
  });
  fila = analisis.catch(() => {});
  return analisis;
}
