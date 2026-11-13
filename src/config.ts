// Ajustes del reel. Cambiá estos valores a gusto.

export const VIDEO = {
  ancho: 1080,
  alto: 1920,
  fps: 30,
  // Calidad de los pedazos intermedios (más bajo = mejor calidad, más pesado)
  crf: 18,
};

export const VOZ = {
  // Margen que se deja antes y después de cada frase (segundos)
  margen: 0.12,
  // Si una pausa es más corta que esto, no se corta (segundos)
  pausaMinimaParaCortar: 0.45,
  // Fundido al principio y fin de cada pedazo para que no haga "click" (segundos)
  fundido: 0.015,
  // Qué tan seguro tiene que estar Silero de que hay voz (0 a 1)
  umbralVoz: 0.5,
};

export const SUBTITULOS = {
  activados: true,
  palabrasPorBloque: 3,
  fuente: "Arial",
  tamano: 78,
  // Distancia desde abajo. Alto para que no lo tape la interfaz de Instagram.
  margenAbajo: 420,
  mayusculas: true,
};

export const MUSICA = {
  // Volumen base de la música (1 = original)
  volumen: 0.35,
  // Ducking: cuánto y qué tan rápido baja la música cuando hablás
  umbral: 0.03,
  ratio: 8,
  ataqueMs: 50,
  soltarMs: 600,
};

export const ELEVENLABS = {
  modelo: "scribe_v2",
  // Código de idioma para ayudar a la transcripción. Vacío = detección automática.
  idioma: "spa",
};
