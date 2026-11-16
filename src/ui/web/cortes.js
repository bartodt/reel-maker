// Paso 3: los cortes. Claude los arma; la creadora los ve como un storyboard y le pide cambios con sus palabras.
import { boton, confirmar, h, icono, imagen, mostrarError, plural, reloj, seg } from "./dom.js";
import { bloqueado, encabezado } from "./preparar.js";
import { errorDeTrabajo, panelVivo, transcurrido } from "./trabajo.js";

// Lo que se recuerda entre redibujos
const recuerdo = { reel: null, ritmo: null, pedido: "", cambio: "" };

const RITMOS = [
  { id: "rapido", titulo: "Rápido", detalle: "Muchos cortes, de menos de 1 s. Para cuando nombrás muchas cosas." },
  { id: "normal", titulo: "Normal", detalle: "Cortes de 1 a 1,5 s. Sirve para casi todo." },
  { id: "tranquilo", titulo: "Tranquilo", detalle: "Planos de 1,5 a 2,5 s. Para cuando hay pocas cosas para mostrar." },
];

export function vistaCortes(ctx) {
  const { reel, trabajo } = ctx;
  if (recuerdo.reel !== reel.nombre) Object.assign(recuerdo, { reel: reel.nombre, ritmo: null, pedido: "", cambio: "" });
  const p = reel.pasos;
  const preparado = p.limpio && p.transcripto && p.inventario;
  const claude = trabajo?.tipo === "claude" ? trabajo : null;

  if (claude?.estado === "corriendo") {
    return [encabezado(claude.etapas[0].titulo, null), panelVivo("", (t) => panelClaude(t, ctx), claude)];
  }
  if (!reel.plan) {
    if (!preparado) return bloqueado(ctx, "Primero hay que preparar el material.", "preparar", "Ir a Preparar");
    return [
      encabezado("Armá los cortes", "Qué video se ve en cada momento de tu voz."),
      claude?.estado === "error" ? errorDeTrabajo(claude) : null,
      tarjetaArmar(ctx),
    ];
  }
  return vistaDelPlan(ctx, claude);
}

// --- Claude trabajando ---

export function panelClaude(t, ctx) {
  const armando = t.etapas[0].titulo.includes("armando");
  const ultimas = t.actividad.slice(-7);
  return h(
    "div",
    { class: "trabajo trabajo--claude" },
    h(
      "div",
      { class: "trabajo__cabeza" },
      h("span", { class: "chispa-animada" }, icono("chispa")),
      h("strong", null, t.etapas[0].titulo),
      h("span", { class: "suave trabajo__tiempo" }, icono("reloj"), transcurrido(t)),
    ),
    h(
      "p",
      { class: "suave" },
      armando
        ? "Mira tus videos uno por uno, lee lo que decís y elige qué mostrar en cada frase. Suele tardar entre 3 y 10 minutos: podés hacer otra cosa mientras tanto."
        : "Suele tardar uno o dos minutos.",
    ),
    h(
      "ul",
      { class: "actividad" },
      ultimas.map((a, i) =>
        h("li", { class: i === ultimas.length - 1 ? "actividad--ahora" : "" }, i === ultimas.length - 1 ? h("span", { class: "girando girando--chico" }) : icono("check"), a),
      ),
    ),
    boton("Cancelar", { clase: "boton--secundario boton--chico", onclick: () => ctx.pedir("/cancelar", { metodo: "POST", cuerpo: {} }).catch(mostrarError) }),
  );
}

