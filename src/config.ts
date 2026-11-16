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
  palabrasPorBloque: 1,
  fuente: "Arial",
  tamano: 54,
  // Distancia desde abajo. Alto para que no lo tape la interfaz de Instagram.
  margenAbajo: 460,
  mayusculas: false,
};

// Textos grandes del plan (campo "texto" de cada tramo)
export const TITULOS = {
  fuente: "Arial",
  tamano: 92,
  // Distancia desde arriba. Más abajo que el encabezado de Instagram.
  margenArriba: 330,
  // Si una palabra del texto no se dice en voz alta, aparece este tiempo después de la anterior (segundos)
  pasoSinVoz: 0.15,
};

// Logo del cierre (campo "logo" de cada tramo). Se busca logo.png en la carpeta del reel o en recursos/ del repo.
export const LOGO = {
  // Ancho del logo en el reel (píxeles)
  ancho: 460,
  fundido: 0.3,
};

// Ritmo del plan (campo "ritmo"): cuánto dura un plano típico, en segundos
export const RITMO = {
  rapido: { desde: 0.5, hasta: 1.0 },
  normal: { desde: 0.9, hasta: 1.5 },
  tranquilo: { desde: 1.3, hasta: 2.5 },
};

// Capturas del inventario: más o menos una por segundo de clip, en una grilla
export const CAPTURAS = {
  porSegundo: 1,
  minimo: 4,
  maximo: 24,
  columnas: 6,
  // Alto de cada captura (píxeles)
  alto: 320,
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

// La app para usar la herramienta sin terminal (npm run ui)
export const APP = {
  puerto: 4321,
  // Dónde se guardan los reels (~ es tu carpeta de usuario)
  carpetaReels: "~/reels",
  // Cuántas capturas se sacan a la vez para mostrar en la app
  capturasALaVez: 4,
};

export const EDITS = {
  // Dónde escucha Edits para Mac cuando está activado su servidor de automatización (Ajustes › Automation)
  url: "http://127.0.0.1:19501/mcp",
  // Edits solo puede abrir archivos de la carpeta Películas: el material del reel se copia acá
  carpeta: "~/Movies/reel-maker",
  textos: {
    tamano: 38,
    // Posición del centro del texto: 0 a 1, de izquierda a derecha y de arriba a abajo
    x: 0.5,
    y: 0.25,
    color: "#FFFFFF",
    // Palabra por palabra (no va al ritmo de la voz). En textos más cortos que `minimoPalabraPorPalabra` segundos, `animacionCorta`.
    animacion: "fligStepByStep",
    animacionCorta: "fadeIn",
    minimoPalabraPorPalabra: 1.5,
  },
  subtitulos: {
    idioma: "es",
    // Estilo de Edits. "Short Hard Cut" muestra de a una palabra.
    estilo: "Short Hard Cut",
    // Una palabra que cae entre dos subtítulos va al más cercano si está a menos de estos segundos
    huecoMaximo: 0.5,
  },
  logo: {
    escala: 0.6,
  },
};
