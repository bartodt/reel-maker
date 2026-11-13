// Servidor de la app: sirve la página (src/ui/web/) y responde lo que la página le pide.
// Solo escucha en esta compu (localhost).
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RITMO } from "../config.js";
import { guardarEnEnv } from "../lib/entorno.js";
import { ErrorReel } from "../lib/errores.js";
import type { Ritmo } from "../lib/plan.js";
import { cuadro } from "./cuadros.js";
import {
  abrirReel,
  crearReel,
  deshacer,
  editarPlan,
  guardarDescripcion,
  guardarGuion,
  guardarSubida,
  huella,
  leerReel,
  listarReels,
  type TipoArchivo,
} from "./reels.js";
import { cancelar, pedirAClaude, preparar, renderizar, revisarClaude, trabajoDe } from "./trabajos.js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "web");

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".mpga": "audio/mpeg",
  ".opus": "audio/ogg",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".caf": "audio/x-caf",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function json(res: ServerResponse, codigo: number, datos: unknown) {
  res.writeHead(codigo, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(datos));
}

async function leerCuerpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  let texto = "";
  for await (const pedazo of req) {
    texto += pedazo;
    if (texto.length > 1_000_000) throw new ErrorReel("El pedido es demasiado grande.");
  }
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErrorReel("No entendí el pedido.");
  }
}

/** Manda un archivo, con soporte para pedir un pedazo (los videos lo necesitan para poder adelantar). */
function enviarArchivo(req: IncomingMessage, res: ServerResponse, ruta: string, opciones: { descargar?: string; cache?: boolean } = {}) {
  const { size } = statSync(ruta);
  const encabezados: Record<string, string | number> = {
    "content-type": TIPOS[path.extname(ruta).toLowerCase()] ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": opciones.cache ? "private, max-age=31536000, immutable" : "no-cache",
  };
  if (opciones.descargar) encabezados["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(opciones.descargar)}`;

  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (rango && size > 0) {
    let desde = rango[1] ? Number(rango[1]) : size - Number(rango[2]);
    let hasta = rango[1] && rango[2] ? Number(rango[2]) : size - 1;
    desde = Math.max(0, desde);
    hasta = Math.min(hasta, size - 1);
    if (desde > hasta) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { ...encabezados, "content-range": `bytes ${desde}-${hasta}/${size}`, "content-length": hasta - desde + 1 });
    if (req.method === "HEAD") return res.end();
    return createReadStream(ruta, { start: desde, end: hasta }).pipe(res);
  }
  res.writeHead(200, { ...encabezados, "content-length": size });
  if (req.method === "HEAD") return res.end();
  createReadStream(ruta).pipe(res);
}

/** Una ruta dentro de una carpeta, sin dejar que se salga con "..". */
function adentro(carpeta: string, relativo: string): string {
  const ruta = path.resolve(carpeta, relativo);
  if (ruta !== carpeta && !ruta.startsWith(carpeta + path.sep)) throw new ErrorReel("Ese archivo no es de este reel.");
  return ruta;
}

function revisarFfmpeg(): "ok" | "falta" | "incompleto" {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  if (r.status !== 0) return "falta";
  return / ass /.test(r.stdout) && / drawtext /.test(r.stdout) ? "ok" : "incompleto";
}

