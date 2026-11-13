import { SUBTITULOS, TITULOS, VIDEO } from "../config.js";
import type { TextoEnPantalla } from "./linea.js";
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

const sinLlaves = (t: string) => t.replace(/[{}\\]/g, "");

/**
 * Arma un archivo .ass con los subtítulos (bloques cortos de palabras, abajo)
 * y los textos grandes del plan (arriba, palabra por palabra).
 * Los tiempos tienen que estar ya en segundos del reel terminado.
 */
export function armarAss(palabras: Palabra[], textos: TextoEnPantalla[] = [], o = SUBTITULOS): string {
  const solo = palabras.filter((w) => w.type === "word");
  const bloques: Palabra[][] = [];
  for (const w of solo) {
    const ultimo = bloques.at(-1);
    const anterior = ultimo?.at(-1);
    const cortaPorPausa = anterior && w.start - anterior.end > 0.4;
    const cortaPorPunto = anterior && /[.!?…,]$/.test(anterior.text);
    if (!ultimo || ultimo.length >= o.palabrasPorBloque || cortaPorPausa || cortaPorPunto) {
      bloques.push([w]);
    } else {
      ultimo.push(w);
    }
  }

  const subtitulos = bloques.map((b, i) => {
    const inicio = b[0].start;
    const finPalabras = b.at(-1)!.end;
    const siguiente = bloques[i + 1]?.[0].start;
    // Queda en pantalla hasta el próximo bloque, salvo que haya una pausa larga
    const fin = siguiente !== undefined && siguiente - finPalabras < 0.6 ? siguiente : finPalabras + 0.15;
    const texto = sinLlaves(b.map((w) => w.text).join(" "));
    return `Dialogue: 0,${tiempoAss(inicio)},${tiempoAss(fin)},Reel,,0,0,0,,${o.mayusculas ? texto.toLocaleUpperCase("es") : texto}`;
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
    `Style: Reel,${o.fuente},${o.tamano},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,80,80,${o.margenAbajo},1`,
    `Style: Titulo,${TITULOS.fuente},${TITULOS.tamano},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,3,8,80,80,${TITULOS.margenArriba},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...subtitulos,
    ...textos.flatMap(eventosDeTexto),
    "",
  ].join("\n");
}

/**
 * Un evento por palabra: cada uno muestra el texto entero, con las palabras que todavía no aparecieron
 * transparentes. Así el texto no se mueve mientras se va completando.
 */
function eventosDeTexto(t: TextoEnPantalla): string[] {
  const lineas = t.texto
    .split(/\r?\n/)
    .map((l) => l.split(/\s+/).filter(Boolean))
    .filter((l) => l.length);
  const total = lineas.flat().length;
  const momento = (i: number) => t.momentos[i] ?? t.momentos.at(-1) ?? t.inicio;

  const eventos: string[] = [];
  for (let i = 0; i < total; i++) {
    const inicio = momento(i);
    const fin = i + 1 < total ? momento(i + 1) : t.fin;
    if (fin - inicio < 0.01) continue;
    let contadas = 0;
    const texto = lineas
      .map((linea) =>
        linea
          .map((palabra) => {
            const oculta = contadas++ === i + 1 ? "{\\alpha&HFF&}" : "";
            return oculta + sinLlaves(palabra);
          })
          .join(" "),
      )
      .join("\\N");
    const salida = i + 1 === total ? "{\\fad(0,150)}" : "";
    eventos.push(`Dialogue: 1,${tiempoAss(inicio)},${tiempoAss(fin)},Titulo,,0,0,0,,${salida}${texto}`);
  }
  return eventos;
}
