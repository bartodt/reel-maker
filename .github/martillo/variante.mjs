// usage: node variante.mjs <name> <line-file>
// Rewrites the escaped ffmpeg line of the music render into one variant, failing if a change does not apply.
import { readFileSync, writeFileSync } from "node:fs";

const cambios = {
  musica: [],
  "sin-loop": [["-stream_loop -1 ", ""]],
  "sin-compresor": [
    ["asplit=2\\[voz\\]\\[llave\\]", "anull\\[voz\\]"],
    [/\\\[mus\\\]\\\[llave\\\]sidechaincompress=[^\\]*\\,/, "\\[mus\\]"],
  ],
  "dos-grafos": [["\\[video\\]\\;", "\\[video\\] -filter_complex "]],
  "dec-1-hilo": [[" -i ", " -threads 1 -i "]],
  "fc-1-hilo": [["-filter_complex ", "-filter_complex_threads 1 -filter_complex "]],
};

const [nombre, archivo] = process.argv.slice(2);
if (!(nombre in cambios)) throw new Error(`unknown variant ${nombre}`);
let linea = readFileSync(archivo, "utf8").trim();
for (const [buscar, poner] of cambios[nombre]) {
  const antes = linea;
  linea = linea.replace(buscar, poner);
  if (linea === antes) throw new Error(`${nombre}: ${buscar} did not apply`);
}
writeFileSync(archivo, linea + "\n");
