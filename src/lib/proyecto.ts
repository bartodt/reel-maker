import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandirCasa } from "./entorno.js";
import { ErrorReel } from "./errores.js";

export const EXT_VIDEO = [".mp4", ".mov", ".m4v", ".mkv", ".webm"];
export const EXT_AUDIO = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".mpeg", ".mpga", ".opus", ".aiff", ".aif", ".caf"];
export const EXT_IMAGEN = [".png", ".jpg", ".jpeg", ".webp"];

// recursos/ del repo: lo que sirve para todos los reels (por ejemplo, el logo de la cuenta)
const RECURSOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../recursos");

function buscar(carpeta: string, nombre: string, extensiones: string[]) {
  for (const ext of extensiones) {
    const ruta = path.join(carpeta, nombre + ext);
    if (existsSync(ruta)) return ruta;
  }
  return undefined;
}

/**
 * Estructura esperada de la carpeta del reel:
 *
 *   mi-reel/
 *     clips/          videos crudos
 *     voz.wav         la voz en off (puede ser .mp3, .m4a, etc.)
 *     musica.mp3      opcional
 *     logo.png        opcional, para el cierre (si no está, se usa recursos/logo.png del repo)
 *     edit/           todo lo que se genera
 */
export function abrirProyecto(argumento?: string) {
  if (!argumento) {
    throw new ErrorReel("Falta la carpeta del reel. Ejemplo: npm run limpiar -- ~/reels/playa");
  }
  const raiz = expandirCasa(argumento);
  if (!existsSync(raiz)) throw new ErrorReel(`No existe la carpeta: ${raiz}`);
  const edit = path.join(raiz, "edit");
  mkdirSync(edit, { recursive: true });

  return {
    raiz,
    edit,
    carpetaClips: path.join(raiz, "clips"),
    voz: buscar(raiz, "voz", EXT_AUDIO),
    musica: buscar(raiz, "musica", EXT_AUDIO),
    logo: buscar(raiz, "logo", EXT_IMAGEN) ?? buscar(RECURSOS, "logo", EXT_IMAGEN),
    vozLimpia: path.join(edit, "voz-limpia.wav"),
    transcripcion: path.join(edit, "transcripcion.json"),
    transcripcionTexto: path.join(edit, "transcripcion.md"),
    inventario: path.join(edit, "inventario.json"),
    capturas: path.join(edit, "capturas"),
    plan: path.join(edit, "plan.json"),
    pedazos: path.join(edit, "pedazos"),
    final: path.join(edit, "final.mp4"),

    clips(): string[] {
      if (!existsSync(this.carpetaClips)) return [];
      return readdirSync(this.carpetaClips)
        .filter((f) => EXT_VIDEO.includes(path.extname(f).toLowerCase()))
        .filter((f) => !f.startsWith("."))
        .sort();
    },
  };
}

export type Proyecto = ReturnType<typeof abrirProyecto>;

export function leerJson<T>(ruta: string): T {
  return JSON.parse(readFileSync(ruta, "utf8")) as T;
}

/** Para un archivo que puede faltar o venir roto: en vez de un error de Node, uno que se entiende. */
export function leerJsonRevisado(ruta: string, que: string): unknown {
  if (!existsSync(ruta)) throw new ErrorReel(`No encuentro ${que}: ${ruta}`);
  try {
    return leerJson(ruta);
  } catch {
    throw new ErrorReel(`No puedo leer ${que}, no es un JSON válido: ${ruta}`);
  }
}

export function guardarJson(ruta: string, datos: unknown) {
  writeFileSync(ruta, JSON.stringify(datos, null, 2) + "\n");
}

export function segundos(n: number): string {
  return n.toFixed(2);
}
