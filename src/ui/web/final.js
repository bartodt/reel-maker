// Paso 4: crear el reel, verlo y descargarlo.
import { boton, h, haceCuanto, icono, mostrarError, plural, reloj } from "./dom.js";
import { burbujaDeClaude, cajaDePedido, panelClaude } from "./cortes.js";
import { bloqueado, encabezado } from "./preparar.js";
import { errorDeTrabajo, panelVivo, progreso } from "./trabajo.js";

export function vistaReel(ctx) {
  const { reel, trabajo } = ctx;
  const creando = trabajo?.tipo === "render" && trabajo.estado === "corriendo";
  const fallo = trabajo?.tipo === "render" && trabajo.estado === "error" ? trabajo : null;
  const claude = trabajo?.tipo === "claude" ? trabajo : null;
  const crear = () => ctx.pedir("/render", { metodo: "POST", cuerpo: {} }).catch(mostrarError);

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
      encabezado("Tu reel", planOk ? "Está todo listo para crearlo." : null),
      fallo ? errorDeTrabajo(fallo, { reintentar: crear }) : null,
      h(
        "section",
        { class: "tarjeta tarjeta--destacada centro" },
        h(
          "div",
          { class: "resumen resumen--centro" },
          h("span", { class: "chip" }, icono("reloj"), reloj(reel.validacion?.duracion ?? 0)),
          h("span", { class: "chip" }, icono("video"), plural(reel.plan.tramos.length, "plano", "planos")),
          h("span", { class: "chip" }, icono("texto"), "Subtítulos"),
          m.musica ? h("span", { class: "chip" }, icono("musica"), "Música") : null,
          reel.plan.tramos.some((t) => t.logo) ? h("span", { class: "chip" }, icono("logo"), "Logo") : null,
        ),
        planOk
          ? boton("Crear mi reel", { icono: "play", clase: "boton--primario boton--enorme", onclick: crear })
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
      h(
        "div",
        { class: "botones" },
        h("a", { class: "boton boton--primario boton--grande", href: final.descargar, download: `${reel.nombre}.mp4` }, icono("descargar"), h("span", null, "Descargar")),
        boton("Mostrar en la carpeta", { icono: "carpeta", clase: "boton--secundario", onclick: () => ctx.pedir("/mostrar", { metodo: "POST", cuerpo: { archivo: "edit/final.mp4" } }).catch(mostrarError) }),
        !reel.pasos.finalViejo && planOk ? boton("Volver a crear", { icono: "deshacer", clase: "boton--fantasma", onclick: crear }) : null,
      ),
      h("div", { class: "separador" }),
      pedido,
      h("p", { class: "suave chico" }, "Después de un cambio, volvé a crear el reel para verlo. También podés tocar cada plano a mano en ", h("a", { href: `#/reel/${encodeURIComponent(reel.nombre)}/cortes` }, "Cortes"), "."),
    ),
  );
}
