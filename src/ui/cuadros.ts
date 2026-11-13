// Cuadros sueltos de un video, para mostrar en la app (miniaturas, vista previa de cada plano).
// Se guardan en edit/miniaturas/ para no sacarlos dos veces.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { APP } from "../config.js";
import { filtroEncuadre, type Encuadre } from "../lib/encuadre.js";
import { ffmpeg, info } from "../lib/ffmpeg.js";
import type { Proyecto } from "../lib/proyecto.js";

export interface PedidoCuadro {
  /** Archivo dentro de la carpeta del reel, por ejemplo clips/playa.mov */
  archivo: string;
  segundo: number;
  /** Recortado como en el reel (vertical) o entero */
  vertical: boolean;
  encuadre?: Encuadre;
  alto: number;
}

const enCurso = new Map<string, Promise<string>>();
let corriendo = 0;
const esperando: (() => void)[] = [];

async function turno<T>(fn: () => Promise<T>): Promise<T> {
  if (corriendo >= APP.capturasALaVez) await new Promise<void>((r) => esperando.push(r));
  corriendo++;
  try {
    return await fn();
  } finally {
    corriendo--;
    esperando.shift()?.();
  }
}

/** Devuelve la ruta de un .jpg con el cuadro pedido. */
export function cuadro(p: Proyecto, ruta: string, pedido: PedidoCuadro): Promise<string> {
  const s = statSync(ruta);
  const clave = createHash("sha1")
    .update(JSON.stringify([ruta, s.mtimeMs, s.size, pedido.segundo.toFixed(2), pedido.vertical, pedido.encuadre ?? null, pedido.alto]))
    .digest("hex")
    .slice(0, 20);
  const carpeta = path.join(p.edit, "miniaturas");
  const salida = path.join(carpeta, `${clave}.jpg`);
  if (existsSync(salida)) return Promise.resolve(salida);
  const ya = enCurso.get(clave);
  if (ya) return ya;

  const trabajo = turno(async () => {
    mkdirSync(carpeta, { recursive: true });
    const { duracion } = await info(ruta);
    const segundo = Math.max(0, Math.min(pedido.segundo, duracion - 0.1));
    const alto = pedido.alto - (pedido.alto % 2);
    const ancho = Math.round((alto * 9) / 16 / 2) * 2;
    const filtro = pedido.vertical ? filtroEncuadre(pedido.encuadre, ancho, alto) : `scale=-2:${alto}`;
    const temporal = path.join(carpeta, `.${clave}.jpg`);
    await ffmpeg(["-ss", segundo.toFixed(3), "-i", ruta, "-frames:v", "1", "-vf", filtro, "-q:v", "5", temporal]);
    renameSync(temporal, salida);
    return salida;
  }).finally(() => enCurso.delete(clave));
  enCurso.set(clave, trabajo);
  return trabajo;
}
