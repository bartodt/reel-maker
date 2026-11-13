import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ErrorReel } from "./errores.js";

const EXT_VIDEO = [".mp4", ".mov", ".m4v", ".mkv", ".webm"];
const EXT_AUDIO = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"];

/**
 * Estructura esperada de la carpeta del reel:
 *
 *   mi-reel/
 *     clips/          videos crudos
 *     voz.wav         la voz en off (puede ser .mp3, .m4a, etc.)
 *     musica.mp3      opcional
 *     edit/           todo lo que se genera
 */
export function abrirProyecto(argumento?: string) {
  if (!argumento) {
    throw new ErrorReel("Falta la carpeta del reel. Ejemplo: npm run limpiar -- ~/reels/playa");
  }
  const raiz = path.resolve(argumento.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));
  if (!existsSync(raiz)) throw new ErrorReel(`No existe la carpeta: ${raiz}`);
  const edit = path.join(raiz, "edit");
  mkdirSync(edit, { recursive: true });

  const buscarAudio = (nombre: string) => {
    for (const ext of EXT_AUDIO) {
      const ruta = path.join(raiz, nombre + ext);
      if (existsSync(ruta)) return ruta;
    }
    return undefined;
  };

  return {
    raiz,
    edit,
    carpetaClips: path.join(raiz, "clips"),
    voz: buscarAudio("voz"),
    musica: buscarAudio("musica"),
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

export function guardarJson(ruta: string, datos: unknown) {
  writeFileSync(ruta, JSON.stringify(datos, null, 2) + "\n");
}

export function segundos(n: number): string {
  return n.toFixed(2);
}
