// Paso 1: subir los videos, la voz en off y, si quiere, música, logo y guion.
import { encabezado } from "./preparar.js";
import { api, boton, confirmar, h, icono, imagen, mostrarError, plural, seg, sinApuro, subirArchivo, zonaDeArchivos } from "./dom.js";

const ACEPTA = {
  clip: "video/*,.mov,.mp4,.m4v,.mkv,.webm",
  voz: "audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg,.mpeg,.mpga,.opus,.aiff,.aif,.caf",
  musica: "audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg,.mpeg,.mpga,.opus,.aiff,.aif,.caf",
  logo: "image/png,image/jpeg,image/webp",
};

// Subidas en curso: sobreviven a que se redibuje la pantalla
const subidas = [];
let subiendo = false;
let siguienteId = 1;

function encolar(ctx, tipo, archivos) {
  for (const archivo of archivos) subidas.push({ id: siguienteId++, reel: ctx.reel.nombre, tipo, archivo, progreso: 0 });
  ctx.recargar();
  if (!subiendo) procesar(ctx);
}

async function procesar(ctx) {
  subiendo = true;
  while (subidas.length) {
    const s = subidas[0];
    try {
      await subirArchivo(s.reel, s.tipo, s.archivo, (avance) => {
        s.progreso = avance;
        const barra = document.querySelector(`[data-subida="${s.id}"] .barra-progreso > div`);
        if (barra) barra.style.width = `${Math.round(avance * 100)}%`;
      });
    } catch (e) {
      mostrarError(new Error(`${s.archivo.name}: ${e.message}`));
    }
    subidas.shift();
    await ctx.recargar();
  }
  subiendo = false;
}

function enCurso(reel, tipo) {
  return subidas.filter((s) => s.reel === reel && s.tipo === tipo);
}

function tarjetaSubiendo(s) {
  return h(
    "figure",
    { class: "clip clip--subiendo", "data-subida": s.id },
    h("div", { class: "clip__imagen" }, h("span", { class: "girando" })),
    h("figcaption", null, s.archivo.name),
    h("div", { class: "barra-progreso" }, h("div", { style: { width: `${Math.round(s.progreso * 100)}%` } })),
  );
}

export function vistaMaterial(ctx) {
  const { reel } = ctx;
  const m = reel.material;
  const faltan = [!m.clips.length && "tus videos", !m.voz && "tu voz en off"].filter(Boolean);

  return [
    encabezado("Tu material", "Subí los videos que grabaste y tu voz en off. Lo demás es opcional."),
    seccionVideos(ctx),
    h("div", { class: "dos-columnas" }, seccionVoz(ctx), h("div", { class: "pila" }, seccionMusica(ctx), seccionLogo(ctx))),
    seccionGuion(ctx),
    h(
      "div",
      { class: "pie-paso" },
      faltan.length
        ? h("p", { class: "suave" }, `Para seguir te falta subir ${faltan.join(" y ")}.`)
        : boton("Siguiente: preparar", { icono: "adelante", clase: "boton--primario boton--grande boton--icono-derecha", onclick: () => ctx.ir("preparar") }),
    ),
  ];
}

function cabeza(ic, titulo, extra) {
  return h("div", { class: "tarjeta__cabeza" }, h("h2", null, icono(ic), titulo), extra ?? null);
}

function seccionVideos(ctx) {
  const { clips } = ctx.reel.material;
  const subiendoAhora = enCurso(ctx.reel.nombre, "clip");
  return h(
    "section",
    { class: "tarjeta" },
    cabeza("video", "Tus videos", clips.length ? h("span", { class: "chip" }, plural(clips.length, "video", "videos")) : null),
    zonaDeArchivos({
      titulo: clips.length ? "Sumar más videos" : "Arrastrá tus videos acá",
      detalle: "o tocá para elegirlos · .mov o .mp4, de cualquier tamaño",
      acepta: ACEPTA.clip,
      varios: true,
      compacta: clips.length > 0,
      icono: "video",
      alElegir: (archivos) => encolar(ctx, "clip", archivos),
    }),
    clips.length || subiendoAhora.length
      ? h(
          "div",
          { class: "grilla-clips" },
          subiendoAhora.map(tarjetaSubiendo),
          clips.map((c) =>
            h(
              "figure",
              { class: "clip", title: c.archivo },
              h(
                "div",
                { class: "clip__imagen" },
                imagen(c.miniatura),
                h("span", { class: "clip__duracion" }, seg(c.duracion)),
                boton(null, { icono: "basura", clase: "clip__quitar", title: "Sacar este video", "aria-label": `Sacar ${c.archivo}`, onclick: () => quitarVideo(ctx, c.archivo) }),
              ),
              h("figcaption", null, c.archivo),
            ),
          ),
        )
      : null,
    clips.length
      ? h("p", { class: "suave chico" }, "Tip: si el nombre del video dice lo que muestra (por ejemplo “cafe-servido.mov”), Claude elige mejor.")
      : null,
  );
}

async function quitarVideo(ctx, archivo) {
  if (!(await confirmar(`¿Sacar “${archivo}”?`, "Deja de estar en este reel. No se borra: queda guardado en la carpeta del reel, en edit/quitados.", { si: "Sacarlo", peligro: true }))) return;
  try {
    await api(`/reels/${encodeURIComponent(ctx.reel.nombre)}/quitar-clip`, { metodo: "POST", cuerpo: { archivo } });
    await ctx.recargar();
  } catch (e) {
    mostrarError(e);
  }
}

