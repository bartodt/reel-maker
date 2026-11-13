// Paso 1: detecta dónde hablás con Silero VAD y corta los silencios largos.
// Entrada: voz.wav (o .mp3, .m4a...)   Salida: edit/voz-limpia.wav y edit/voz-cortes.json
import path from "node:path";
import { VOZ } from "../config.js";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info } from "../lib/ffmpeg.js";
import { guardarJson, segundos, type Proyecto } from "../lib/proyecto.js";
import { detectarVoz } from "../lib/vad.js";
import { tramosAConservar, type Tramo } from "../lib/voz.js";

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
