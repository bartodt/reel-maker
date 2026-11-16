// Paso 2: limpiar la voz, transcribirla y mirar los videos. Después se muestra lo que salió.
import { api, avisar, boton, h, icono, imagen, mostrarError, seg, sinApuro, verImagen } from "./dom.js";
import { errorDeTrabajo, panelVivo, progreso } from "./trabajo.js";

export function encabezado(titulo, texto, extra) {
  return h("div", { class: "encabezado-paso" }, h("div", null, h("h1", null, titulo), texto ? h("p", { class: "suave grande" }, texto) : null), extra ?? null);
}

export function bloqueado(ctx, texto, paso, botonTexto) {
  return h(
    "div",
    { class: "vacio" },
    h("div", { class: "vacio__dibujo" }, icono("reloj")),
    h("h2", null, "Todavía no"),
    h("p", { class: "suave" }, texto),
    boton(botonTexto, { icono: "atras", clase: "boton--secundario", onclick: () => ctx.ir(paso) }),
  );
}

const ITEMS = [
  { id: "limpio", ic: "microfono", titulo: "Sacar los silencios de tu voz", detalle: "Cortamos las pausas largas para que el reel tenga ritmo." },
  { id: "transcripto", ic: "texto", titulo: "Escribir lo que decís", detalle: "Así los subtítulos y los cortes caen justo en cada palabra." },
  { id: "inventario", ic: "ojo", titulo: "Mirar tus videos", detalle: "Sacamos fotos de cada video para elegir los mejores momentos." },
];

export function vistaPreparar(ctx) {
  const { reel, trabajo, inicio } = ctx;
  const p = reel.pasos;
  if (!p.material) return bloqueado(ctx, "Primero subí tus videos y tu voz en off.", "material", "Ir a Material");

  const enMarcha = trabajo?.tipo === "preparar" && trabajo.estado === "corriendo";
  const fallo = trabajo?.tipo === "preparar" && trabajo.estado === "error" ? trabajo : null;
  const listo = p.limpio && p.transcripto && p.inventario;
  const algoHecho = p.limpio || p.transcripto || p.inventario;
  const faltaClave = !inicio.claveElevenLabs && !p.transcripto;
  const empezar = (todo) => ctx.pedir("/preparar", { metodo: "POST", cuerpo: { todo } }).catch(mostrarError);

  return [
    encabezado("Preparar el material", "Antes de armar los cortes, la app escucha tu voz y mira tus videos. Tarda un par de minutos."),
    faltaClave && !enMarcha ? tarjetaClave(ctx) : null,
    enMarcha
      ? panelVivo("", (t) => progreso(t, { nota: "Podés seguir usando la compu mientras tanto." }), trabajo)
      : h(
          "section",
          { class: "tarjeta" },
          h(
            "ul",
            { class: "lista-pasos" },
            ITEMS.map((it) =>
              h(
                "li",
                { class: ["lista-pasos__item", p[it.id] && "lista-pasos__item--hecho"] },
                h("span", { class: "lista-pasos__icono" }, icono(p[it.id] ? "check" : it.ic)),
                h("div", null, h("strong", null, it.titulo), h("p", { class: "suave chico" }, it.detalle)),
              ),
            ),
          ),
          fallo ? errorDeTrabajo(fallo, { reintentar: () => empezar(false) }) : null,
          listo
            ? h(
                "div",
                { class: "fila fila--separada" },
                h("span", { class: "chip chip--verde" }, icono("check"), "Todo preparado"),
                boton("Preparar todo de nuevo", { clase: "boton--fantasma boton--chico", onclick: () => empezar(true) }),
              )
            : boton(algoHecho ? "Preparar lo que falta" : "Preparar", { icono: "rayo", clase: "boton--primario boton--grande", disabled: faltaClave, onclick: () => empezar(false) }),
        ),
    listo ? resultadoVoz(ctx) : null,
    listo ? resultadoVideos(ctx) : null,
    listo
      ? h("div", { class: "pie-paso" }, boton("Siguiente: armar los cortes", { icono: "adelante", clase: "boton--primario boton--grande boton--icono-derecha", onclick: () => ctx.ir("cortes") }))
      : null,
  ];
}

const CLAVES = {
  elevenlabs: {
    titulo: "Falta la clave de ElevenLabs",
    texto: "Es el servicio que escribe lo que decís. La sacás en elevenlabs.io → Settings → API Keys. Se guarda en esta compu y no hace falta volver a cargarla.",
  },
  edits: {
    titulo: "Falta la clave de Edits",
    texto: "Abrí Edits en la Mac, andá a Ajustes → Automation, prendé el servidor de automatización y copiá la clave (Access token). Se guarda en esta compu y no hace falta volver a cargarla.",
  },
};

