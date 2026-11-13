// Paso 1: detecta dónde hablás con Silero VAD y corta los silencios largos.
// Entrada: voz.wav (o .mp3, .m4a...)   Salida: edit/voz-limpia.wav y edit/voz-cortes.json
import path from "node:path";
import { NonRealTimeVAD } from "@ricky0123/vad-node";
import { VOZ } from "../config.js";
import { ErrorReel } from "../lib/errores.js";
import { audioComoNumeros, ffmpeg, info } from "../lib/ffmpeg.js";
import { guardarJson, segundos, type Proyecto } from "../lib/proyecto.js";
import { tramosAConservar, type Tramo } from "../lib/voz.js";

const MUESTRAS_POR_CUADRO = 512; // 32 ms a 16 kHz
const MS_POR_CUADRO = MUESTRAS_POR_CUADRO / 16;
const CUADROS_DE_GRACIA = 8;

/** Corre Silero VAD sobre un archivo y devuelve los tramos con voz (en segundos). */
export async function detectarVoz(archivo: string): Promise<Tramo[]> {
  const audio = await audioComoNumeros(archivo);
  const vad = await NonRealTimeVAD.new({
    frameSamples: MUESTRAS_POR_CUADRO,
    positiveSpeechThreshold: VOZ.umbralVoz,
    negativeSpeechThreshold: Math.max(0.05, VOZ.umbralVoz - 0.15),
    redemptionFrames: CUADROS_DE_GRACIA,
    preSpeechPadFrames: 1,
    minSpeechFrames: 3,
  });
  const tramos: Tramo[] = [];
  for await (const { start, end } of vad.run(audio, 16000)) {
    // El detector avisa el final después de esperar unos cuadros de silencio; los descontamos
    const finReal = end - CUADROS_DE_GRACIA * MS_POR_CUADRO;
    tramos.push({ desde: start / 1000, hasta: Math.max(start, finReal) / 1000 });
  }
  return tramos;
}

/** Arma el audio final quedándose solo con los tramos indicados, con un fundido mínimo en cada unión. */
export async function recortarAudio(entrada: string, tramos: Tramo[], salida: string) {
  const f = VOZ.fundido;
  const cadenas = tramos.map((t, i) => {
    const dur = t.hasta - t.desde;
    return (
      `[0:a]atrim=start=${t.desde.toFixed(3)}:end=${t.hasta.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=${f},afade=t=out:st=${Math.max(0, dur - f).toFixed(3)}:d=${f}[a${i}]`
    );
  });
  const unir = tramos.map((_, i) => `[a${i}]`).join("") + `concat=n=${tramos.length}:v=0:a=1[voz]`;
  await ffmpeg([
    "-i", entrada,
    "-filter_complex", [...cadenas, unir].join(";"),
    "-map", "[voz]",
    "-ac", "1",
    "-ar", "48000",
    salida,
  ]);
}

export async function limpiar(p: Proyecto, log = console.log) {
  if (!p.voz) {
    throw new ErrorReel(`No encontré la voz. Poné un archivo llamado voz.wav (o .mp3/.m4a) en ${p.raiz}`);
  }
  const duracionOriginal = (await info(p.voz)).duracion;
  log(`Voz original: ${segundos(duracionOriginal)} s`);

  const conVoz = await detectarVoz(p.voz);
  if (conVoz.length === 0) {
    throw new ErrorReel("No detecté voz en el audio. Revisá el archivo o bajá VOZ.umbralVoz en src/config.ts");
  }

  const conservar = tramosAConservar(conVoz, duracionOriginal, VOZ);
  await recortarAudio(p.voz, conservar, p.vozLimpia);

  const duracionLimpia = (await info(p.vozLimpia)).duracion;
  guardarJson(path.join(p.edit, "voz-cortes.json"), {
    original: path.basename(p.voz),
    duracionOriginal,
    duracionLimpia,
    tramosConservados: conservar,
  });

  log(`Tramos con voz: ${conservar.length}`);
  log(`Voz limpia: ${segundos(duracionLimpia)} s (se sacaron ${segundos(duracionOriginal - duracionLimpia)} s de silencio)`);
  log(`Listo: ${p.vozLimpia}`);
}
