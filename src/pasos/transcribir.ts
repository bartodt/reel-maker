// Paso 2: transcribe la voz limpia con ElevenLabs Scribe (tiempo exacto de cada palabra).
// Entrada: edit/voz-limpia.wav   Salida: edit/transcripcion.json y edit/transcripcion.md
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ELEVENLABS } from "../config.js";
import { ErrorReel } from "../lib/errores.js";
import { guardarJson, segundos, type Proyecto } from "../lib/proyecto.js";
import { agruparFrases, type Palabra } from "../lib/transcripcion.js";

export async function transcribir(p: Proyecto, log = console.log) {
  const clave = process.env.ELEVENLABS_API_KEY;
  if (!clave) throw new ErrorReel("Falta ELEVENLABS_API_KEY. Copiá .env.example a .env y poné tu clave.");
  if (!existsSync(p.vozLimpia)) throw new ErrorReel("Primero corré el paso 1: npm run limpiar -- <carpeta>");

  const formulario = new FormData();
  formulario.append("file", new Blob([readFileSync(p.vozLimpia)]), "voz-limpia.wav");
  formulario.append("model_id", ELEVENLABS.modelo);
  formulario.append("timestamps_granularity", "word");
  if (ELEVENLABS.idioma) formulario.append("language_code", ELEVENLABS.idioma);

  log("Transcribiendo con ElevenLabs Scribe...");
  const respuesta = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": clave },
    body: formulario,
  });
  if (!respuesta.ok) {
    throw new ErrorReel(`ElevenLabs respondió ${respuesta.status}: ${await respuesta.text()}`);
  }

  const resultado = (await respuesta.json()) as { text: string; language_code?: string; words: Palabra[] };
  guardarJson(p.transcripcion, resultado);
  escribirTranscripcionLegible(p, resultado);

  const cantidad = resultado.words.filter((w) => w.type === "word").length;
  log(`Palabras: ${cantidad}`);
  log(`Listo: ${p.transcripcionTexto}`);
}

/** Versión fácil de leer: frases con su tiempo. Es lo que se usa para armar el plan. */
export function escribirTranscripcionLegible(
  p: Proyecto,
  resultado: { language_code?: string; words: Palabra[] },
) {
  const frases = agruparFrases(resultado.words);
  const ultimaPalabra = resultado.words.filter((w) => w.type === "word").at(-1);
  const lineas = [
    "# Transcripción de la voz limpia",
    "",
    `Idioma detectado: ${resultado.language_code ?? "?"}`,
    `Duración hablada: ${segundos(ultimaPalabra?.end ?? 0)} s`,
    "",
    ...frases.map((f) => `[${segundos(f.desde)} - ${segundos(f.hasta)}] ${f.texto}`),
    "",
  ];
  writeFileSync(p.transcripcionTexto, lineas.join("\n"));
}
