import path from "node:path";
import { expandirCasa, RAIZ_REPO } from "./entorno.js";
import { ErrorReel } from "./errores.js";
import { leerJsonRevisado } from "./proyecto.js";

export interface FichaReferencia {
  nombre: string;
  carpeta: string;
  archivoPlan: string;
  logo?: string;
  guion?: string;
}

const TABLA_REFERENCIAS = path.join(RAIZ_REPO, "referencias", "referencias.json");

export function leerReferencias(archivo = TABLA_REFERENCIAS): FichaReferencia[] {
  const tabla = leerJsonRevisado(archivo, "la tabla de referencias") as Record<string, Record<string, unknown>>;
  const ruta = (r: string) => (r.startsWith("~") ? expandirCasa(r) : path.resolve(path.dirname(archivo), r));
  return Object.entries(tabla).map(([nombre, r]) => {
    if (typeof r?.carpeta !== "string" || typeof r?.plan !== "string") {
      throw new ErrorReel(`En ${archivo}, "${nombre}" tiene que tener "carpeta" y "plan".`);
    }
    const ficha: FichaReferencia = { nombre, carpeta: expandirCasa(r.carpeta), archivoPlan: ruta(r.plan) };
    for (const campo of ["logo", "guion"] as const) {
      const valor = r[campo];
      if (valor === undefined) continue;
      if (typeof valor !== "string") throw new ErrorReel(`En ${archivo}, el "${campo}" de "${nombre}" tiene que ser una ruta.`);
      ficha[campo] = ruta(valor);
    }
    return ficha;
  });
}
