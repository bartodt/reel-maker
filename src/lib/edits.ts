// Habla con Edits para Mac por su servidor de automatización (MCP sobre HTTP, solo en esta compu).
// Se activa en Edits › Ajustes › Automation, que también da la clave (EDITS_TOKEN en .env).
import { EDITS } from "../config.js";
import { ErrorReel } from "./errores.js";

const SIN_EDITS =
  "No pude conectarme con Edits. Abrilo en la Mac y fijate que en Ajustes › Automation esté prendido el servidor de automatización.";

type Datos = Record<string, unknown>;

export class Edits {
  private sesion: string | undefined;
  private siguiente = 1;

  constructor(
    private clave: string,
    private url = EDITS.url,
  ) {}

  private async pedir(metodo: string, params: Datos, notificacion = false): Promise<Datos | undefined> {
    let respuesta: Response;
    try {
      respuesta = await fetch(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.clave}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(this.sesion ? { "Mcp-Session-Id": this.sesion } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: metodo, params, ...(notificacion ? {} : { id: this.siguiente++ }) }),
      });
    } catch {
      throw new ErrorReel(SIN_EDITS);
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorReel("Edits no aceptó la clave. Copiala de nuevo de Edits › Ajustes › Automation.");
    }
    if (!respuesta.ok) throw new Error(`Edits respondió ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
    this.sesion = respuesta.headers.get("mcp-session-id") ?? this.sesion;
    if (notificacion) return undefined;

    const texto = await respuesta.text();
    // La respuesta puede venir como JSON o como eventos (text/event-stream): se toma el último mensaje con resultado
    const mensajes = (respuesta.headers.get("content-type") ?? "").includes("text/event-stream")
      ? texto
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => JSON.parse(l.slice(5)) as Datos)
      : [JSON.parse(texto) as Datos];
    const mensaje = mensajes.reverse().find((m) => "result" in m || "error" in m);
    if (!mensaje) throw new Error(`Edits no respondió a ${metodo}`);
    if (mensaje.error) throw new Error(`Edits: ${JSON.stringify(mensaje.error)}`);
    return mensaje.result as Datos;
  }

  async conectar() {
    await this.pedir("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "reel-maker", version: "0.1.0" },
    });
    await this.pedir("notifications/initialized", {}, true);
  }

  /** Usa una herramienta de Edits y devuelve lo que contesta. Si Edits dice que no pudo, tira un error con su mensaje. */
  async usar<T = Datos>(herramienta: string, argumentos: Datos = {}): Promise<T> {
    const resultado = (await this.pedir("tools/call", { name: herramienta, arguments: argumentos })) as {
      content?: { type: string; text?: string }[];
      isError?: boolean;
    };
    const texto = resultado.content?.find((c) => c.type === "text")?.text ?? "{}";
    let datos: Datos;
    try {
      datos = JSON.parse(texto) as Datos;
    } catch {
      datos = { texto };
    }
    if (resultado.isError || datos.ok === false) {
      throw new Error(`Edits no pudo hacer ${herramienta}: ${String(datos.error ?? texto).slice(0, 400)}`);
    }
    return datos as T;
  }
}

/** Una conexión lista para usar, con la clave de .env. */
export async function conectarConEdits() {
  const clave = process.env.EDITS_TOKEN;
  if (!clave) throw new ErrorReel("Falta la clave de Edits. La encontrás en Edits › Ajustes › Automation.");
  const edits = new Edits(clave, process.env.EDITS_URL || EDITS.url);
  await edits.conectar();
  return edits;
}
