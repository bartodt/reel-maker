// Para armar una referencia: busca cada plano de un reel ya publicado en los clips crudos.
// Salida: edit/reconstruccion.json, edit/storyboard.jpg (publicado a la izquierda, clip a la derecha) y,
// si la voz de la carpeta es el audio del publicado, edit/plan-reconstruido.json.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  PARTES_DEL_PLANO,
  emparejar,
  firma,
  planDesdePublicado,
  planosDeCortes,
  type Firma,
  type PlanoReconstruido,
} from "../lib/emparejar.js";
import { expandirCasa } from "../lib/entorno.js";
import { ErrorReel } from "../lib/errores.js";
import { cuadrosEnGris, detectarCortes, ffmpeg, info } from "../lib/ffmpeg.js";
import { enParalelo } from "../lib/paralelo.js";
import { guardarJson, leerJson, segundos, type Proyecto } from "../lib/proyecto.js";
import type { Tramo as TramoVoz } from "../lib/voz.js";

// Tan chicos que los subtítulos y los textos quemados en el publicado casi no cambian el parecido
const ANCHO = 18;
const ALTO = 32;
const CUADROS_POR_SEGUNDO = 30;
// Cuánto tiene que cambiar la imagen de un cuadro al siguiente para contar como corte (de 0 a 100)
const UMBRAL_CORTE = 10;
const CLIPS_A_LA_VEZ = 3;
const ALTO_STORYBOARD = 240;
const PARES_POR_FILA = 6;

export async function reconstruir(p: Proyecto, archivoPublicado: string | undefined, log = console.log) {
  if (!archivoPublicado) {
    throw new ErrorReel("Falta el video publicado. Ejemplo: npm run reconstruir -- ~/reels/playa ~/Downloads/publicado.mp4");
  }
  const publicado = expandirCasa(archivoPublicado);
  if (!existsSync(publicado)) throw new ErrorReel(`No existe el video publicado: ${publicado}`);
  const clips = p.clips();
  if (clips.length === 0) throw new ErrorReel(`No hay videos en ${p.carpetaClips}`);

  const { duracion } = await info(publicado);
  const tiempos = planosDeCortes(await detectarCortes(publicado, UMBRAL_CORTE), duracion);
  log(`${tiempos.length} planos en ${segundos(duracion)} s del publicado. Buscándolos en ${clips.length} clips...`);

  const delPublicado = (await cuadrosEnGris(publicado, CUADROS_POR_SEGUNDO, ANCHO, ALTO)).map(firma);
  const enSegundo = (t: number) => delPublicado[Math.min(delPublicado.length - 1, Math.round(t * CUADROS_POR_SEGUNDO))];
  const leidos = await enParalelo(clips, CLIPS_A_LA_VEZ, async (clip) => ({
    clip,
    firmas: (await cuadrosEnGris(path.join(p.carpetaClips, clip), CUADROS_POR_SEGUNDO, ANCHO, ALTO)).map(firma),
  }));
  const conCuadros = leidos.filter((c) => c.firmas.length > 0);

  const planos: PlanoReconstruido[] = tiempos.map(({ desde, hasta }) => {
    const duracion = hasta - desde;
    const cuadros = (partes: readonly number[]) => partes.map((parte) => enSegundo(desde + duracion * parte));
    const plano = {
      duracion,
      ajuste: cuadros(PARTES_DEL_PLANO.ajuste) as [Firma, Firma, Firma],
      puntas: cuadros(PARTES_DEL_PLANO.puntas) as [Firma, Firma],
    };
    return { desde, hasta, ...emparejar(plano, conCuadros, CUADROS_POR_SEGUNDO) };
  });

  for (const [i, pl] of planos.entries()) {
    const velocidad = pl.velocidad === 0 ? " congelado" : pl.velocidad !== 1 ? ` a ${pl.velocidad}x` : "";
    const otros = pl.alternativas.length
      ? `  (o ${pl.alternativas.join(", ")})`
      : pl.segundo
        ? `  (después: ${pl.segundo.clip} ${pl.segundo.parecido.toFixed(2)})`
        : "";
    const revisar = pl.revisar ? `  revisalo a mano (parecido en las puntas: ${pl.puntas.map((p) => p.toFixed(2)).join(" y ")})` : "";
    log(
      `${String(i + 1).padStart(2)}  ${segundos(pl.desde)} - ${segundos(pl.hasta)}  ${pl.clip} desde ${segundos(pl.arrancaEn)} s` +
        `${velocidad}  parecido ${pl.parecido.toFixed(2)}${otros}${revisar}`,
    );
  }

  const r = (n: number) => Math.round(n * 1000) / 1000;
  const archivo = path.join(p.edit, "reconstruccion.json");
  guardarJson(archivo, {
    publicado: path.basename(publicado),
    duracion: r(duracion),
    cortes: tiempos.slice(1).map((t) => r(t.desde)),
    planos: planos.map((pl, i) => ({
      plano: i + 1,
      desde: r(pl.desde),
      hasta: r(pl.hasta),
      clip: pl.clip,
      arrancaEn: r(pl.arrancaEn),
      velocidad: pl.velocidad,
      parecido: r(pl.parecido),
      puntas: pl.puntas.map(r),
      revisar: pl.revisar,
      segundo: pl.segundo && { clip: pl.segundo.clip, parecido: r(pl.segundo.parecido) },
      alternativas: pl.alternativas,
    })),
  });

  const storyboard = path.join(p.edit, "storyboard.jpg");
  await armarStoryboard(p, publicado, planos, storyboard);
  log(`Listo: ${archivo} y ${storyboard}`);

  const archivoCortes = path.join(p.edit, "voz-cortes.json");
  if (!existsSync(archivoCortes)) return planos;
  const voz = leerJson<{ duracionOriginal: number; tramosConservados: TramoVoz[] }>(archivoCortes);
  if (Math.abs(voz.duracionOriginal - duracion) > 0.5) {
    log("La voz de esta carpeta no dura lo mismo que el publicado, así que no es su audio: no armé el plan.");
    return planos;
  }
  const plan = path.join(p.edit, "plan-reconstruido.json");
  guardarJson(plan, planDesdePublicado(planos, voz.tramosConservados));
  log(`Borrador del plan, sobre la voz limpia: ${plan}`);
  return planos;
}