/** Para la voz, la música y el logo: un solo archivo, que se puede cambiar. */
function archivoUnico(ctx, tipo, { actual, titulo, detalle, ic, alCambiar, vistaPrevia }) {
  const subiendoAhora = enCurso(ctx.reel.nombre, tipo)[0];
  if (subiendoAhora) return tarjetaSubiendo(subiendoAhora);
  if (!actual) return zonaDeArchivos({ titulo, detalle, acepta: ACEPTA[tipo], icono: ic, alElegir: (a) => encolar(ctx, tipo, a) });
  const entrada = h("input", {
    type: "file",
    accept: ACEPTA[tipo],
    hidden: true,
    onchange: async () => {
      const archivo = entrada.files?.[0];
      entrada.value = "";
      if (!archivo) return;
      if (alCambiar && !(await alCambiar())) return;
      encolar(ctx, tipo, [archivo]);
    },
  });
  return h(
    "div",
    { class: "archivo-unico" },
    vistaPrevia,
    h("div", { class: "archivo-unico__fila" }, h("span", { class: "archivo-unico__nombre" }, icono(ic), actual.archivo), entrada, boton("Cambiar", { clase: "boton--fantasma boton--chico", onclick: () => entrada.click() })),
  );
}

function seccionVoz(ctx) {
  const { voz } = ctx.reel.material;
  const p = ctx.reel.pasos;
  return h(
    "section",
    { class: "tarjeta" },
    cabeza("microfono", "Tu voz en off", voz ? h("span", { class: "chip chip--verde" }, icono("check"), "Lista") : h("span", { class: "chip chip--rosa" }, "Hace falta")),
    h("p", { class: "suave chico" }, "Grabala aparte, de corrido. Los silencios largos los sacamos nosotros."),
    archivoUnico(ctx, "voz", {
      actual: voz,
      titulo: "Arrastrá tu voz en off",
      detalle: "o tocá para elegirla · .m4a, .mp3 o .wav",
      ic: "microfono",
      vistaPrevia: voz ? h("audio", { controls: true, preload: "metadata", src: voz.url }) : null,
      alCambiar: () =>
        p.limpio || p.plan
          ? confirmar("¿Cambiar la voz en off?", "Hay que volver a preparar el material y armar los cortes de nuevo. La voz anterior queda guardada en edit/anteriores.", { si: "Cambiarla" })
          : true,
    }),
  );
}

function seccionMusica(ctx) {
  const { musica } = ctx.reel.material;
  return h(
    "section",
    { class: "tarjeta" },
    cabeza("musica", "Música", h("span", { class: "chip chip--gris" }, "Opcional")),
    archivoUnico(ctx, "musica", {
      actual: musica,
      titulo: "Sumá una canción",
      detalle: "Baja sola cuando hablás",
      ic: "musica",
      vistaPrevia: musica ? h("audio", { controls: true, preload: "none", src: musica.url }) : null,
    }),
  );
}

function seccionLogo(ctx) {
  const { logo } = ctx.reel.material;
  const propio = logo?.propio ? logo : null;
  return h(
    "section",
    { class: "tarjeta" },
    cabeza("logo", "Logo para el cierre", h("span", { class: "chip chip--gris" }, "Opcional")),
    logo && !logo.propio ? h("p", { class: "suave chico" }, "Se usa tu logo de siempre. Si querés otro solo para este reel, subilo acá.") : null,
    archivoUnico(ctx, "logo", {
      actual: propio,
      titulo: logo ? "Usar otro logo" : "Sumá tu logo",
      detalle: "Mejor .png con fondo transparente",
      ic: "imagen",
      vistaPrevia: propio?.url ? h("div", { class: "logo-previa" }, imagen(propio.url)) : null,
    }),
  );
}

function seccionGuion(ctx) {
  const estado = h("span", { class: "guardado" });
  const guardar = sinApuro(async (texto) => {
    try {
      await api(`/reels/${encodeURIComponent(ctx.reel.nombre)}/guion`, { metodo: "PUT", cuerpo: { texto } });
      ctx.reel.material.guion = texto;
      estado.replaceChildren(icono("check"), "Guardado");
      estado.classList.add("guardado--visible");
      setTimeout(() => estado.classList.remove("guardado--visible"), 1800);
    } catch (e) {
      mostrarError(e);
    }
  }, 800);
  const campo = h("textarea", {
    class: "campo",
    rows: 6,
    placeholder: "Pegá acá el guion que leíste.\n\nSi alguien dice una frase a cámara, escribila así:\nPersona que dice: ¡sácate las ganas!",
    value: ctx.reel.material.guion,
    oninput: () => guardar(campo.value),
    onblur: () => campo.value !== ctx.reel.material.guion && guardar.ya(campo.value),
  });
  return h(
    "section",
    { class: "tarjeta" },
    cabeza("texto", "Guion", h("span", { class: "fila-chica" }, estado, h("span", { class: "chip chip--gris" }, "Opcional"))),
    h("p", { class: "suave chico" }, "Ayuda a Claude con los nombres propios y a saber dónde va alguien hablando a cámara."),
    campo,
  );
}

