import path from "node:path";

/** Nombre de carpeta a partir del título que escribe el usuario: "Café de la esquina" → "cafe-de-la-esquina". */
export function nombreDeCarpeta(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Título para mostrar a partir del nombre de la carpeta: "cafe-de-la-esquina" → "Cafe de la esquina". */
export function tituloDeCarpeta(nombre: string): string {
  const texto = nombre.replace(/[-_]+/g, " ").trim();
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}

/** Deja solo el nombre del archivo, sin carpetas ni caracteres raros. */
export function nombreDeArchivoSeguro(nombre: string): string {
  const limpio = path
    .basename(nombre.replace(/\\/g, "/"))
    .replace(/[\u0000-\u001f/:]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return limpio || "archivo";
}

/** Si ya hay un archivo con ese nombre, agrega " (2)", " (3)"... antes de la extensión. */
export function nombreLibre(nombre: string, existe: (n: string) => boolean): string {
  if (!existe(nombre)) return nombre;
  const ext = path.extname(nombre);
  const base = nombre.slice(0, nombre.length - ext.length);
  for (let i = 2; ; i++) {
    const candidato = `${base} (${i})${ext}`;
    if (!existe(candidato)) return candidato;
  }
}
