/**
 * Hacia dónde se recorta un clip que no tiene el formato del reel.
 * - Clip horizontal: "izquierda" | "centro" | "derecha" (o un número de 0 a 1, de izquierda a derecha)
 * - Clip más vertical que el reel: "arriba" | "centro" | "abajo" (o un número de 0 a 1, de arriba a abajo)
 */
export type Encuadre = "izquierda" | "centro" | "derecha" | "arriba" | "abajo" | number;

const POSICIONES: Record<string, number> = {
  izquierda: 0,
  arriba: 0,
  centro: 0.5,
  derecha: 1,
  abajo: 1,
};

export function encuadreValido(e: unknown): e is Encuadre {
  if (typeof e === "number") return e >= 0 && e <= 1;
  return typeof e === "string" && e in POSICIONES;
}

export function posicion(e: Encuadre | undefined): number {
  if (e === undefined) return 0.5;
  return typeof e === "number" ? e : POSICIONES[e];
}

/** Filtro de ffmpeg que escala para llenar el cuadro y recorta según el encuadre. */
export function filtroEncuadre(e: Encuadre | undefined, ancho: number, alto: number): string {
  const k = posicion(e).toFixed(3);
  return (
    `scale=${ancho}:${alto}:force_original_aspect_ratio=increase,` +
    `crop=${ancho}:${alto}:(iw-ow)*${k}:(ih-oh)*${k}`
  );
}