function tarjetaArmar(ctx) {
  const { reel, inicio } = ctx;
  recuerdo.ritmo ??= reel.plan?.ritmo ?? "normal";
  const opciones = h(
    "div",
    { class: "opciones-ritmo", role: "radiogroup", "aria-label": "Ritmo" },
    RITMOS.map((r) =>
      h(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": String(recuerdo.ritmo === r.id),
          class: ["opcion", recuerdo.ritmo === r.id && "opcion--elegida"],
          onclick: (e) => {
            recuerdo.ritmo = r.id;
            for (const b of opciones.children) {
              const elegida = b === e.currentTarget;
              b.classList.toggle("opcion--elegida", elegida);
              b.setAttribute("aria-checked", String(elegida));
            }
          },
        },
        h("span", { class: "opcion__barras" }, ...Array.from({ length: r.id === "rapido" ? 7 : r.id === "normal" ? 5 : 3 }, () => h("i"))),
        h("strong", null, r.titulo),
        h("span", { class: "suave chico" }, r.detalle),
      ),
    ),
  );
  const pedido = h("textarea", {
    class: "campo",
    rows: 2,
    placeholder: "Ej: arrancá con el café servido y terminá con el frente del local",
    value: recuerdo.pedido,
    oninput: () => (recuerdo.pedido = pedido.value),
  });
  const armar = () =>
    ctx.pedir("/claude", { metodo: "POST", cuerpo: { modo: "armar", ritmo: recuerdo.ritmo, pedido: recuerdo.pedido } }).catch(mostrarError);

  return h(
    "section",
    { class: "tarjeta tarjeta--destacada" },
    h("div", { class: "tarjeta__cabeza" }, h("h2", null, icono("chispa"), "Que Claude arme los cortes")),
    h("p", { class: "suave" }, "Claude mira tus videos, lee lo que decís y elige qué mostrar en cada momento, con tu estilo de edición. Después podés cambiar lo que quieras."),
    h("h3", null, "¿Qué ritmo querés?"),
    opciones,
    h("label", { class: "etiqueta" }, "¿Algo que quieras pedirle? ", h("span", { class: "suave" }, "(opcional)")),
    pedido,
    inicio.claude === "listo"
      ? h("div", { class: "fila" }, boton("Armar los cortes", { icono: "chispa", clase: "boton--primario boton--grande", onclick: armar }), h("span", { class: "suave chico" }, "Tarda unos minutos."))
      : avisoDeClaude(inicio),
  );
}

/** Si Claude no se puede usar todavía, qué hacer. */
export function avisoDeClaude(inicio) {
  if (inicio.claude === "listo") return null;
  const sinSesion = inicio.claude === "sin-sesion";
  return h(
    "div",
    { class: "alerta alerta--amarilla" },
    icono("alerta"),
    h(
      "div",
      null,
      h("strong", null, sinSesion ? "Falta iniciar sesión en Claude" : "Falta Claude Code en esta compu"),
      sinSesion
        ? h("p", null, "Abrí la Terminal, escribí ", h("code", null, "claude"), ", apretá Enter y seguí los pasos para entrar con tu cuenta. Se hace una sola vez. Después volvé acá.")
        : h("p", null, "Para que Claude arme y cambie los cortes hace falta tenerlo instalado. Pedile ayuda a quien te instaló la app."),
    ),
  );
}

/** Caja para pedirle un cambio a Claude con tus palabras. */
export function cajaDePedido(ctx, { titulo = "Pedile un cambio a Claude" } = {}) {
  if (ctx.inicio.claude !== "listo") return null;
  const campo = h("input", {
    class: "campo",
    type: "text",
    placeholder: "Ej: en “un taller” mostrá a la gente en la mesa",
    value: recuerdo.cambio,
    oninput: () => (recuerdo.cambio = campo.value),
  });
  const pedir = async () => {
    if (!campo.value.trim()) return campo.focus();
    campo.blur(); // si no, la pantalla espera a que termine de escribir para mostrar a Claude trabajando
    try {
      await ctx.pedir("/claude", { metodo: "POST", cuerpo: { modo: "cambiar", pedido: campo.value } });
      recuerdo.cambio = "";
    } catch (e) {
      mostrarError(e);
    }
  };
  campo.addEventListener("keydown", (e) => e.key === "Enter" && pedir());
  return h(
    "div",
    { class: "pedido" },
    h("label", { class: "etiqueta" }, icono("chispa"), titulo),
    h("div", { class: "pedido__fila" }, campo, boton("Pedir", { clase: "boton--violeta", onclick: pedir })),
  );
}

