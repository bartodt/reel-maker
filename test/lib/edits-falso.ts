import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Herramienta } from "../../src/lib/edits.js";
import { info } from "../../src/lib/ffmpeg.js";
import type { ElementoDeEdits, SubtituloDeEdits } from "../../src/lib/montaje.js";
import { EXT_AUDIO, EXT_IMAGEN } from "../../src/lib/proyecto.js";

type Datos = Record<string, unknown>;

export type Falla =
  | { tipo: "rechazo"; motivo: string }
  | { tipo: "resultado"; resultado: unknown }
  | { tipo: "http"; estado: number; tipoDeContenido: string; cuerpo: string }
  | { tipo: "eventos-cortados" }
  | { tipo: "demora"; segundos: number }
  /** Hace lo que se le pidió y no contesta nunca */
  | { tipo: "cuelga" }
  /** Hace lo que se le pidió y corta la conexión sin contestar */
  | { tipo: "corta" };

export interface ElementoFalso extends ElementoDeEdits {
  nombreDeArchivo?: string;
}

interface Medio {
  ruta: string;
  tipo: "video" | "photo" | "music";
  duracion: number;
}

export interface ProyectoFalso {
  id: string;
  name: string;
  guardado: boolean;
  elementos: ElementoFalso[];
  subtitulos: SubtituloDeEdits[];
  estiloDeSubtitulos: string | undefined;
  mediosPorAlias: Map<string, Medio>;
  panelAbierto: boolean;
  pistaPrincipal: string;
  cursor: number;
}

export interface OpcionesDeEditsFalso {
  /** Si no está, usa uno libre */
  puerto?: number;
  /** Cuántos segundos dura un archivo de video o audio. Si no está, lo lee con ffprobe (y el archivo tiene que existir). */
  duracion?: (ruta: string) => number | Promise<number>;
  /** Lo que "entiende" Edits cuando escribe los subtítulos */
  subtitulos?: Omit<SubtituloDeEdits, "id">[];
  /** Qué llamadas a addText (la primera es 1) dejan el texto donde estaba el cursor y no donde se pidió */
  textosAlCursor?: number[];
  /** Cuántos listados de `projects` siguen mostrando un proyecto recién borrado */
  listadosAtrasados?: number;
}

/** Edits contesta que no pudo. Casi siempre lo dice con JSON; cuando la herramienta no existe en esa pantalla, con texto suelto. */
class Rechazo extends Error {
  constructor(
    motivo: string,
    readonly conTextoSuelto = false,
  ) {
    super(motivo);
  }
}

type DeInicio = "appState" | "projects" | "newProject" | "deleteProject" | "closeProject";
type DelEditor = Exclude<Herramienta, DeInicio>;

const DURACION_DE_UNA_IMAGEN = 3;
const JPEG_DE_8_POR_8 =
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACD4+ST5JVVVVVVVVZF1kaGhoZGRkZGhoaHBwcIODg3BwcGhocHB8fIODj5OPh4eDh5OTm5uburqystnZ4P/////EAEoAAQAAAAAAAAAAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAIAAgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwAAD//Z";

const esObjeto = (v: unknown): v is Datos => typeof v === "object" && v !== null && !Array.isArray(v);
const esTexto = (v: unknown): v is string => typeof v === "string" && v !== "";
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const esBooleano = (v: unknown): v is boolean => typeof v === "boolean";
const esListaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(esTexto);
const tiene = <T extends object>(tabla: T, nombre: string): nombre is keyof T & string => Object.hasOwn(tabla, nombre);

/** Edits lleva todos los tiempos al cuadro más cercano de un proyecto de 60 cuadros por segundo. */
const alCuadro = (segundos: number) => Math.round(segundos * 60) / 60;

function argumento<T>(a: Datos, nombre: string, es: (v: unknown) => v is T): T {
  const valor = a[nombre];
  if (!es(valor)) throw new Rechazo(`invalid argument "${nombre}": ${JSON.stringify(valor)}`);
  return valor;
}

function argumentoOpcional<T>(a: Datos, nombre: string, es: (v: unknown) => v is T): T | undefined {
  return a[nombre] === undefined ? undefined : argumento(a, nombre, es);
}

function elementoDe(p: ProyectoFalso, a: Datos) {
  const id = argumento(a, "id", esTexto);
  const elemento = p.elementos.find((e) => e.id === id);
  if (!elemento) throw new Rechazo(`element not found: ${id}`);
  return elemento;
}

