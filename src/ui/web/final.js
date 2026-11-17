// Paso 4: crear el reel, verlo y descargarlo.
import { boton, h, haceCuanto, icono, mostrarError, plural, reloj } from "./dom.js";
import { burbujaDeClaude, cajaDePedido, panelClaude } from "./cortes.js";
import { bloqueado, encabezado, tarjetaClave } from "./preparar.js";
import { errorDeTrabajo, panelVivo, progreso } from "./trabajo.js";

export function vistaReel(ctx) {
  const { reel, trabajo } = ctx;
  const creando = trabajo?.tipo === "render" && trabajo.estado === "corriendo";
  const fallo = trabajo?.tipo === "render" && trabajo.estado === "error" ? trabajo : null;
  const claude = trabajo?.tipo === "claude" ? trabajo : null;
  const crear = () => ctx.pedir("/render", { metodo: "POST", cuerpo: {} }).catch(mostrarError);
  const enEdits = trabajo?.tipo === "edits" && trabajo.estado === "corriendo";

  if (enEdits) {
    return [
      encabezado("Armando tu reel en Edits", "Dejá Edits abierto. Vas a ver cómo se arma solo."),
      panelVivo("", (t) => progreso(t, { nota: "Suele tardar un par de minutos." }), trabajo),
    ];
  }
  if (creando) {
    return [
      encabezado("Creando tu reel", "Podés seguir usando la compu mientras tanto."),
      panelVivo("", (t) => progreso(t, { nota: "Suele tardar entre uno y tres minutos." }), trabajo),
    ];
  }
  if (!reel.plan) return bloqueado(ctx, "Primero hay que armar los cortes.", "cortes", "Ir a Cortes");

  const planOk = reel.validacion?.ok;
  const final = reel.final;
  const pedido = claude?.estado === "corriendo" ? panelVivo("", (t) => panelClaude(t, ctx), claude) : [burbujaDeClaude(claude), cajaDePedido(ctx, { titulo: "¿Querés cambiar algo? Pedíselo a Claude" })];

  if (!final) {
    const m = reel.material;
    return [
      encabezado("Tu reel", planOk ? "Está todo listo." : null),
      interruptorSubtitulos(ctx),
      tarjetaEdits(ctx, planOk),
      fallo ? errorDeTrabajo(fallo, { reintentar: crear }) : null,
      h(
        "section",
        { class: "tarjeta centro" },
        h(
          "div",
          { class: "resumen resumen--centro" },
          h("span", { class: "chip" }, icono("reloj"), reloj(reel.validacion?.duracion ?? 0)),
          h("span", { class: "chip" }, icono("video"), plural(reel.plan.tramos.length, "plano", "planos")),
          m.musica ? h("span", { class: "chip" }, icono("musica"), "Música") : null,
          reel.plan.tramos.some((t) => t.logo) ? h("span", { class: "chip" }, icono("logo"), "Logo") : null,
        ),
        planOk
          ? h("div", null, h("p", { class: "suave" }, "¿Lo querés ver antes acá, como video?"), boton("Crear el video", { icono: "play", clase: "boton--secundario", onclick: crear }))
          : h("div", null, h("p", { class: "suave" }, "Antes hay que arreglar algo en los cortes."), boton("Ir a Cortes", { icono: "atras", clase: "boton--secundario", onclick: () => ctx.ir("cortes") })),
      ),
    ];
  }

  return h(
    "div",
    { class: "final" },
    h("div", { class: "telefono" }, h("video", { class: "telefono__video", src: final.url, controls: true, playsinline: true, preload: "metadata" })),
    h(
      "div",
      { class: "final__lado" },
      h("h1", null, reel.pasos.finalViejo ? "Tu reel" : "¡Tu reel está listo!"),
      h("p", { class: "suave grande" }, `${reloj(final.duracion)} · vertical para Instagram · creado ${haceCuanto(final.modificado)}`),
      interruptorSubtitulos(ctx),
      reel.pasos.finalViejo
        ? h(
            "div",
            { class: "alerta alerta--amarilla" },
            icono("alerta"),
            h(
              "div",
              null,
              h("strong", null, "Cambiaste los cortes después de crearlo"),
              h("p", null, "Lo que ves es la versión anterior."),
              planOk ? boton("Crear de nuevo con los cambios", { icono: "play", clase: "boton--primario", onclick: crear }) : boton("Hay algo para arreglar en los cortes", { clase: "boton--secundario", onclick: () => ctx.ir("cortes") }),
            ),
          )
        : null,
      fallo ? errorDeTrabajo(fallo, { reintentar: crear }) : null,
      tarjetaEdits(ctx, planOk),
      h(
        "div",
        { class: "botones" },
        h("a", { class: "boton boton--primario boton--grande", href: final.descargar, download: `${reel.nombre}.mp4` }, icono("descargar"), h("span", null, "Descargar")),
        boton("Mostrar en la carpeta", { icono: "carpeta", clase: "boton--secundario", onclick: () => ctx.pedir("/mostrar", { metodo: "POST", cuerpo: { archivo: "edit/final.mp4" } }).catch(mostrarError) }),
        !reel.pasos.finalViejo && planOk ? boton("Volver a crear", { icono: "deshacer", clase: "boton--fantasma", onclick: crear }) : null,
      ),
      h("div", { class: "separador" }),
      pedido,
      h("p", { class: "suave chico" }, "Después de un cambio, volvé a crear el reel para verlo."),
    ),
  );
}