export function burbujaDeClaude(trabajo) {
  if (trabajo?.tipo !== "claude" || trabajo.estado !== "listo" || !trabajo.mensaje) return null;
  return h("div", { class: "burbuja" }, h("span", { class: "burbuja__autor" }, icono("chispa"), "Claude"), h("p", { class: "pre-linea" }, trabajo.mensaje));
}

// --- El plan como storyboard ---

/** Los mensajes de la validación, con palabras de la app en vez de los nombres de los campos. */
function amigable(texto) {
  return texto
    .replace(/^Tramo (\d+):/, "Plano $1:")
    .replace(/"arrancaEn"/g, "el momento del video")
    .replace(/"duracion"/g, "la duración")
    .replace(/"velocidad"/g, "la velocidad")
    .replace(/"encuadre"/g, "el encuadre")
    .replace(/"audioDelClip"/g, "el audio del video")
    .replace(/"texto"/g, "el texto")
    .replace(/tramos? con voz/g, (m) => m.replace("tramo", "plano"))
    .replace(/\btramos?\b/g, (m) => m.replace("tramo", "plano"));
}

function planoDelMensaje(texto) {
  const m = /^Tramo (\d+):/.exec(texto);
  return m ? Number(m[1]) - 1 : null;
}

function urlCuadro(nombre, clip, segundo, encuadre) {
  const q = new URLSearchParams({ archivo: `clips/${clip}`, t: Number(segundo).toFixed(2), vertical: "1", alto: "360" });
  if (encuadre !== undefined && encuadre !== null) q.set("encuadre", String(encuadre));
  return `/api/reels/${encodeURIComponent(nombre)}/cuadro?${q}`;
}

function vistaDelPlan(ctx, claude) {
  const { reel } = ctx;
  const { plan, validacion } = reel;
  const tramos = plan.tramos;
  const duracion = tramos.at(-1)?.fin ?? 0;
  const conProblema = new Set((validacion?.errores ?? []).map(planoDelMensaje).filter((i) => i !== null));

  return h(
    "div",
    { class: "cortes" },
    encabezado(
      "Tus cortes",
      "Qué se ve en cada momento. Para cambiar algo, pedíselo a Claude.",
      h(
        "div",
        { class: "resumen" },
        h("span", { class: "chip" }, icono("video"), plural(tramos.length, "plano", "planos")),
        h("span", { class: "chip" }, icono("reloj"), reloj(duracion)),
        plan.ritmo ? h("span", { class: "chip" }, icono("rayo"), `Ritmo ${RITMOS.find((r) => r.id === plan.ritmo)?.titulo.toLowerCase() ?? plan.ritmo}`) : null,
      ),
    ),
    claude?.estado === "error" ? errorDeTrabajo(claude) : null,
    claude?.estado === "cancelado" ? h("div", { class: "alerta alerta--amarilla" }, icono("alerta"), h("div", null, "Cancelaste el pedido a Claude. Si llegó a cambiar algo, podés deshacerlo.")) : null,
    burbujaDeClaude(claude),
    avisoDeClaude(ctx.inicio),
    estadoDelPlan(validacion),
    h(
      "div",
      { class: "herramientas" },
      cajaDePedido(ctx),
      h(
        "div",
        { class: "herramientas__botones" },
        boton("Deshacer", {
          icono: "deshacer",
          clase: "boton--secundario",
          disabled: !plan.hayAnterior,
          title: "Vuelve los cortes a como estaban antes del último cambio",
          onclick: () => ctx.pedir("/deshacer", { metodo: "POST", cuerpo: {} }).catch(mostrarError),
        }),
        ctx.inicio.claude === "listo"
          ? boton("Rearmar todo", {
              icono: "chispa",
              clase: "boton--fantasma",
              onclick: async () => {
                if (!(await confirmar("¿Que Claude arme todo de nuevo?", "Se reemplazan todos los cortes. Si después no te gusta, podés deshacer.", { si: "Rearmar" }))) return;
                ctx.pedir("/claude", { metodo: "POST", cuerpo: { modo: "armar", ritmo: plan.ritmo ?? "normal" } }).catch(mostrarError);
              },
            })
          : null,
      ),
    ),
    h(
      "div",
      { class: "storyboard" },
      tramos.map((t, i) => tarjetaDePlano(ctx, t, i, conProblema.has(i))),
    ),
    h(
      "div",
      { class: "pie-paso" },
      validacion?.ok
        ? boton("Siguiente: crear el reel", { icono: "adelante", clase: "boton--primario boton--grande boton--icono-derecha", onclick: () => ctx.ir("reel") })
        : h("p", { class: "suave" }, "Cuando no haya nada para arreglar, vas a poder crear el reel."),
    ),
  );
}