function textoDe(p: ProyectoFalso, a: Datos) {
  const elemento = elementoDe(p, a);
  if (elemento.content !== "text") throw new Rechazo("not a text element");
  return elemento;
}

async function duracionConFfprobe(ruta: string) {
  if (!existsSync(ruta)) throw new Rechazo(`file not found: ${ruta}`);
  return (await info(ruta)).duracion;
}

function tipoDeMedio(ruta: string): Medio["tipo"] {
  const extension = path.extname(ruta).toLowerCase();
  if (EXT_IMAGEN.includes(extension)) return "photo";
  return EXT_AUDIO.includes(extension) ? "music" : "video";
}

function responder(respuesta: ServerResponse, estado: number, tipo: string, cuerpo: string) {
  respuesta.writeHead(estado, { "Content-Type": tipo });
  respuesta.end(cuerpo);
}

export function puertoDe(servidor: Server) {
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === "string") throw new Error("El servidor no está escuchando en un puerto.");
  return direccion.port;
}

export class EditsFalso {
  readonly clave = "clave-del-edits-falso";
  readonly proyectos: ProyectoFalso[] = [];
  readonly llamadas: { herramienta: string; argumentos: Datos }[] = [];
  abierto: ProyectoFalso | undefined;

  private fallas: { herramienta: Herramienta; falla: Falla; vez: number | undefined }[] = [];
  private borrados: { proyecto: ProyectoFalso; listados: number }[] = [];
  private servidor: Server;

  private constructor(private opciones: OpcionesDeEditsFalso) {
    this.servidor = createServer((pedido, respuesta) => {
      const trozos: Buffer[] = [];
      pedido.on("data", (t: Buffer) => trozos.push(t));
      pedido.on("end", () => {
        this.atender(pedido.headers.authorization, Buffer.concat(trozos).toString("utf8"), respuesta).catch((e) =>
          responder(respuesta, 500, "text/plain", `El Edits falso se rompió: ${e instanceof Error ? e.stack : String(e)}`),
        );
      });
    });
  }

  static async abrir(opciones: OpcionesDeEditsFalso = {}) {
    const falso = new EditsFalso(opciones);
    await new Promise<void>((listo) => falso.servidor.listen(opciones.puerto ?? 0, "127.0.0.1", listo));
    return falso;
  }

  get url() {
    return `http://127.0.0.1:${puertoDe(this.servidor)}/mcp`;
  }

  conoce(herramienta: string): herramienta is Herramienta {
    return tiene(this.deInicio, herramienta) || tiene(this.delEditor, herramienta);
  }

  /** Hace fallar esa herramienta. Con `vez`, solo esa llamada (la primera es 1); sin `vez`, todas. */
  fallar(herramienta: Herramienta, falla: Falla, vez?: number) {
    this.fallas.push({ herramienta, falla, vez });
  }

  async cerrar() {
    this.servidor.closeAllConnections();
    await new Promise((listo) => this.servidor.close(listo));
  }

  private async atender(autorizacion: string | undefined, cuerpo: string, respuesta: ServerResponse) {
    if (autorizacion !== `Bearer ${this.clave}`) return responder(respuesta, 401, "text/plain", "Unauthorized");
    const pedido: unknown = JSON.parse(cuerpo);
    if (!esObjeto(pedido)) return responder(respuesta, 400, "text/plain", "Bad Request");
    const params = esObjeto(pedido.params) ? pedido.params : {};
    const contestar = (resultado: unknown) => responder(respuesta, 200, "application/json", JSON.stringify({ jsonrpc: "2.0", id: pedido.id, result: resultado }));

    if (pedido.method === "initialize") {
      return contestar({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "edits-falso", version: "1" } });
    }
    if (pedido.method === "notifications/initialized") return responder(respuesta, 202, "application/json", "");
    if (pedido.method !== "tools/call") {
      const error = { code: -32601, message: `Method not found: ${pedido.method}` };
      return responder(respuesta, 200, "application/json", JSON.stringify({ jsonrpc: "2.0", id: pedido.id, error }));
    }

    const herramienta = esTexto(params.name) ? params.name : "";
    const argumentos = esObjeto(params.arguments) ? params.arguments : {};
    this.llamadas.push({ herramienta, argumentos });
    const vez = this.llamadas.filter((l) => l.herramienta === herramienta).length;
    const falla = this.fallas.find((f) => f.herramienta === herramienta && (f.vez === undefined || f.vez === vez))?.falla;

