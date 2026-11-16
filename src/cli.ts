// Punto de entrada: npm run reel -- <paso> <carpeta>
import { cargarEnv } from "./lib/entorno.js";
import { ErrorReel } from "./lib/errores.js";
import { abrirProyecto, type Proyecto } from "./lib/proyecto.js";
import { comparar } from "./pasos/comparar.js";
import { mandarAEdits } from "./pasos/edits.js";
import { inventario } from "./pasos/inventario.js";
import { limpiar } from "./pasos/limpiar.js";
import { medir } from "./pasos/medir.js";
import { reconstruir } from "./pasos/reconstruir.js";
import { render } from "./pasos/render.js";
import { transcribir } from "./pasos/transcribir.js";
import { validar } from "./pasos/validar.js";

type Comando = (carpeta?: string, archivo?: string) => Promise<unknown>;
const paso = (f: (p: Proyecto) => Promise<unknown>): Comando => (carpeta) => f(abrirProyecto(carpeta));
const conArchivo = (f: (p: Proyecto, archivo?: string) => Promise<unknown>): Comando => (carpeta, archivo) => f(abrirProyecto(carpeta), archivo);

const COMANDOS: Record<string, Comando> = {
  limpiar: paso(limpiar),
  transcribir: paso(transcribir),
  inventario: paso(inventario),
  validar: paso(validar),
  render: paso(render),
  edits: paso(mandarAEdits),
  comparar: conArchivo(comparar),
  reconstruir: conArchivo(reconstruir),
  medir: (carpeta) => medir(carpeta),
};

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
  medir        compara los planes de una corrida con todas las referencias
               npm run medir -- <carpeta-de-la-corrida>

Atajos: npm run limpiar -- <carpeta>, npm run render -- <carpeta>, etc.`;

cargarEnv();

const [nombre, carpeta, extra] = process.argv.slice(2);

if (!nombre || !Object.hasOwn(COMANDOS, nombre)) {
  console.log(AYUDA);
  process.exit(nombre ? 1 : 0);
}

try {
  await COMANDOS[nombre](carpeta, extra);
} catch (e) {
  if (e instanceof ErrorReel) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