/** Un par de cuadros por plano, de la mitad del plano: el publicado y el clip elegido en ese momento. */
async function armarStoryboard(p: Proyecto, publicado: string, planos: PlanoReconstruido[], destino: string) {
  const temporal = path.join(p.edit, ".storyboard");
  rmSync(temporal, { recursive: true, force: true });
  mkdirSync(temporal);
  const ancho = Math.round((ALTO_STORYBOARD * 9) / 32) * 2;
  try {
    await enParalelo(planos, CLIPS_A_LA_VEZ, async (pl, i) => {
      const rotulo =
        `drawtext=text='${i + 1}   ${pl.parecido.toFixed(2)}':x=6:y=6:fontsize=${Math.round(ALTO_STORYBOARD / 12)}` +
        `:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`;
      await ffmpeg([
        "-ss", String((pl.desde + pl.hasta) / 2), "-i", publicado,
        "-ss", String(pl.medio), "-i", path.join(p.carpetaClips, pl.clip),
        "-filter_complex",
        `[0:v]scale=${ancho}:${ALTO_STORYBOARD},setsar=1[a];[1:v]scale=${ancho}:${ALTO_STORYBOARD},setsar=1[b];[a][b]hstack,${rotulo}`,
        "-frames:v", "1",
        "-q:v", "3",
        path.join(temporal, `${String(i).padStart(3, "0")}.jpg`),
      ]);
    });
    const columnas = Math.min(PARES_POR_FILA, planos.length);
    await ffmpeg([
      "-i", path.join(temporal, "%03d.jpg"),
      "-vf", `tile=${columnas}x${Math.ceil(planos.length / columnas)}:padding=8:margin=8:color=white`,
      "-frames:v", "1",
      "-q:v", "3",
      destino,
    ]);
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}