function estadoDelPlan(v) {
  if (!v) return null;
  if (v.ok && !v.avisos.length) return h("div", { class: "estado-plan estado-plan--ok" }, icono("check"), "Todo en orden. Cuando quieras, creá el reel.");
  const item = (texto) => h("li", null, amigable(texto));
  return h(
    "div",
    null,
    v.errores.length
      ? h(
          "div",
          { class: "alerta alerta--error" },
          icono("alerta"),
          h(
            "div",
            null,
            h("strong", null, v.errores.length === 1 ? "Hay algo para arreglar" : `Hay ${v.errores.length} cosas para arreglar`),
            h("ul", null, v.errores.map(item)),
            h("p", null, "Pedile a Claude que lo arregle."),
          ),
        )
      : null,
    v.avisos.length
      ? h("div", { class: "alerta alerta--amarilla" }, icono("alerta"), h("div", null, h("strong", null, "Para tener en cuenta"), h("ul", null, v.avisos.map(item))))
      : null,
  );
}

function etiquetaVelocidad(v) {
  if (v === undefined || v === 1) return null;
  if (v === 0) return "Congelada";
  return v < 1 ? `Lenta ×${String(v).replace(".", ",")}` : `×${String(v).replace(".", ",")}`;
}

function textoEnPantalla(texto) {
  return texto ? h("span", { class: "en-pantalla__texto" }, texto.split("\n").map((l, i) => [i ? h("br") : null, l])) : null;
}

function tarjetaDePlano(ctx, t, i, conProblema) {
  const velocidad = etiquetaVelocidad(t.velocidad);
  return h(
    "div",
    { class: ["plano", conProblema && "plano--problema"] },
    h(
      "div",
      { class: "plano__imagen en-pantalla" },
      imagen(urlCuadro(ctx.reel.nombre, t.clip, t.arrancaEn, t.encuadre)),
      textoEnPantalla(t.texto),
      t.logo ? h("span", { class: "en-pantalla__logo" }, icono("logo")) : null,
      h(
        "span",
        { class: "plano__insignias" },
        t.sinVoz ? h("span", { class: "insignia" }, t.audioDelClip ? [icono("altavoz"), "Habla"] : "Sin voz") : null,
        velocidad ? h("span", { class: "insignia" }, velocidad) : null,
      ),
      conProblema ? h("span", { class: "plano__alerta" }, icono("alerta")) : null,
    ),
    h(
      "div",
      { class: "plano__cuerpo" },
      h("div", { class: "plano__tiempo" }, h("strong", null, i + 1), h("span", null, `${reloj(t.inicio)} · ${seg(t.fin - t.inicio)}`)),
      h("p", { class: "plano__frase" }, t.sinVoz ? h("em", { class: "suave" }, t.nota || (t.audioDelClip ? "Se escucha el video" : "Sin voz en off")) : `“${t.frase || "…"}”`),
    ),
  );
}