export function crearServidor(o: { carpetaReels: string }) {
  const base = o.carpetaReels;
  const ffmpegOk = revisarFfmpeg();

  async function atender(req: IncomingMessage, res: ServerResponse) {
    // Solo se aceptan pedidos de esta compu, y los que cambian algo tienen que venir de la app
    // (así una página web cualquiera no puede tocar tus reels)
    const host = (req.headers.host ?? "").replace(/:\d+$/, "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return json(res, 403, { error: "Solo desde esta compu." });
    const metodo = req.method ?? "GET";
    if (metodo !== "GET" && metodo !== "HEAD" && req.headers["x-reel"] !== "1") return json(res, 403, { error: "Pedido no permitido." });

    const url = new URL(req.url ?? "/", "http://localhost");
    const partes = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    if (partes[0] !== "api") {
      const archivo = partes.length ? adentro(WEB, partes.join("/")) : path.join(WEB, "index.html");
      if (!existsSync(archivo) || !statSync(archivo).isFile()) return enviarArchivo(req, res, path.join(WEB, "index.html"));
      return enviarArchivo(req, res, archivo);
    }

    const ruta = `${metodo} /${partes.slice(1, 2).join("/")}${partes.length > 3 ? "/:n/" + partes[3] : partes.length > 2 ? "/:n" : ""}`;

    if (ruta === "GET /inicio") {
      return json(res, 200, {
        carpetaReels: base,
        reels: listarReels(base),
        ffmpeg: ffmpegOk,
        claude: await revisarClaude(),
        claveElevenLabs: Boolean(process.env.ELEVENLABS_API_KEY),
      });
    }
    if (ruta === "POST /reels") {
      const { titulo } = await leerCuerpo(req);
      if (typeof titulo !== "string" || !titulo.trim()) throw new ErrorReel("Ponele un nombre al reel.");
      return json(res, 200, { nombre: crearReel(base, titulo) });
    }
    if (ruta === "POST /clave") {
      const { clave } = await leerCuerpo(req);
      if (typeof clave !== "string" || !/^[\w-]{10,200}$/.test(clave.trim())) throw new ErrorReel("Esa clave no parece correcta. Copiala de nuevo.");
      guardarEnEnv("ELEVENLABS_API_KEY", clave.trim());
      return json(res, 200, { ok: true });
    }

    if (partes[1] !== "reels" || !partes[2]) return json(res, 404, { error: "No existe." });
    const nombre = partes[2];
    const p = abrirReel(base, nombre);
    const conTrabajo = async () => json(res, 200, { ...(await leerReel(base, nombre)), trabajo: trabajoDe(p) });

    switch (ruta) {
      case "GET /reels/:n":
        return conTrabajo();
      case "GET /reels/:n/huella":
        return json(res, 200, { huella: huella(base, nombre), trabajo: trabajoDe(p) });
      case "GET /reels/:n/archivo":
      case "HEAD /reels/:n/archivo": {
        const archivo = adentro(p.raiz, partes.slice(4).join("/"));
        if (!existsSync(archivo) || !statSync(archivo).isFile()) return json(res, 404, { error: "No encontré ese archivo." });
        const descargar = url.searchParams.has("descargar") ? `${nombre}${path.extname(archivo)}` : undefined;
        return enviarArchivo(req, res, archivo, { descargar, cache: url.searchParams.has("v") });
      }
      case "GET /reels/:n/cuadro": {
        const archivo = adentro(p.raiz, url.searchParams.get("archivo") ?? "");
        if (!existsSync(archivo)) return json(res, 404, { error: "No encontré ese video." });
        const encuadre = url.searchParams.get("encuadre");
        const imagen = await cuadro(p, archivo, {
          archivo,
          segundo: Number(url.searchParams.get("t") ?? 0) || 0,
          vertical: url.searchParams.get("vertical") === "1",
          encuadre: encuadre === null || encuadre === "" ? undefined : isNaN(Number(encuadre)) ? (encuadre as never) : Number(encuadre),
          alto: Math.min(1280, Math.max(120, Number(url.searchParams.get("alto")) || 360)),
        });
        return enviarArchivo(req, res, imagen, { cache: true });
      }
      case "PUT /reels/:n/subir": {
        const tipo = url.searchParams.get("tipo") as TipoArchivo;
        const archivo = await guardarSubida(p, tipo, url.searchParams.get("nombre") ?? "archivo", req);
        return json(res, 200, { archivo });
      }
      case "PUT /reels/:n/guion": {
        const { texto } = await leerCuerpo(req);
        if (typeof texto !== "string") throw new ErrorReel("Falta el guion.");
        guardarGuion(p, texto);
        return json(res, 200, { ok: true });
      }
      case "PUT /reels/:n/descripcion": {
        const { clip, descripcion } = await leerCuerpo(req);
        if (typeof clip !== "string" || typeof descripcion !== "string") throw new ErrorReel("Falta la descripción.");
        guardarDescripcion(p, clip, descripcion);
        return json(res, 200, { ok: true });
      }
      case "POST /reels/:n/plan":
        editarPlan(p, await leerCuerpo(req));
        return conTrabajo();
      case "POST /reels/:n/deshacer":
        deshacer(p);
        return conTrabajo();
      case "POST /reels/:n/preparar": {
        const { todo } = await leerCuerpo(req);
        const reel = await leerReel(base, nombre);
        if (!reel.pasos.material) throw new ErrorReel("Primero subí tus videos y tu voz.");
        preparar(p, reel.pasos, todo === true);
        return conTrabajo();
      }
      case "POST /reels/:n/claude": {
        const { modo, pedido, ritmo } = await leerCuerpo(req);
        if (modo !== "armar" && modo !== "cambiar") throw new ErrorReel("No entendí qué pedirle a Claude.");
        if (ritmo !== undefined && !(typeof ritmo === "string" && ritmo in RITMO)) throw new ErrorReel("Ese ritmo no existe.");
        await pedirAClaude(p, { modo, pedido: typeof pedido === "string" ? pedido : undefined, ritmo: ritmo as Ritmo | undefined });
        return conTrabajo();
      }
      case "POST /reels/:n/render":
        renderizar(p);
        return conTrabajo();
      case "POST /reels/:n/cancelar":
        cancelar(p);
        return conTrabajo();
      case "POST /reels/:n/mostrar": {
        const { archivo } = await leerCuerpo(req);
        const ruta = typeof archivo === "string" && archivo ? adentro(p.raiz, archivo) : p.raiz;
        if (process.platform === "darwin") spawn("open", existsSync(ruta) && statSync(ruta).isFile() ? ["-R", ruta] : [ruta], { stdio: "ignore" });
        return json(res, 200, { ruta });
      }
    }
    return json(res, 404, { error: "No existe." });
  }

  return http.createServer((req, res) => {
    atender(req, res).catch((e: unknown) => {
      if (res.headersSent) return res.destroy();
      if (e instanceof ErrorReel) return json(res, 400, { error: e.message });
      console.error(e);
      json(res, 500, { error: "Algo salió mal.", detalle: e instanceof Error ? e.message : String(e) });
    });
  });
}
