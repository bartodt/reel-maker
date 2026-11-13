import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARCHIVO_ENV = path.join(RAIZ_REPO, ".env");

/** Carga las claves de .env (si existe). */
export function cargarEnv() {
  if (existsSync(ARCHIVO_ENV)) process.loadEnvFile(ARCHIVO_ENV);
}

/** Guarda (o reemplaza) una variable en .env y la deja lista para usar. */
export function guardarEnEnv(nombre: string, valor: string) {
  const lineas = existsSync(ARCHIVO_ENV) ? readFileSync(ARCHIVO_ENV, "utf8").split("\n") : [];
  const nueva = `${nombre}=${valor}`;
  const i = lineas.findIndex((l) => l.startsWith(`${nombre}=`));
  if (i >= 0) {
    lineas[i] = nueva;
  } else {
    if (lineas.at(-1) === "") lineas.pop();
    lineas.push(nueva, "");
  }
  writeFileSync(ARCHIVO_ENV, lineas.join("\n"));
  process.env[nombre] = valor;
}

/** Cambia ~ por la carpeta del usuario. */
export function expandirCasa(ruta: string): string {
  return path.resolve(ruta.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));
}