/** Terminar el reel en Edits: la app lo arma ahí y la creadora lo retoca y lo publica desde Edits. */
function tarjetaEdits(ctx, planOk) {
  const { reel, trabajo, inicio } = ctx;
  if (!inicio.claveEdits) return tarjetaClave(ctx, "edits");
  const armar = () => ctx.pedir("/edits", { metodo: "POST", cuerpo: {} }).catch(mostrarError);
  const fallo = trabajo?.tipo === "edits" && trabajo.estado === "error" ? trabajo : null;
  const ya = reel.edits;
  return h(
    "section",
    { class: "tarjeta tarjeta--destacada centro" },
    h("h2", null, ya ? "Tu reel está en Edits" : "Terminalo en Edits"),
    ya
      ? h("p", { class: "suave" }, `Abrí Edits: está como "${ya.titulo}". Lo armaste ${haceCuanto(ya.modificado)}.`)
      : h("p", { class: "suave" }, `La app lo arma en Edits con ${reel.plan.subtitulos ? "tus cortes, tu voz, los textos y los subtítulos" : "tus cortes, tu voz y los textos"}. Después lo retocás y lo publicás desde ahí.`),
    ya?.cortesCambiados ? h("p", null, h("strong", null, "Cambiaste los cortes después."), " Si lo armás de nuevo, se crea otro proyecto en Edits y el anterior queda como está.") : null,
    fallo ? errorDeTrabajo(fallo, { reintentar: armar }) : null,
    planOk
      ? boton(ya ? "Armarlo de nuevo en Edits" : "Armarlo en Edits", { icono: "play", clase: ya && !ya.cortesCambiados ? "boton--secundario" : "boton--primario boton--enorme", onclick: armar })
      : h("div", null, h("p", { class: "suave" }, "Antes hay que arreglar algo en los cortes."), boton("Ir a Cortes", { icono: "atras", clase: "boton--secundario", onclick: () => ctx.ir("cortes") })),
  );
}

function interruptorSubtitulos(ctx) {
  const casilla = h("input", {
    type: "checkbox",
    checked: ctx.reel.plan.subtitulos,
    onchange: () =>
      ctx.pedir("/subtitulos", { metodo: "POST", cuerpo: { activos: casilla.checked } }).catch((e) => {
        casilla.checked = !casilla.checked;
        mostrarError(e);
      }),
  });
  return h("label", { class: "interruptor" }, casilla, h("span", { class: "interruptor__pista" }), h("span", null, "Con subtítulos"));
}
