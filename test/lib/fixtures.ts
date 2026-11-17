import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpeg } from "../../src/lib/ffmpeg.js";
import { abrirProyecto, guardarJson } from "../../src/lib/proyecto.js";
import type { Plan } from "../../src/lib/plan.js";

export const DURACION_VOZ = 6;

/** Si un ffmpeg se cuelga, el test falla con su nombre en vez de dejar todo esperando. */
export const LIMITE = { timeout: 2 * 60_000 };

/**
 * Crea un proyecto de prueba en una carpeta temporal, con clips generados por ffmpeg,
 * una "voz limpia" (un tono) y una transcripción falsa. No necesita red ni ElevenLabs.
 */
export async function crearProyectoDePrueba(opciones: { conMusica?: boolean } = {}) {
  const raiz = mkdtempSync(path.join(tmpdir(), "reel-test-"));
  const clips = path.join(raiz, "clips");
  const edit = path.join(raiz, "edit");
  mkdirSync(clips);
  mkdirSync(edit);

  await ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-t", "5", "-pix_fmt", "yuv420p", path.join(clips, "horizontal.mp4")]);
  await ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=25", "-t", "4", "-pix_fmt", "yuv420p", path.join(clips, "vertical.mov")]);
  // Alguien "hablando" a cámara: un clip con su propio audio (un tono más agudo que la voz)
  await ffmpeg([
    "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30",
    "-f", "lavfi", "-i", "sine=f=660",
    "-t", "4", "-pix_fmt", "yuv420p", "-shortest", path.join(clips, "con-audio.mp4"),
  ]);
  await ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=300x150", "-frames:v", "1", path.join(raiz, "logo.png")]);
  await ffmpeg(["-f", "lavfi", "-i", `sine=f=440:d=${DURACION_VOZ}`, path.join(raiz, "voz.wav")]);
  await ffmpeg(["-f", "lavfi", "-i", `sine=f=440:d=${DURACION_VOZ}`, "-ar", "48000", path.join(edit, "voz-limpia.wav")]);
  if (opciones.conMusica) {
    await ffmpeg(["-f", "lavfi", "-i", "sine=f=220:d=3", path.join(raiz, "musica.mp3")]);
  }

  guardarJson(path.join(edit, "transcripcion.json"), {
    language_code: "spa",
    text: "Hola esto es una prueba. Y esto también.",
    words: [
      { text: "Hola", start: 0.1, end: 0.5, type: "word" },
      { text: "esto", start: 0.6, end: 0.9, type: "word" },
      { text: "es", start: 1.0, end: 1.1, type: "word" },
      { text: "una", start: 1.2, end: 1.4, type: "word" },
      { text: "prueba.", start: 1.5, end: 2.0, type: "word" },
      { text: "Y", start: 3.0, end: 3.1, type: "word" },
      { text: "esto", start: 3.2, end: 3.5, type: "word" },
      { text: "también.", start: 3.6, end: 4.2, type: "word" },
    ],
  });

  return abrirProyecto(raiz);
}

export function escribirPlan(raiz: string, plan: Plan) {
  writeFileSync(path.join(raiz, "edit", "plan.json"), JSON.stringify(plan, null, 2));
}

export const PLAN_VALIDO: Plan = {
  tramos: [
    { desde: 0, hasta: 2.5, clip: "horizontal.mp4", arrancaEn: 1, encuadre: "izquierda" },
    { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0.2 },
  ],
};
