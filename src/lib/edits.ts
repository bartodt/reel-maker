// Habla con Edits para Mac por su servidor de automatización (MCP sobre HTTP, solo en esta compu).
// Se activa en Edits › Ajustes › Automation, que también da la clave (EDITS_TOKEN en .env).
import path from "node:path";
import { EDITS } from "../config.js";
import { ErrorReel } from "./errores.js";
import type { ElementoDeEdits, SubtituloDeEdits } from "./montaje.js";

const SIN_EDITS =
  "No pude conectarme con Edits. Abrilo en la Mac y fijate que en Ajustes › Automation esté prendido el servidor de automatización.";

export type Herramienta =
  | "addMediaPanelItemsToTimeline"
  | "addOverlay"
  | "addText"
  | "appState"
  | "captions"
  | "captureFrame"
  | "closeProject"
  | "convertToMain"
  | "deleteCaptions"
  | "deleteProject"
  | "editCaption"
  | "elements"
  | "generateCaptions"
  | "getElement"
  | "importToMediaPanel"
  | "move"
  | "newProject"
  | "projects"
  | "saveProject"
  | "setCaptionStyle"
  | "setSpeed"
  | "setTextAnimation"
  | "setTextPosition"
  | "setTextStyle"
  | "setTitle"
  | "setVolume"
  | "title"
  | "trimClip";

type Marca<M extends string> = string & { readonly __brand: M };
export type IdDeProyecto = Marca<"IdDeProyecto">;
export type IdDeElemento = Marca<"IdDeElemento">;
export type IdDePista = Marca<"IdDePista">;
/** Un archivo ya cargado en el panel de medios del proyecto abierto */
export type Alias = Marca<"Alias">;

export interface ProyectoDeEdits {
  id: IdDeProyecto;
  nombre: string;
}

/** En "cargando" Edits está abriendo un proyecto y solo deja preguntar la pantalla y cerrarlo. */
export type Pantalla = "inicio" | "cargando" | "editor";
const PANTALLAS: Record<string, Pantalla> = { home: "inicio", loading: "cargando", editor: "editor" };

/** `inicio` es donde lo puso Edits, que no siempre es donde se le pidió. */
export interface Agregado {
  id: IdDeElemento;
  inicio: number;
}

type Falla = "rechazo" | "respuesta" | "conexion";

const MENSAJES: Record<Falla, (que: string) => string> = {
  rechazo: (que) => `Edits no pudo ${que}.`,
  respuesta: (que) => `No entendí lo que contestó Edits al ${que}. Avisale a quien te instaló la app.`,
  conexion: (que) => `Edits dejó de contestar al ${que}. Fijate que siga abierto y probá de nuevo.`,
};

const DETALLES: Record<Falla, (herramienta: Herramienta, motivo: string) => string> = {
  rechazo: (herramienta, motivo) => `Edits contestó a ${herramienta}: ${motivo}`,
  respuesta: (herramienta, motivo) => `En la respuesta de ${herramienta}, ${motivo}`,
  conexion: (herramienta, motivo) => `${herramienta} quedó sin respuesta: ${motivo}`,
};

/**
 * El mensaje dice qué paso falló y se le puede mostrar a la creadora.
 * `motivo` es el detalle para quien mantiene esto: la herramienta y lo que contestó Edits.
 */
export class ErrorDeEdits extends ErrorReel {
  constructor(
    falla: Falla,
    que: string,
    readonly motivo: string,
  ) {
    super(MENSAJES[falla](que));
    this.name = "ErrorDeEdits";
  }
}

class FallaSinPaso extends Error {
  constructor(
    readonly falla: Falla,
    motivo: string,
  ) {
    super(motivo);
  }
}

type Datos = Record<string, unknown>;

