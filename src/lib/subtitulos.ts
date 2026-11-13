import { SUBTITULOS, VIDEO } from "../config.js";
import type { Palabra } from "./transcripcion.js";

export function tiempoAss(s: number): string {
  const total = Math.max(0, Math.round(s * 100));
  const cs = total % 100;
  const seg = Math.floor(total / 100) % 60;
  const min = Math.floor(total / 6000) % 60;
  const h = Math.floor(total / 360000);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${h}:${dos(min)}:${dos(seg)}.${dos(cs)}`;
}

function limpiarTexto(t: string): string {
  const sinLlaves = t.replace(/[{}\\]/g, "");
  return SUBTITULOS.mayusculas ? sinLlaves.toLocaleUpperCase("es") : sinLlaves;
}

/** Arma un archivo .ass con bloques cortos de palabras, estilo reel. */
export function armarAss(palabras: Palabra[]): string {
  const solo = palabras.filter((w) => w.type === "word");
  const bloques: Palabra[][] = [];
  for (const w of solo) {
    const ultimo = bloques.at(-1);
    const anterior = ultimo?.at(-1);
    const cortaPorPausa = anterior && w.start - anterior.end > 0.4;
    const cortaPorPunto = anterior && /[.!?…,]$/.test(anterior.text);
    if (!ultimo || ultimo.length >= SUBTITULOS.palabrasPorBloque || cortaPorPausa || cortaPorPunto) {
      bloques.push([w]);
    } else {
      ultimo.push(w);
    }
  }

  const eventos = bloques.map((b, i) => {
    const inicio = b[0].start;
    const finPalabras = b.at(-1)!.end;
    const siguiente = bloques[i + 1]?.[0].start;
    // Queda en pantalla hasta el próximo bloque, salvo que haya una pausa larga
    const fin = siguiente !== undefined && siguiente - finPalabras < 0.6 ? siguiente : finPalabras + 0.15;
    const texto = limpiarTexto(b.map((w) => w.text).join(" "));
    return `Dialogue: 0,${tiempoAss(inicio)},${tiempoAss(fin)},Reel,,0,0,0,,${texto}`;
  });

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${VIDEO.ancho}`,
    `PlayResY: ${VIDEO.alto}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Reel,${SUBTITULOS.fuente},${SUBTITULOS.tamano},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,80,80,${SUBTITULOS.margenAbajo},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...eventos,
    "",
  ].join("\n");
}
