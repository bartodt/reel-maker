import path from "node:path";
import { expandirCasa, RAIZ_REPO } from "./entorno.js";
import { ErrorReel } from "./errores.js";
import { leerJson } from "./proyecto.js";

export interface FichaReferencia {
  nombre: string;
  carpeta: string;
  archivoPlan: string;
}

const TABLA_REFERENCIAS = path.join(RAIZ_REPO, "referencias", "referencias.json");

export function leerReferencias(archivo = TABLA_REFERENCIAS): FichaReferencia[] {
  const tabla = leerJson<Record<string, { carpeta?: unknown; plan?: unknown }>>(archivo);
  return Object.entries(tabla).map(([nombre, r]) => {
    if (typeof r?.carpeta !== "string" || typeof r?.plan !== "string") {
      throw new ErrorReel(`En ${archivo}, "${nombre}" tiene que tener "carpeta" y "plan".`);
    }
    return { nombre, carpeta: expandirCasa(r.carpeta), archivoPlan: path.resolve(path.dirname(archivo), r.plan) };
  });
}