    if (falla?.tipo === "demora") await new Promise((listo) => setTimeout(listo, falla.segundos * 1000));
    if (falla?.tipo === "http") return responder(respuesta, falla.estado, falla.tipoDeContenido, falla.cuerpo);
    if (falla?.tipo === "eventos-cortados") {
      return responder(respuesta, 200, "text/event-stream", `event: message\ndata: {"jsonrpc":"2.0","id":${pedido.id},"resu`);
    }
    if (falla?.tipo === "resultado") return contestar(falla.resultado);
    try {
      if (falla?.tipo === "rechazo") throw new Rechazo(falla.motivo);
      const datos = await this.usar(herramienta, argumentos, vez);
      if (falla?.tipo === "cuelga") return;
      if (falla?.tipo === "corta") return respuesta.destroy();
      const partes: Datos[] = [{ type: "text", text: JSON.stringify({ ok: true, ...datos }) }];
      if (herramienta === "captureFrame") partes.unshift({ type: "image", data: JPEG_DE_8_POR_8, mimeType: "image/jpeg" });
      contestar({ content: partes, isError: false });
    } catch (e) {
      if (!(e instanceof Rechazo)) throw e;
      const dicho = e.conTextoSuelto ? e.message : JSON.stringify({ ok: false, error: e.message });
      contestar({ content: [{ type: "text", text: dicho }], isError: true });
    }
  }

  private usar(herramienta: string, a: Datos, vez: number): Datos | Promise<Datos> {
    if (tiene(this.deInicio, herramienta)) return this.deInicio[herramienta](a);
    if (!tiene(this.delEditor, herramienta) || !this.abierto) throw new Rechazo(`unknown tool (not in current manifest): ${herramienta}`, true);
    return this.delEditor[herramienta](this.abierto, a, vez);
  }

  private deInicio: Record<DeInicio, (a: Datos) => Datos> = {
    appState: () => ({ screen: this.abierto ? "editor" : "home" }),
    projects: () => {
      // Un proyecto recién borrado sigue apareciendo en algunos listados
      const atrasados = this.borrados.filter((b) => b.listados-- > 0).map((b) => b.proyecto);
      return { projects: [...this.proyectos, ...atrasados].map((p) => ({ id: p.id, name: p.name })) };
    },
    newProject: () => {
      this.abierto = {
        id: randomUUID(),
        name: "New project 1",
        guardado: false,
        elementos: [],
        subtitulos: [],
        estiloDeSubtitulos: undefined,
        mediosPorAlias: new Map(),
        panelAbierto: false,
        pistaPrincipal: randomUUID(),
        cursor: 0,
      };
      this.proyectos.push(this.abierto);
      return { id: this.abierto.id };
    },
    closeProject: () => {
      const cerrado = this.abierto;
      this.abierto = undefined;
      return cerrado
        ? { alreadyOnHome: false, closedProjectIdObserved: true, closedProjectId: cerrado.id, screen: "home" }
        : { alreadyOnHome: true, closedProjectIdObserved: false, screen: "home" };
    },
    deleteProject: (a) => {
      const id = argumento(a, "id", esTexto);
      const i = this.proyectos.findIndex((p) => p.id === id);
      if (i < 0) throw new Rechazo(`project not found: ${id}`);
      const [proyecto] = this.proyectos.splice(i, 1);
      if (this.abierto === proyecto) this.abierto = undefined;
      this.borrados.push({ proyecto, listados: this.opciones.listadosAtrasados ?? 0 });
      return {};
    },
  };

  private delEditor: Record<DelEditor, (p: ProyectoFalso, a: Datos, vez: number) => Datos | Promise<Datos>> = {
    title: (p) => ({ title: p.name }),
    setTitle: (p, a) => {
      p.name = argumento(a, "name", esTexto);
      return { title: p.name };
    },
    saveProject: (p) => {
      p.guardado = true;
      return { saved: true, projectId: p.id };
    },
    importToMediaPanel: async (p, a) => {
      const ruta = argumento(a, "path", esTexto);
      // Recién creado el proyecto, la primera importación falla y no importa nada
      if (!p.panelAbierto) {
        p.panelAbierto = true;
        throw new Rechazo("no media panel — it did not open");
      }
      const tipo = tipoDeMedio(ruta);
      const duracion = tipo === "photo" ? DURACION_DE_UNA_IMAGEN : await (this.opciones.duracion ?? duracionConFfprobe)(ruta);
      const alias = randomUUID();
      p.mediosPorAlias.set(alias, { ruta, tipo, duracion });
      return { aliasIds: [alias] };
    },
    addMediaPanelItemsToTimeline: (p, a) => {
      const alias = argumento(a, "aliasIds", (v): v is [string] => esListaDeTextos(v) && v.length === 1)[0];
      const medio = p.mediosPorAlias.get(alias);
      if (!medio) throw new Rechazo(`alias not found: ${alias}`);
      const hasta = argumentoOpcional(a, "sourceOut", esNumero) ?? medio.duracion;
      const pista = argumentoOpcional(a, "trackId", esTexto);
      argumentoOpcional(a, "asOverlay", esBooleano);
      // Edits mide los archivos en 1/600 de segundo, redondeando para abajo
      const largo = Math.floor(medio.duracion * 600) / 600;
      if (medio.tipo !== "photo" && hasta > largo + 1e-9) throw new Rechazo(`sourceOut is past the source end (${largo}s)`);
      const desde = alCuadro(argumentoOpcional(a, "sourceIn", esNumero) ?? 0);
      const inicio = alCuadro(argumentoOpcional(a, "startTime", esNumero) ?? p.cursor);
      const fin = inicio + alCuadro(hasta) - desde;
      if (fin <= inicio) throw new Rechazo("sourceOut must be after sourceIn");
      if (pista) {
        const enLaPista = p.elementos.filter((e) => e.trackId === pista);
        if (enLaPista.length === 0) throw new Rechazo(`track not found: ${pista}`);
        if (enLaPista.some((e) => e.startTime < fin - 1e-9 && inicio < e.endTime - 1e-9)) throw new Rechazo("the range on that track is not free");
      }
      const elemento: ElementoFalso = {
        id: randomUUID(),
        trackId: pista ?? randomUUID(),
        trackType: medio.tipo === "music" ? "audio" : "overlay",
        content: medio.tipo,
        startTime: inicio,
        endTime: fin,
        sourceInPoint: desde,
        sourceOutPoint: alCuadro(hasta),
        speed: 1,
        volume: 1,
        nombreDeArchivo: path.basename(medio.ruta),
      };
      p.elementos.push(elemento);
      p.cursor = fin;
      return { added: [{ id: elemento.id, trackId: elemento.trackId, start: elemento.startTime, end: elemento.endTime, newTrack: !pista }] };
    },
    setSpeed: (p, a) => {
      const elemento = elementoDe(p, a);
      const velocidad = argumento(a, "speed", esNumero);
      if (velocidad <= 0) throw new Rechazo("speed must be greater than 0");
      elemento.endTime = elemento.startTime + alCuadro(((elemento.endTime - elemento.startTime) * (elemento.speed ?? 1)) / velocidad);
      elemento.speed = velocidad;
      return { speed: velocidad };
    },
    convertToMain: (p, a) => {
      const elemento = elementoDe(p, a);
      if (elemento.trackType !== "overlay" || elemento.content === "text") throw new Rechazo("not an overlay clip");
      const finDeLaPrincipal = Math.max(0, ...p.elementos.filter((e) => e.trackId === p.pistaPrincipal).map((e) => e.endTime));
      const duracion = elemento.endTime - elemento.startTime;
      elemento.trackType = "video";
      // La pista principal solo recibe lo que se le agrega al final: lo que cae en el medio queda en otra pista
      if (elemento.startTime < finDeLaPrincipal - 0.05) {
        elemento.trackId = randomUUID();
      } else {
        elemento.trackId = p.pistaPrincipal;
        elemento.startTime = finDeLaPrincipal;
        elemento.endTime = finDeLaPrincipal + duracion;
      }
      return { converted: true, to: "main", trackId: elemento.trackId };
    },
    setVolume: (p, a) => {
      const elemento = elementoDe(p, a);
      const volumen = argumento(a, "volume", esNumero);
      if (volumen < 0 || volumen > 10) throw new Rechazo("volume must be in 0...10");
      elemento.volume = volumen;
      return { volume: volumen };
    },
    move: (p, a) => {
      const elemento = elementoDe(p, a);
      const inicio = alCuadro(argumento(a, "toSeconds", esNumero));
      elemento.endTime += inicio - elemento.startTime;
      elemento.startTime = inicio;
      return {};
    },
    elements: (p, a) => {
      const pista = argumentoOpcional(a, "trackId", esTexto);
      const campos = argumentoOpcional(a, "fields", esListaDeTextos);
      const desde = argumentoOpcional(a, "offset", esNumero) ?? 0;
      const limite = argumentoOpcional(a, "limit", esNumero) ?? 200;
      // Los subtítulos también son textos de la línea de tiempo
      const deSubtitulos = p.subtitulos.map((s): ElementoFalso => ({ ...s, trackId: "subtitulos", trackType: "overlay", content: "text", speed: 1, volume: 1 }));
      const todos = [...p.elementos, ...deSubtitulos].filter((e) => !pista || e.trackId === pista);
      const pagina = todos.slice(desde, desde + limite).map(({ nombreDeArchivo: _, ...e }): Datos => e);
      return {
        total: todos.length,
        elements: campos ? pagina.map((e) => Object.fromEntries(campos.map((c) => [c, e[c]]))) : pagina,
        ...(desde + limite < todos.length ? { nextOffset: desde + limite } : {}),
      };
    },
    addText: (p, a, vez) => {
      const pedido = alCuadro(argumentoOpcional(a, "atSeconds", esNumero) ?? p.cursor);
      // A veces Edits pone el texto donde estaba el cursor y lo dice en su respuesta
      const inicio = this.opciones.textosAlCursor?.includes(vez) ? p.cursor : pedido;
      const elemento: ElementoFalso = {
        id: randomUUID(),
        trackId: randomUUID(),
        trackType: "overlay",
        content: "text",
        startTime: inicio,
        endTime: inicio + alCuadro(argumento(a, "duration", esNumero)),
        speed: 1,
        volume: 1,
        text: argumento(a, "text", esTexto),
        animation: "none",
      };
      p.elementos.push(elemento);
      return { id: elemento.id, startTime: elemento.startTime, insertedAtSeconds: elemento.startTime };
    },
    setTextStyle: (p, a) => {
      textoDe(p, a);
      return {};
    },
    setTextPosition: (p, a) => {
      textoDe(p, a);
      return { x: argumento(a, "x", esNumero), y: argumento(a, "y", esNumero) };
    },
    setTextAnimation: (p, a) => {
      const animacion = argumento(a, "animation", esTexto);
      textoDe(p, a).animation = animacion;
      return { animation: animacion };
    },
    addOverlay: (p, a) => {
      const ruta = argumento(a, "path", esTexto);
      if (!this.opciones.duracion && !existsSync(ruta)) throw new Rechazo(`file not found: ${ruta}`);
      const inicio = alCuadro(argumento(a, "startSeconds", esNumero));
      for (const nombre of ["x", "y", "scale"]) argumento(a, nombre, esNumero);
      const elemento: ElementoFalso = {
        id: randomUUID(),
        trackId: randomUUID(),
        trackType: "overlay",
        content: tipoDeMedio(ruta),
        startTime: inicio,
        endTime: inicio + DURACION_DE_UNA_IMAGEN,
        speed: 1,
        volume: 1,
        nombreDeArchivo: path.basename(ruta),
      };
      p.elementos.push(elemento);
      return { id: elemento.id, trackId: elemento.trackId };
    },
    getElement: (p, a) => {
      const { nombreDeArchivo: _, ...elemento } = elementoDe(p, a);
      return { ...elemento, duration: elemento.endTime - elemento.startTime };
    },
    trimClip: (p, a) => {
      const elemento = elementoDe(p, a);
      const lado = argumento(a, "side", esTexto);
      const delta = argumento(a, "delta", esNumero);
      if (lado !== "start" && lado !== "end") throw new Rechazo(`invalid side: ${lado}`);
      const [inicio, fin] = lado === "end" ? [elemento.startTime, alCuadro(elemento.endTime - delta)] : [alCuadro(elemento.startTime + delta), elemento.endTime];
      if (fin <= inicio) throw new Rechazo("trim would leave an empty clip");
      [elemento.startTime, elemento.endTime] = [inicio, fin];
      return { trimmed: true, duration: fin - inicio };
    },
    generateCaptions: (p, a) => {
      argumento(a, "source", esTexto);
      argumento(a, "language", esTexto);
      argumento(a, "curseWords", esBooleano);
      p.subtitulos = (this.opciones.subtitulos ?? []).map((s) => ({ ...s, id: randomUUID() }));
      return { generatedCount: p.subtitulos.length };
    },
    captions: (p) => ({ captions: p.subtitulos }),
    editCaption: (p, a) => {
      const id = argumento(a, "id", esTexto);
      const subtitulo = p.subtitulos.find((s) => s.id === id);
      if (!subtitulo) throw new Rechazo(`caption not found: ${id}`);
      // Edits no muestra el punto ni los dos puntos del final de un subtítulo
      subtitulo.text = argumento(a, "text", esTexto).replace(/[.:]$/, "");
      return { id };
    },
    deleteCaptions: (p, a) => {
      const id = argumentoOpcional(a, "id", esTexto);
      if (id && !p.subtitulos.some((s) => s.id === id)) throw new Rechazo(`caption not found: ${id}`);
      const antes = p.subtitulos.length;
      // Sin id, Edits borra todos
      p.subtitulos = id ? p.subtitulos.filter((s) => s.id !== id) : [];
      return { deletedCount: antes - p.subtitulos.length };
    },
    setCaptionStyle: (p, a) => {
      p.estiloDeSubtitulos = argumento(a, "style", esTexto);
      return { applied: p.estiloDeSubtitulos };
    },
    captureFrame: (_, a) => ({ time: argumentoOpcional(a, "atSeconds", esNumero) ?? 0, format: "jpeg" }),
  };
}

