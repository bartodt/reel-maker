export interface Palabra {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event" | string;
}

export interface Frase {
  desde: number;
  hasta: number;
  texto: string;
}

/** Agrupa palabras en frases: corta en punto final o cuando hay una pausa mayor a `pausaMaxima`. */
export function agruparFrases(palabras: Palabra[], pausaMaxima = 0.35): Frase[] {
  const frases: Frase[] = [];
  let actual: Frase | undefined;
  for (const w of palabras.filter((p) => p.type === "word")) {
    if (!actual || w.start - actual.hasta > pausaMaxima) {
      actual = { desde: w.start, hasta: w.end, texto: w.text };
      frases.push(actual);
    } else {
      actual.hasta = w.end;
      actual.texto += " " + w.text;
    }
    if (/[.!?…]$/.test(w.text)) actual = undefined;
  }
  return frases;
}
