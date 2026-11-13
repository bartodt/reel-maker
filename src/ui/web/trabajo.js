// Cómo se muestra algo que está en marcha (preparar, Claude, crear el reel), y cómo se actualiza sin redibujar toda la pantalla.
import { boton, h, icono } from "./dom.js";

const paneles = new Set();

/** Un recuadro que se redibuja solo cada vez que llega cómo va el trabajo. */
export function panelVivo(clase, dibujar, trabajo) {
  const el = h("div", { class: clase });
  el.replaceChildren(...[dibujar(trabajo)].flat().filter(Boolean));
  paneles.add({ el, dibujar });
  return el;
}

/** Devuelve false si no había ningún panel en pantalla. */
export function actualizarPaneles(trabajo) {
  let alguno = false;
  for (const panel of paneles) {
    if (!panel.el.isConnected) {
      paneles.delete(panel);
      continue;
    }
    panel.el.replaceChildren(...[panel.dibujar(trabajo)].flat().filter(Boolean));
    alguno = true;
  }
  return alguno;
}

export function transcurrido(t) {
  const s = Math.round(((t.termino ?? Date.now()) - t.empezo) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

const ICONO_ETAPA = { listo: "check", error: "equis" };

/** Lista de etapas con su estado, barra de progreso y qué está haciendo ahora. */
export function progreso(t, { cancelar, nota } = {}) {
  const corriendo = t.etapas.find((e) => e.estado === "corriendo");
  const porcentaje = t.progreso === undefined || t.progreso === null ? null : Math.round(t.progreso * 100);
  return h(
    "div",
    { class: "trabajo" },
    h(
      "div",
      { class: "trabajo__cabeza" },
      h("span", { class: "girando" }),
      h("strong", null, corriendo?.titulo ?? "Trabajando"),
      h("span", { class: "suave trabajo__tiempo" }, icono("reloj"), transcurrido(t)),
    ),
    t.etapas.length > 1
      ? h(
          "ol",
          { class: "etapas" },
          t.etapas.map((e) =>
            h("li", { class: `etapa etapa--${e.estado}` }, h("span", { class: "etapa__marca" }, ICONO_ETAPA[e.estado] ? icono(ICONO_ETAPA[e.estado]) : null), e.titulo),
          ),
        )
      : null,
    h("div", { class: ["barra-progreso", porcentaje === null && "barra-progreso--sin-fin"] }, h("div", { style: { width: porcentaje === null ? "" : `${porcentaje}%` } })),
    h("p", { class: "trabajo__ahora" }, t.ahora ?? "", porcentaje !== null ? h("span", { class: "suave" }, ` · ${porcentaje}%`) : null),
    nota ? h("p", { class: "suave chico" }, nota) : null,
    cancelar ? boton("Cancelar", { clase: "boton--secundario boton--chico", onclick: cancelar }) : null,
  );
}

/** Cuando algo salió mal: el mensaje simple, y el detalle escondido por si hay que mandárselo a alguien. */
export function errorDeTrabajo(t, { reintentar } = {}) {
  return h(
    "div",
    { class: "alerta alerta--error" },
    icono("alerta"),
    h(
      "div",
      null,
      h("strong", null, "No se pudo terminar"),
      h("p", { class: "pre-linea" }, t.error),
      t.detalle?.length ? h("details", null, h("summary", null, "Ver detalle"), h("pre", null, t.detalle.slice(-40).join("\n"))) : null,
      reintentar ? boton("Probar de nuevo", { clase: "boton--secundario boton--chico", onclick: reintentar }) : null,
    ),
  );
}