const AYUDA = `Edits falso, para probar la terminal o la app sin Edits.

  npx tsx test/lib/edits-falso.ts [--puerto 19599] [--falla <herramienta>[@<vez>]] [--como <modo>] [--demora <herramienta>[@<vez>]:<segundos>]

  --falla convertToMain@3      la tercera llamada a convertToMain falla (sin @, todas)
  --como rechazo               cómo falla: rechazo (Edits dice que no pudo), html, 500, cortado (eventos a medias),
                               vacio (sin datos), cuelga (no contesta nunca) o corta (corta la conexión)
  --demora convertToMain@3:30  esa llamada tarda 30 segundos en contestar y después contesta bien

Imprime qué poner en EDITS_URL y EDITS_TOKEN. EDITS_CARPETA puede ser cualquier carpeta.
Con EDITS_ESPERA=5 el armado espera 5 segundos cada respuesta en vez de 180.`;

const MODOS: Record<string, Falla> = {
  rechazo: { tipo: "rechazo", motivo: "falla pedida al Edits falso" },
  html: { tipo: "http", estado: 200, tipoDeContenido: "text/html", cuerpo: "<html><body>Edits</body></html>" },
  "500": { tipo: "http", estado: 500, tipoDeContenido: "text/plain", cuerpo: "Internal Server Error" },
  cortado: { tipo: "eventos-cortados" },
  vacio: { tipo: "resultado", resultado: { content: [{ type: "text", text: "{}" }] } },
  cuelga: { tipo: "cuelga" },
  corta: { tipo: "corta" },
};

