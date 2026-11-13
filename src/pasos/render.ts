// Paso 5: arma el reel final siguiendo edit/plan.json.
// Recorta cada tramo, lo pasa a 1080x1920, une todo, pone la voz, la música con ducking y los subtítulos.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MUSICA, SUBTITULOS, VIDEO } from "../config.js";
import { filtroEncuadre } from "../lib/encuadre.js";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info, rutaParaFiltro } from "../lib/ffmpeg.js";
import { validarPlan } from "../lib/plan.js";
import { leerJson, segundos, type Proyecto } from "../lib/proyecto.js";
import { armarAss } from "../lib/subtitulos.js";
import type { Palabra } from "../lib/transcripcion.js";

export async function render(p: Proyecto, log = console.log) {
  const r = await validarPlan(p);
  for (const a of r.avisos) console.warn(`Aviso: ${a}`);
  if (!r.ok) {
    throw new ErrorReel([...r.errores.map((e) => `Error: ${e}`), "Arreglá el plan y volvé a correr el render."].join("\n"));
  }
  const plan = r.plan!;
  const duracionVoz = r.duracionVoz;
  const { ancho, alto, fps, crf } = VIDEO;

  // 1. Cada tramo a 1080x1920 y mismos fps.
  //    Los cuadros se cuentan sobre el total para que no se acumule desfase entre tramos.
  rmSync(p.pedazos, { recursive: true, force: true });
  mkdirSync(p.pedazos, { recursive: true });

  const lista: string[] = [];
  for (const [i, t] of plan.tramos.entries()) {
    const cuadros = Math.round(t.hasta * fps) - Math.round(t.desde * fps);
    if (cuadros <= 0) continue;
    const salida = path.join(p.pedazos, `${String(i + 1).padStart(3, "0")}.mp4`);
    const filtro = `${filtroEncuadre(t.encuadre, ancho, alto)},fps=${fps},setsar=1,format=yuv420p`;
    await ffmpeg([
      "-ss", t.arrancaEn.toFixed(3),
      "-i", path.join(p.carpetaClips, t.clip),
      "-vf", filtro,
      "-frames:v", String(cuadros),
      "-an",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf),
      salida,
    ]);
    lista.push(`file '${salida.replace(/'/g, "'\\''")}'`);
    log(`Tramo ${i + 1}/${plan.tramos.length}: ${t.clip} (${cuadros} cuadros)`);
  }

  // 2. Unir los pedazos (tienen el mismo formato, así que se pegan sin volver a codificar)
  const archivoLista = path.join(p.pedazos, "lista.txt");
  writeFileSync(archivoLista, lista.join("\n") + "\n");
  const videoUnido = path.join(p.edit, "video-unido.mp4");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", archivoLista, "-c", "copy", videoUnido]);

  // 3. Subtítulos
  let filtroVideo = "null";
  if (SUBTITULOS.activados) {
    if (existsSync(p.transcripcion)) {
      const { words } = leerJson<{ words: Palabra[] }>(p.transcripcion);
      const archivoAss = path.join(p.edit, "subtitulos.ass");
      writeFileSync(archivoAss, armarAss(words));
      filtroVideo = `ass='${rutaParaFiltro(archivoAss)}'`;
    } else {
      console.warn("Aviso: no hay transcripción, el reel sale sin subtítulos.");
    }
  }

  // 4. Audio: voz + música con ducking (la música baja sola cuando hablás)
  const entradas = ["-i", videoUnido, "-i", p.vozLimpia];
  const formato = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
  let filtroAudio: string;
  if (p.musica) {
    entradas.push("-stream_loop", "-1", "-i", p.musica);
    const finMusica = Math.max(0, duracionVoz - 1.5).toFixed(2);
    filtroAudio = [
      `[1:a]${formato},asplit=2[voz][llave]`,
      `[2:a]${formato},volume=${MUSICA.volumen}[mus]`,
      `[mus][llave]sidechaincompress=threshold=${MUSICA.umbral}:ratio=${MUSICA.ratio}:attack=${MUSICA.ataqueMs}:release=${MUSICA.soltarMs},afade=t=out:st=${finMusica}:d=1.5[fondo]`,
      `[voz][fondo]amix=inputs=2:duration=first:normalize=0[audio]`,
    ].join(";");
    log(`Música: ${path.basename(p.musica)} (con ducking)`);
  } else {
    filtroAudio = `[1:a]${formato}[audio]`;
  }

  // 5. Render final
  await ffmpeg([
    ...entradas,
    "-filter_complex", `[0:v]${filtroVideo}[video];${filtroAudio}`,
    "-map", "[video]",
    "-map", "[audio]",
    "-t", duracionVoz.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "8M", "-bufsize", "16M",
    "-pix_fmt", "yuv420p", "-r", String(fps),
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    p.final,
  ]);

  const final = await info(p.final);
  log(`Listo: ${p.final}`);
  log(`${final.ancho}x${final.alto}, ${final.fps} fps, ${segundos(final.duracion)} s`);
  return final;
}
