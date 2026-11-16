// Punto de entrada: npm run reel -- <paso> <carpeta>
import { cargarEnv } from "./lib/entorno.js";
import { ErrorReel } from "./lib/errores.js";
import { abrirProyecto } from "./lib/proyecto.js";
import { comparar } from "./pasos/comparar.js";
import { mandarAEdits } from "./pasos/edits.js";
import { inventario } from "./pasos/inventario.js";
import { limpiar } from "./pasos/limpiar.js";
import { reconstruir } from "./pasos/reconstruir.js";
import { render } from "./pasos/render.js";
import { transcribir } from "./pasos/transcribir.js";
import { validar } from "./pasos/validar.js";

const PASOS = { limpiar, transcribir, inventario, validar, render, edits: mandarAEdits } as const;
const CON_ARCHIVO = { comparar, reconstruir } as const;
const TODOS = [...Object.keys(PASOS), ...Object.keys(CON_ARCHIVO)];

const AYUDA = `Uso: npm run reel -- <paso> <carpeta>

Pasos (en orden):
  limpiar      corta los silencios de la voz (Silero VAD)
  transcribir  transcribe la voz limpia (ElevenLabs Scribe)
  inventario   datos y capturas de cada clip
  validar      revisa edit/plan.json
  render       genera edit/final.mp4
  edits        arma el reel en Edits para Mac (en vez de render)

Para probar la herramienta:
  comparar     compara edit/plan.json con un plan de referencia
               npm run comparar -- <carpeta> <referencia.json>
  reconstruir  busca cada plano de un reel publicado en los clips, para armar una referencia
               npm run reconstruir -- <carpeta> <publicado.mp4>

Atajos: npm run limpiar -- <carpeta>, npm run render -- <carpeta>, etc.`;

cargarEnv();

const [nombre, carpeta, extra] = process.argv.slice(2);

if (!nombre || !TODOS.includes(nombre)) {
  console.log(AYUDA);
  process.exit(nombre ? 1 : 0);
}

try {
  const proyecto = abrirProyecto(carpeta);
  if (nombre in CON_ARCHIVO) await CON_ARCHIVO[nombre as keyof typeof CON_ARCHIVO](proyecto, extra);
  else await PASOS[nombre as keyof typeof PASOS](proyecto);
} catch (e) {
  if (e instanceof ErrorReel) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