export function tarjetaClave(ctx, de = "elevenlabs") {
  const campo = h("input", { class: "campo", type: "password", placeholder: "Pegá tu clave acá", autocomplete: "off" });
  const guardar = async () => {
    campo.blur();
    try {
      await api("/clave", { metodo: "POST", cuerpo: { clave: campo.value, de } });
      avisar("Clave guardada");
      await ctx.actualizarInicio();
    } catch (e) {
      mostrarError(e);
    }
  };
  campo.addEventListener("keydown", (e) => e.key === "Enter" && guardar());
  return h(
    "section",
    { class: "alerta alerta--amarilla" },
    icono("llave"),
    h(
      "div",
      { class: "crece" },
      h("strong", null, CLAVES[de].titulo),
      h("p", null, CLAVES[de].texto),
      h("div", { class: "fila" }, campo, boton("Guardar", { clase: "boton--primario", onclick: guardar })),
    ),
  );
}

function resultadoVoz(ctx) {
  const { vozLimpia, frases } = ctx.reel;
  if (!vozLimpia) return null;
  const audio = h("audio", { controls: true, preload: "metadata", src: vozLimpia.url });
  const sacado = vozLimpia.duracionOriginal ? vozLimpia.duracionOriginal - vozLimpia.duracion : 0;
  return h(
    "section",
    { class: "tarjeta" },
    h("div", { class: "tarjeta__cabeza" }, h("h2", null, icono("microfono"), "Tu voz, sin silencios")),
    h(
      "p",
      { class: "suave" },
      vozLimpia.duracionOriginal
        ? `Duraba ${seg(vozLimpia.duracionOriginal)} y quedó en ${seg(vozLimpia.duracion)}${sacado > 0.3 ? `: sacamos ${seg(sacado)} de pausas` : ""}.`
        : `Dura ${seg(vozLimpia.duracion)}.`,
    ),
    audio,
    frases.length
      ? h(
          "div",
          { class: "frases" },
          h("p", { class: "suave chico" }, "Esto es lo que entendimos. Tocá una frase para escucharla."),
          frases.map((f) =>
            h(
              "button",
              {
                type: "button",
                class: "frase",
                onclick: () => {
                  audio.currentTime = f.desde;
                  audio.play();
                },
              },
              h("span", { class: "frase__tiempo" }, seg(f.desde)),
              h("span", null, f.texto),
            ),
          ),
        )
      : null,
  );
}

function resultadoVideos(ctx) {
  const { inventario, nombre } = ctx.reel;
  return h(
    "section",
    { class: "tarjeta" },
    h("div", { class: "tarjeta__cabeza" }, h("h2", null, icono("video"), "Lo que hay en cada video")),
    h("p", { class: "suave chico" }, "Si querés, contá qué pasa en cada video: Claude lo tiene en cuenta para elegir. Si Claude ya lo describió, podés corregirlo."),
    h(
      "div",
      { class: "grilla-inventario" },
      inventario.map((c) => {
        const guardar = sinApuro(async (descripcion) => {
          try {
            await api(`/reels/${encodeURIComponent(nombre)}/descripcion`, { metodo: "PUT", cuerpo: { clip: c.archivo, descripcion } });
            c.descripcion = descripcion;
          } catch (e) {
            mostrarError(e);
          }
        }, 900);
        const campo = h("textarea", {
          class: "campo campo--chico",
          rows: 3,
          placeholder: "¿Qué se ve? Ej: sirven el café, la gente charla en la mesa…",
          value: c.descripcion,
          oninput: () => guardar(campo.value),
          onblur: () => campo.value !== c.descripcion && guardar.ya(campo.value),
        });
        return h(
          "article",
          { class: "inventario" },
          h("button", { type: "button", class: "inventario__captura", onclick: () => verImagen(c.captura, c.archivo), title: "Ver más grande" }, imagen(c.captura)),
          h(
            "div",
            { class: "inventario__cuerpo" },
            h("div", { class: "fila fila--separada" }, h("strong", { class: "corta" }, c.archivo), h("span", { class: "suave chico" }, seg(c.duracion))),
            h(
              "div",
              { class: "fila-chica" },
              h("span", { class: "chip chip--gris" }, c.orientacion),
              c.conVoz.length ? h("span", { class: "chip chip--violeta" }, icono("altavoz"), "Alguien habla") : null,
            ),
            campo,
          ),
        );
      }),
    ),
  );
}
