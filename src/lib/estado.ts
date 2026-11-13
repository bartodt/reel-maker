// En qué paso está un reel, mirando qué archivos hay y de cuándo son.

export interface Archivos {
  clips: string[];
  voz?: { nombre: string; modificado: number };
  vozLimpia?: { modificado: number; /** De qué archivo de voz salió (voz-cortes.json) */ original?: string };
  transcripcion?: number;
  inventario?: { modificado: number; clips: string[] };
  plan?: number;
  final?: number;
  /** Si se sabe con qué plan se creó el reel terminado: si el plan de ahora es igual a ese */
  planIgualAlDelFinal?: boolean;
}

export interface Pasos {
  /** Hay videos y voz */
  material: boolean;
  limpio: boolean;
  transcripto: boolean;
  /** Todos los videos están en el inventario */
  inventario: boolean;
  plan: boolean;
  final: boolean;
  /** El plan cambió después de crear el reel terminado */
  finalViejo: boolean;
}

// Margen para comparar fechas de archivos (milisegundos): copiar un archivo puede correrla un poco
const MARGEN = 1000;

export function pasosHechos(a: Archivos): Pasos {
  const material = a.clips.length > 0 && a.voz !== undefined;
  const limpio =
    a.voz !== undefined &&
    a.vozLimpia !== undefined &&
    a.vozLimpia.modificado + MARGEN >= a.voz.modificado &&
    (a.vozLimpia.original === undefined || a.vozLimpia.original === a.voz.nombre);
  const transcripto = limpio && a.transcripcion !== undefined && a.transcripcion + MARGEN >= a.vozLimpia!.modificado;
  const enInventario = new Set(a.inventario?.clips ?? []);
  const inventario = a.inventario !== undefined && a.clips.every((c) => enInventario.has(c));
  const plan = a.plan !== undefined;
  const final = a.final !== undefined;
  const finalViejo = final && plan && (a.planIgualAlDelFinal !== undefined ? !a.planIgualAlDelFinal : a.plan! > a.final! + MARGEN);
  return { material, limpio, transcripto, inventario, plan, final, finalViejo };
}

export type Etapa = "material" | "preparar" | "cortes" | "reel" | "listo";

/** El primer paso que le falta al reel, para saber dónde abrirlo. */
export function etapaActual(p: Pasos, planOk: boolean): Etapa {
  if (!p.material) return "material";
  if (!p.limpio || !p.transcripto || !p.inventario) return "preparar";
  if (!p.plan || !planOk) return "cortes";
  if (!p.final || p.finalViejo) return "reel";
  return "listo";
}
