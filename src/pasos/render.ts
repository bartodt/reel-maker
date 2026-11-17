// Paso 5: arma el reel final siguiendo edit/plan.json.
// Recorta cada tramo, lo pasa a 1080x1920, une todo, arma el audio (voz, audio de clips, música con ducking),
// y pone subtítulos, textos grandes y logo.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LOGO, MUSICA, SUBTITULOS, TITULOS, VIDEO, VOZ } from "../config.js";
import { filtroEncuadre } from "../lib/encuadre.js";
import { ErrorReel } from "../lib/errores.js";
import { ffmpeg, info, rutaParaFiltro } from "../lib/ffmpeg.js";
import { agrupar, armarLinea, segmentosDeAudio, textosEnPantalla, vozAReel } from "../lib/linea.js";
import { validarPlan } from "../lib/plan.js";
import { leerJson, segundos, type Proyecto } from "../lib/proyecto.js";
import { armarAss } from "../lib/subtitulos.js";
import type { Palabra } from "../lib/transcripcion.js";

const FORMATO_AUDIO = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";

export async function render(p: Proyecto, log = console.log) {
  const r = await validarPlan(p);
  for (const a of r.avisos) console.warn(`Aviso: ${a}`);
  if (!r.ok) {
    throw new ErrorReel([...r.errores.map((e) => `Error: ${e}`), "Arreglá el plan y volvé a correr el render."].join("\n"));
  }
  const tramos = r.plan!.tramos;
  const conSubtitulos = r.plan!.subtitulos ?? SUBTITULOS.activados;
  const { piezas, duracion } = armarLinea(tramos);
  const { ancho, alto, fps, crf } = VIDEO;

  // 1. Cada tramo a 1080x1920 y mismos fps.
  //    Los cuadros se cuentan sobre el total para que no se acumule desfase entre tramos.
  rmSync(p.pedazos, { recursive: true, force: true });
  mkdirSync(p.pedazos, { recursive: true });

  const lista: string[] = [];
  for (const [i, { tramo: t, inicio, fin }] of piezas.entries()) {
    const cuadros = Math.round(fin * fps) - Math.round(inicio * fps);
    if (cuadros <= 0) continue;
    const velocidad = t.velocidad ?? 1;
    const mover =
      velocidad === 0
        ? `trim=end_frame=1,tpad=stop_mode=clone:stop_duration=${(fin - inicio + 1).toFixed(3)}`
        : velocidad !== 1
          ? `setpts=(PTS-STARTPTS)/${velocidad}`
          : "";
    const filtro = [mover, `fps=${fps}`, filtroEncuadre(t.encuadre, ancho, alto), "setsar=1", "format=yuv420p"]
      .filter(Boolean)
      .join(",");
    const salida = path.join(p.pedazos, `${String(i + 1).padStart(3, "0")}.mp4`);
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
    const extra = velocidad === 0 ? ", congelado" : velocidad !== 1 ? `, velocidad ${velocidad}` : "";
    log(`Tramo ${i + 1}/${piezas.length}: ${t.clip} (${cuadros} cuadros${extra})`);
  }

  // 2. Unir los pedazos (tienen el mismo formato, así que se pegan sin volver a codificar)
  const archivoLista = path.join(p.pedazos, "lista.txt");
  writeFileSync(archivoLista, lista.join("\n") + "\n");
  const videoUnido = path.join(p.edit, "video-unido.mp4");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", archivoLista, "-c", "copy", videoUnido]);

  const entradas = ["-i", videoUnido, "-i", p.vozLimpia];
  let siguienteEntrada = 2;
  const filtros: string[] = [];

  // 3. Subtítulos y textos grandes, con los tiempos pasados de la voz al reel
  const palabras = existsSync(p.transcripcion) ? leerJson<{ words: Palabra[] }>(p.transcripcion).words : [];
  if (conSubtitulos && palabras.length === 0) console.warn("Aviso: no hay transcripción, el reel sale sin subtítulos.");
  if (!conSubtitulos) log("Sin subtítulos (así lo pide el plan)");
  const subtitulos = (conSubtitulos ? palabras : [])
    .filter((w) => w.type === "word")
    .map((w) => {
      const start = vozAReel(w.start, tramos);
      return { ...w, start, end: start + (w.end - w.start) };
    });
  const textos = textosEnPantalla(tramos, palabras, TITULOS.pasoSinVoz);
  let video = "[0:v]";
  if (subtitulos.length || textos.length) {
    const archivoAss = path.join(p.edit, "subtitulos.ass");
    writeFileSync(archivoAss, armarAss(subtitulos, textos));
    filtros.push(`${video}ass='${rutaParaFiltro(archivoAss)}'[conTextos]`);
    video = "[conTextos]";
  }

  // 4. Logo en el centro, con un fundido de entrada
  const conLogo = agrupar(tramos, (t) => (t.logo ? "logo" : undefined));
  if (conLogo.length) {
    entradas.push("-loop", "1", "-t", duracion.toFixed(3), "-i", p.logo!);
    const cuando = conLogo.map((g) => `between(t,${g.inicio.toFixed(3)},${g.fin.toFixed(3)})`).join("+");
    filtros.push(
      `[${siguienteEntrada++}:v]scale=${LOGO.ancho}:-1,format=rgba,fade=t=in:st=${conLogo[0].inicio.toFixed(3)}:d=${LOGO.fundido}:alpha=1[logo]`,
      `${video}[logo]overlay=(W-w)/2:(H-h)/2:enable='${cuando}'[video]`,
    );
    log(`Logo: ${path.basename(p.logo!)}`);
  } else {
    filtros.push(`${video}null[video]`);
  }

  // 5. Audio en orden: voz limpia, silencios (solo música) y el audio de los clips que lo usan
  const segmentos = segmentosDeAudio(tramos);
  const pedazosDeVoz = segmentos.filter((s) => s.tipo === "voz").length;
  const nombresVoz = Array.from({ length: pedazosDeVoz }, (_, i) => `[voz${i}]`);
  filtros.push(`[1:a]${FORMATO_AUDIO},asplit=${pedazosDeVoz}${nombresVoz.join("")}`);
  const fundidos = (d: number) => `afade=t=in:d=${VOZ.fundido},afade=t=out:st=${Math.max(0, d - VOZ.fundido).toFixed(3)}:d=${VOZ.fundido}`;
  let vozUsada = 0;
  for (const [k, s] of segmentos.entries()) {
    if (s.tipo === "voz") {
      const d = s.hasta - s.desde;
      filtros.push(`${nombresVoz[vozUsada++]}atrim=start=${s.desde.toFixed(3)}:end=${s.hasta.toFixed(3)},asetpts=PTS-STARTPTS,${fundidos(d)}[s${k}]`);
    } else if (s.tipo === "silencio") {
      filtros.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${s.duracion.toFixed(3)},${FORMATO_AUDIO}[s${k}]`);
    } else {
      entradas.push("-ss", s.arrancaEn.toFixed(3), "-t", s.duracion.toFixed(3), "-i", path.join(p.carpetaClips, s.clip));
      filtros.push(
        `[${siguienteEntrada++}:a]${FORMATO_AUDIO},apad,atrim=duration=${s.duracion.toFixed(3)},asetpts=PTS-STARTPTS,${fundidos(s.duracion)}[s${k}]`,
      );
    }
  }
  filtros.push(`${segmentos.map((_, k) => `[s${k}]`).join("")}concat=n=${segmentos.length}:v=0:a=1[dialogo]`);

  // Música con ducking: baja sola cuando se habla (la voz en off o alguien en un clip)
  if (p.musica) {
    entradas.push("-stream_loop", "-1", "-t", duracion.toFixed(3), "-i", p.musica);
    const finMusica = Math.max(0, duracion - 1.5).toFixed(2);
    filtros.push(
      `[dialogo]asplit=2[voz][llave]`,
      `[${siguienteEntrada++}:a]${FORMATO_AUDIO},volume=${MUSICA.volumen}[mus]`,
      `[mus][llave]sidechaincompress=threshold=${MUSICA.umbral}:ratio=${MUSICA.ratio}:attack=${MUSICA.ataqueMs}:release=${MUSICA.soltarMs},afade=t=out:st=${finMusica}:d=1.5[fondo]`,
      `[voz][fondo]amix=inputs=2:duration=first:normalize=0[audio]`,
    );
    log(`Música: ${path.basename(p.musica)} (con ducking)`);
  } else {
    filtros.push(`[dialogo]anull[audio]`);
  }

  // 6. Render final
  await ffmpeg([
    ...entradas,
    "-filter_complex", filtros.join(";"),
    "-map", "[video]",
    "-map", "[audio]",
    "-t", duracion.toFixed(3),
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