const esObjeto = (v: unknown): v is Datos => typeof v === "object" && v !== null && !Array.isArray(v);
const esTexto = (v: unknown): v is string => typeof v === "string";
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const esId = <M extends string>(v: unknown): v is Marca<M> => esTexto(v) && v !== "";
const esLista =
  <T>(es: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(es);

function campo<T>(datos: Datos, nombre: string, es: (v: unknown) => v is T, esperado: string): T {
  const valor = datos[nombre];
  if (es(valor)) return valor;
  const vino = valor === undefined ? "no vino" : `vino ${JSON.stringify(valor).slice(0, 100)}`;
  throw new FallaSinPaso("respuesta", `"${nombre}" tenía que ser ${esperado} y ${vino}`);
}

const texto = (datos: Datos, nombre: string) => campo(datos, nombre, esTexto, "un texto");
const numero = (datos: Datos, nombre: string) => campo(datos, nombre, esNumero, "un número");
const id = <M extends string>(datos: Datos, nombre: string) => campo(datos, nombre, esId<M>, "un id");
const ids = <M extends string>(datos: Datos, nombre: string) => campo(datos, nombre, esLista(esId<M>), "una lista de ids");
const lista = (datos: Datos, nombre: string) => campo(datos, nombre, esLista(esObjeto), "una lista");
const textoSiVino = (datos: Datos, nombre: string) => (datos[nombre] == null ? undefined : texto(datos, nombre));
const numeroSiVino = (datos: Datos, nombre: string) => (datos[nombre] == null ? undefined : numero(datos, nombre));

function unico<T>(valores: T[], nombre: string): T {
  if (valores.length !== 1) throw new FallaSinPaso("respuesta", `"${nombre}" tenía que traer 1 y trajo ${valores.length}`);
  return valores[0];
}

function objetoDeJson(json: string | undefined): Datos | undefined {
  try {
    const valor: unknown = JSON.parse(json ?? "");
    return esObjeto(valor) ? valor : undefined;
  } catch {
    return undefined;
  }
}

interface Contestado {
  datos: Datos;
  imagenEnBase64: string | undefined;
}

function leerResultado(resultado: unknown): Contestado {
  if (!esObjeto(resultado)) throw new FallaSinPaso("respuesta", `el resultado no es un objeto: ${JSON.stringify(resultado)}`);
  const partes = Array.isArray(resultado.content) ? resultado.content.filter(esObjeto) : [];
  const dicho = partes.map((p) => (p.type === "text" ? p.text : undefined)).find(esTexto);
  const datos = objetoDeJson(dicho) ?? {};
  if (resultado.isError === true || datos.ok === false) {
    // Junto con el error Edits a veces manda datos que sirven, como el id del proyecto que creó y no pudo abrir
    const { error, ok: _, ...resto } = datos;
    const ademas = Object.keys(resto).length ? ` ${JSON.stringify(resto).slice(0, 300)}` : "";
    throw new FallaSinPaso("rechazo", esTexto(error) ? error + ademas : (dicho ?? "no dijo por qué"));
  }
  return { datos, imagenEnBase64: partes.map((p) => (p.type === "image" ? p.data : undefined)).find(esTexto) };
}

function leerElemento(e: Datos): ElementoDeEdits {
  return {
    id: texto(e, "id"),
    trackId: texto(e, "trackId"),
    trackType: texto(e, "trackType"),
    content: texto(e, "content"),
    startTime: numero(e, "startTime"),
    endTime: numero(e, "endTime"),
    sourceInPoint: numeroSiVino(e, "sourceInPoint"),
    sourceOutPoint: numeroSiVino(e, "sourceOutPoint"),
    speed: numeroSiVino(e, "speed"),
    volume: numeroSiVino(e, "volume"),
    text: textoSiVino(e, "text"),
    animation: textoSiVino(e, "animation"),
  };
}

const nada = () => undefined;

/**
 * Una función por herramienta de Edits. Las que tocan la línea de tiempo reciben `que`: el paso del armado que se
 * estaba haciendo ("poner el plano 3 en la pista principal"), que es lo que dice el error si Edits falla.
 */
export class Edits {
  private sesion: string | undefined;
  private siguiente = 1;

  constructor(
    private clave: string,
    private url = EDITS.url,
    /** Segundos que se espera cada respuesta */
    private esperaMaxima = EDITS.esperaMaxima,
  ) {}

  async conectar() {
    try {
      await this.pedir("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "reel-maker", version: "0.1.0" },
      });
      await this.pedir("notifications/initialized", {}, true);
    } catch (e) {
      throw e instanceof FallaSinPaso ? new ErrorReel(SIN_EDITS) : e;
    }
  }

  async pantalla(): Promise<Pantalla> {
    return this.usar("appState", {}, "decir en qué pantalla está", ({ datos }) => {
      const pantalla = texto(datos, "screen");
      if (!Object.hasOwn(PANTALLAS, pantalla)) throw new FallaSinPaso("respuesta", `no conozco la pantalla "${pantalla}"`);
      return PANTALLAS[pantalla];
    });
  }

  async proyectos(): Promise<ProyectoDeEdits[]> {
    return this.usar("projects", {}, "listar los proyectos", ({ datos }) =>
      lista(datos, "projects").map((p) => ({ id: id<"IdDeProyecto">(p, "id"), nombre: texto(p, "name") })),
    );
  }

  async proyectoNuevo(): Promise<IdDeProyecto> {
    return this.usar("newProject", {}, "crear el proyecto", ({ datos }) => id<"IdDeProyecto">(datos, "id"));
  }

  async titulo(): Promise<string> {
    return this.usar("title", {}, "decir cómo se llama el proyecto abierto", ({ datos }) => texto(datos, "title"));
  }

  async ponerTitulo(nombre: string): Promise<void> {
    await this.usar("setTitle", { name: nombre }, "ponerle el nombre al proyecto", nada);
  }

  async guardarProyecto(): Promise<void> {
    await this.usar("saveProject", {}, "guardar el proyecto", nada);
  }

  /** Devuelve el proyecto que cerró, si había uno abierto y Edits llegó a ver cuál era. */
  async cerrarProyecto(): Promise<IdDeProyecto | undefined> {
    return this.usar("closeProject", {}, "cerrar el proyecto", ({ datos }) =>
      datos.closedProjectId == null ? undefined : id<"IdDeProyecto">(datos, "closedProjectId"),
    );
  }

  async borrarProyecto(proyecto: IdDeProyecto): Promise<void> {
    await this.usar("deleteProject", { id: proyecto }, "borrar el proyecto", nada);
  }

  async importar(ruta: string): Promise<Alias> {
    return this.usar("importToMediaPanel", { path: ruta }, `cargar ${path.basename(ruta)}`, ({ datos }) =>
      unico(ids<"Alias">(datos, "aliasIds"), "aliasIds"),
    );
  }

  /** `desde` y `hasta` son segundos del archivo; `inicio`, del reel. */
  async agregarALaLinea(
    o: { alias: Alias; desde: number; hasta: number; inicio: number; superpuesto?: boolean; pista?: IdDePista },
    que: string,
  ): Promise<Agregado & { pista: IdDePista }> {
    const argumentos = {
      aliasIds: [o.alias],
      sourceIn: o.desde,
      sourceOut: o.hasta,
      startTime: o.inicio,
      ...(o.superpuesto ? { asOverlay: true } : {}),
      ...(o.pista ? { trackId: o.pista } : {}),
    };
    return this.usar("addMediaPanelItemsToTimeline", argumentos, que, ({ datos }) => {
      const agregado = unico(lista(datos, "added"), "added");
      return { id: id<"IdDeElemento">(agregado, "id"), pista: id<"IdDePista">(agregado, "trackId"), inicio: numero(agregado, "start") };
    });
  }

  async cambiarVelocidad(elemento: IdDeElemento, velocidad: number, que: string): Promise<void> {
    await this.usar("setSpeed", { id: elemento, speed: velocidad }, que, nada);
  }

  /** Devuelve la pista en la que quedó, que puede no ser la principal. */
  async pasarAPrincipal(elemento: IdDeElemento, que: string): Promise<IdDePista> {
    return this.usar("convertToMain", { id: elemento }, que, ({ datos }) => id<"IdDePista">(datos, "trackId"));
  }

  async cambiarVolumen(elemento: IdDeElemento, volumen: number, que: string): Promise<void> {
    await this.usar("setVolume", { id: elemento, volume: volumen }, que, nada);
  }

  async mover(elemento: IdDeElemento, inicio: number, que: string): Promise<void> {
    await this.usar("move", { id: elemento, toSeconds: inicio }, que, nada);
  }

  async elementos(): Promise<ElementoDeEdits[]> {
    return this.paginas({}, "leer la línea de tiempo", leerElemento);
  }

  async finDeLaPista(pista: IdDePista, que: string): Promise<number> {
    return Math.max(0, ...(await this.paginas({ trackId: pista, fields: ["endTime"] }, que, (e) => numero(e, "endTime"))));
  }

  async agregarTexto(o: { texto: string; inicio: number; duracion: number }, que: string): Promise<Agregado> {
    return this.usar("addText", { text: o.texto, atSeconds: o.inicio, duration: o.duracion }, que, ({ datos }) => ({
      id: id<"IdDeElemento">(datos, "id"),
      inicio: numero(datos, "startTime"),
    }));
  }

  async estiloDeTexto(elemento: IdDeElemento, o: { tamano: number; negrita: boolean; color: string; alineacion: "center" }, que: string): Promise<void> {
    await this.usar("setTextStyle", { id: elemento, size: o.tamano, bold: o.negrita, color: o.color, alignment: o.alineacion }, que, nada);
  }

  /** `x` e `y` van de 0 a 1, de izquierda a derecha y de arriba a abajo. */
  async posicionDeTexto(elemento: IdDeElemento, o: { x: number; y: number }, que: string): Promise<void> {
    await this.usar("setTextPosition", { id: elemento, x: o.x, y: o.y }, que, nada);
  }

  async animacionDeTexto(elemento: IdDeElemento, animacion: string, que: string): Promise<void> {
    await this.usar("setTextAnimation", { id: elemento, animation: animacion }, que, nada);
  }

  /** Pone una imagen encima del video. Edits decide cuánto dura y después se ajusta con `recortarFinal`. */
  async agregarImagen(o: { ruta: string; inicio: number; x: number; y: number; escala: number }, que: string): Promise<IdDeElemento> {
    return this.usar("addOverlay", { path: o.ruta, startSeconds: o.inicio, x: o.x, y: o.y, scale: o.escala }, que, ({ datos }) =>
      id<"IdDeElemento">(datos, "id"),
    );
  }

  async elemento(elemento: IdDeElemento, que: string): Promise<{ inicio: number; duracion: number }> {
    return this.usar("getElement", { id: elemento }, que, ({ datos }) => ({ inicio: numero(datos, "startTime"), duracion: numero(datos, "duration") }));
  }

  /** Con `segundos` positivo le saca ese tiempo al final; con negativo, se lo agrega. */
  async recortarFinal(elemento: IdDeElemento, segundos: number, que: string): Promise<void> {
    await this.usar("trimClip", { id: elemento, side: "end", delta: segundos }, que, nada);
  }

  async generarSubtitulos(idioma: string): Promise<void> {
    await this.usar("generateCaptions", { source: "all", language: idioma, curseWords: false }, "escribir los subtítulos", nada);
  }

  async subtitulos(): Promise<SubtituloDeEdits[]> {
    return this.usar("captions", {}, "leer los subtítulos", ({ datos }) =>
      lista(datos, "captions").map((c) => ({ id: texto(c, "id"), text: texto(c, "text"), startTime: numero(c, "startTime"), endTime: numero(c, "endTime") })),
    );
  }

  async corregirSubtitulo(subtitulo: string, nuevo: string): Promise<void> {
    await this.usar("editCaption", { id: subtitulo, text: nuevo }, "corregir los subtítulos", nada);
  }

  async borrarSubtitulo(subtitulo: string): Promise<void> {
    await this.usar("deleteCaptions", { id: subtitulo }, "corregir los subtítulos", nada);
  }

  async estiloDeSubtitulos(estilo: string): Promise<void> {
    await this.usar("setCaptionStyle", { style: estilo }, "ponerles el estilo a los subtítulos", nada);
  }

  /** El cuadro del reel en ese segundo, tal como lo exporta Edits (JPEG). */
  async cuadro(segundos: number, ancho = 720): Promise<Buffer> {
    return this.usar("captureFrame", { atSeconds: segundos, maxWidth: ancho }, `sacar el cuadro del segundo ${segundos}`, ({ imagenEnBase64 }) => {
      if (!imagenEnBase64) throw new FallaSinPaso("respuesta", "no vino la imagen");
      return Buffer.from(imagenEnBase64, "base64");
    });
  }

  private async paginas<T>(filtro: Datos, que: string, leer: (elemento: Datos) => T): Promise<T[]> {
    const todos: T[] = [];
    let desde: number | undefined = 0;
    while (desde !== undefined) {
      const offset: number = desde;
      desde = await this.usar("elements", { ...filtro, offset, limit: 200 }, que, ({ datos }) => {
        todos.push(...lista(datos, "elements").map(leer));
        const sigue = numeroSiVino(datos, "nextOffset");
        if (sigue !== undefined && sigue <= offset) throw new FallaSinPaso("respuesta", `"nextOffset" (${sigue}) no avanza desde ${offset}`);
        return sigue;
      });
    }
    return todos;
  }

  private async usar<T>(herramienta: Herramienta, argumentos: Datos, que: string, leer: (contestado: Contestado) => T): Promise<T> {
    try {
      return leer(leerResultado(await this.pedir("tools/call", { name: herramienta, arguments: argumentos })));
    } catch (e) {
      throw e instanceof FallaSinPaso ? new ErrorDeEdits(e.falla, que, DETALLES[e.falla](herramienta, e.message)) : e;
    }
  }

  private async pedir(metodo: string, params: Datos, notificacion = false): Promise<unknown> {
    let respuesta: Response;
    let cuerpo: string;
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
        signal: AbortSignal.timeout(this.esperaMaxima * 1000),
      });
      cuerpo = await respuesta.text();
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") throw new FallaSinPaso("conexion", `pasaron ${this.esperaMaxima} segundos`);
      const causa = e instanceof Error && e.cause instanceof Error ? e.cause : e;
      throw new FallaSinPaso("conexion", causa instanceof Error ? causa.message : String(causa));
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorReel("Edits no aceptó la clave. Copiala de nuevo de Edits › Ajustes › Automation.");
    }
    if (!respuesta.ok) throw new FallaSinPaso("rechazo", `HTTP ${respuesta.status}: ${cuerpo.slice(0, 300)}`);
    this.sesion = respuesta.headers.get("mcp-session-id") ?? this.sesion;
    if (notificacion) return undefined;

    // La respuesta puede venir como JSON o como eventos (text/event-stream): se toma el último mensaje con resultado
    const esEventos = (respuesta.headers.get("content-type") ?? "").includes("text/event-stream");
    const mensajes = esEventos
      ? cuerpo
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5))
      : [cuerpo];
    const mensaje = mensajes
      .map(objetoDeJson)
      .reverse()
      .find((m) => m !== undefined && ("result" in m || "error" in m));
    if (!mensaje) throw new FallaSinPaso("respuesta", `no vino el resultado: ${cuerpo.slice(0, 300)}`);
    if (mensaje.error !== undefined) {
      throw new FallaSinPaso("rechazo", esObjeto(mensaje.error) && esTexto(mensaje.error.message) ? mensaje.error.message : JSON.stringify(mensaje.error));
    }
    return mensaje.result;
  }
}

/** Una conexión lista para usar, con la clave de .env. `EDITS_URL` y `EDITS_ESPERA` (segundos) cambian a dónde habla y cuánto espera. */
export async function conectarConEdits() {
  const clave = process.env.EDITS_TOKEN;
  if (!clave) throw new ErrorReel("Falta la clave de Edits. La encontrás en Edits › Ajustes › Automation.");
  const espera = Number(process.env.EDITS_ESPERA);
  const edits = new Edits(clave, process.env.EDITS_URL || EDITS.url, espera > 0 ? espera : EDITS.esperaMaxima);
  await edits.conectar();
  return edits;
}