async function prender(args: string[]) {
  const valor = (nombre: string) => (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : undefined);
  if (args.includes("--ayuda")) return console.log(AYUDA);

  const falso = await EditsFalso.abrir({ puerto: Number(valor("--puerto") ?? 19599) });
  const fallar = (herramienta: string, falla: Falla, vez?: number) => {
    if (!falso.conoce(herramienta)) throw new Error(`El Edits falso no tiene la herramienta "${herramienta}".`);
    falso.fallar(herramienta, falla, vez);
  };
  const modo = valor("--como") ?? "rechazo";
  if (!tiene(MODOS, modo)) throw new Error(`No conozco el modo "${modo}". Mirá --ayuda.`);
  const [queFalla, vez] = valor("--falla")?.split("@") ?? [];
  if (queFalla) fallar(queFalla, MODOS[modo], vez ? Number(vez) : undefined);
  const [lenta, segundos] = valor("--demora")?.split(":") ?? [];
  const [queTarda, vezLenta] = lenta?.split("@") ?? [];
  if (queTarda) fallar(queTarda, { tipo: "demora", segundos: Number(segundos) }, vezLenta ? Number(vezLenta) : undefined);

  console.log(`Edits falso prendido. Para usarlo:\n  EDITS_URL=${falso.url} EDITS_TOKEN=${falso.clave} EDITS_CARPETA=<una carpeta>`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prender(process.argv.slice(2));
