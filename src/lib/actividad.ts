// Traduce lo que va haciendo Claude (salida stream-json de `claude -p`) a frases simples para la app.
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Bloque {
  type: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
}

export interface Lectura {
  /** Qué está haciendo, en palabras simples (puede haber varias cosas en un mismo mensaje) */
  actividades: string[];
  /** El mensaje final de Claude */
  resultado?: { texto: string; error: boolean };
}

/** Una línea de la salida de Claude. Si no es JSON o no dice nada útil, devuelve listas vacías. */
export function leerLinea(linea: string): Lectura {
  let evento: { type?: string; subtype?: string; is_error?: boolean; result?: string; message?: { content?: Bloque[] } };
  try {
    evento = JSON.parse(linea);
  } catch {
    return { actividades: [] };
  }
  if (evento.type === "result") {
    const error = evento.is_error === true || evento.subtype !== "success";
    return { actividades: [], resultado: { texto: (evento.result ?? "").trim(), error } };
  }
  if (evento.type !== "assistant" || !Array.isArray(evento.message?.content)) return { actividades: [] };
  const actividades = evento.message.content
    .filter((b) => b.type === "tool_use" && b.name)
    .map((b) => describirHerramienta(b.name!, b.input ?? {}))
    .filter((a): a is string => a !== undefined);
  return { actividades };
}

export function describirHerramienta(nombre: string, entrada: Record<string, unknown>): string | undefined {
  const archivo = String(entrada.file_path ?? entrada.path ?? "");
  const captura = /capturas\/([^/]+)\.jpe?g$/i.exec(archivo);
  switch (nombre) {
    case "Skill":
      return "Repasando cómo se arma un reel";
    case "Read":
      if (captura) return `Mirando el video ${captura[1]}`;
      if (/transcripcion/.test(archivo)) return "Leyendo lo que dice la voz";
      if (/guion/.test(archivo)) return "Leyendo el guion";
      if (/estilo\.md$/.test(archivo)) return "Repasando tu estilo de edición";
      if (/SKILL\.md$/.test(archivo)) return "Repasando cómo se arma un reel";
      if (/inventario\.json$/.test(archivo)) return "Revisando la lista de videos";
      if (/plan\.json$/.test(archivo)) return "Mirando los cortes";
      return undefined;
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (/plan\.json$/.test(archivo)) return "Escribiendo los cortes";
      if (/inventario\.json$/.test(archivo)) return "Anotando qué hay en cada video";
      if (/estilo\.md$/.test(archivo)) return "Anotando tu forma de editar para la próxima";
      return "Guardando cambios";
    case "Bash":
      if (/validar/.test(String(entrada.command ?? ""))) return "Revisando que los cortes cierren";
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Las variables que deja una sesión de Claude Code abierta. Si la app se abrió desde una (por ejemplo, desde la terminal
 * de Claude Code), el Claude que llama la app no se tiene que colgar de esa sesión: tiene que andar como en una terminal nueva.
 *
 * Los comandos de Claude (como `npm run validar`) usan el mismo Node que la app. No alcanza con ponerlo primero en PATH:
 * en macOS la terminal de Claude arranca como login shell y path_helper vuelve a poner adelante /usr/local/bin,
 * donde puede haber un Node viejo. Claude Code corre CLAUDE_ENV_FILE antes de cada comando, después de eso.
 */
export function entornoParaClaude(entorno: NodeJS.ProcessEnv, node: string): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(entorno).filter(([clave]) => !/^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_AGENT_SDK|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_PREVIEW)/.test(clave)),
    ),
    CLAUDE_ENV_FILE: fileURLToPath(new URL("node-de-la-app.sh", import.meta.url)),
    REEL_CARPETA_NODE: path.dirname(node),
  };
}

/** Lo que dice `claude auth status`: si hay sesión iniciada. Si no se entiende la respuesta (una versión vieja), se asume que sí. */
export function leerSesion(salida: string): boolean {
  try {
    return JSON.parse(salida).loggedIn !== false;
  } catch {
    return true;
  }
}
