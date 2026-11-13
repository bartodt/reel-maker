// Punto de entrada: npm run reel -- <paso> <carpeta>
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ErrorReel } from "./lib/errores.js";
import { abrirProyecto } from "./lib/proyecto.js";
import { inventario } from "./pasos/inventario.js";
import { limpiar } from "./pasos/limpiar.js";
import { render } from "./pasos/render.js";
import { transcribir } from "./pasos/transcribir.js";
import { validar } from "./pasos/validar.js";

const PASOS = { limpiar, transcribir, inventario, validar, render } as const;
type NombrePaso = keyof typeof PASOS;

const AYUDA = `Uso: npm run reel -- <paso> <carpeta>

Pasos (en orden):
  limpiar      corta los silencios de la voz (Silero VAD)
  transcribir  transcribe la voz limpia (ElevenLabs Scribe)
  inventario   datos y capturas de cada clip
  validar      revisa edit/plan.json
  render       genera edit/final.mp4

Atajos: npm run limpiar -- <carpeta>, npm run render -- <carpeta>, etc.`;

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivoEnv = path.join(raizRepo, ".env");
if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);

const [nombre, carpeta] = process.argv.slice(2);

if (!nombre || !(nombre in PASOS)) {
  console.log(AYUDA);
  process.exit(nombre ? 1 : 0);
}

try {
  await PASOS[nombre as NombrePaso](abrirProyecto(carpeta));
} catch (e) {
  if (e instanceof ErrorReel) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
