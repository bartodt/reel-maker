// Paso 3: los cortes. Claude los arma; la creadora los ve como un storyboard y cambia lo que quiera.
import { boton, confirmar, h, icono, imagen, mostrarError, plural, reloj, seg, sinApuro, ventana } from "./dom.js";
import { bloqueado, encabezado } from "./preparar.js";
import { errorDeTrabajo, panelVivo, transcurrido } from "./trabajo.js";

// Lo que se recuerda entre redibujos
const recuerdo = { reel: null, elegido: null, ritmo: null, pedido: "", cambio: "" };

const RITMOS = [
  { id: "rapido", titulo: "Rápido", detalle: "Muchos cortes, de menos de 1 s. Para cuando nombrás muchas cosas." },
  { id: "normal", titulo: "Normal", detalle: "Cortes de 1 a 1,5 s. Sirve para casi todo." },
  { id: "tranquilo", titulo: "Tranquilo", detalle: "Planos de 1,5 a 2,5 s. Para cuando hay pocas cosas para mostrar." },
];

const VELOCIDADES = [
  { v: 0, texto: "Congelada" },
  { v: 0.5, texto: "Lenta" },
  { v: 1, texto: "Normal" },
  { v: 2, texto: "Rápida" },
  { v: 4, texto: "Muy rápida" },
];

export function vistaCortes(ctx) {
  const { reel, trabajo } = ctx;
  if (recuerdo.reel !== reel.nombre) Object.assign(recuerdo, { reel: reel.nombre, elegido: null, ritmo: null, pedido: "", cambio: "" });
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
  return editorDePlan(ctx, claude);
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
        : h("p", null, "Para que Claude arme y cambie los cortes hace falta tenerlo instalado. Pedile ayuda a quien te instaló la app. Mientras tanto, podés cambiar cada plano a mano."),
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

export function urlCuadro(nombre, clip, segundo, encuadre, alto = 360) {
  const q = new URLSearchParams({ archivo: `clips/${clip}`, t: Number(segundo).toFixed(2), vertical: "1", alto: String(alto) });
  if (encuadre !== undefined && encuadre !== null) q.set("encuadre", String(encuadre));
  return `/api/reels/${encodeURIComponent(nombre)}/cuadro?${q}`;
}

function editorDePlan(ctx, claude) {
  const { reel } = ctx;
  const { plan, validacion } = reel;
  const tramos = plan.tramos;
  if (recuerdo.elegido !== null && recuerdo.elegido >= tramos.length) recuerdo.elegido = null;
  const duracion = tramos.at(-1)?.fin ?? 0;
  const problemas = new Map();
  for (const e of validacion?.errores ?? []) {
    const i = planoDelMensaje(e);
    if (i !== null) problemas.set(i, amigable(e));
  }

  const abrir = (i) => {
    recuerdo.elegido = i;
    ctx.recargar();
  };

  const editor = recuerdo.elegido !== null ? editorDePlano(ctx, recuerdo.elegido, problemas.get(recuerdo.elegido)) : null;

  return h(
    "div",
    { class: ["cortes", editor && "cortes--con-editor"] },
    encabezado(
      "Tus cortes",
      "Tocá un plano para cambiarle el video, el momento, el texto o la velocidad.",
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
    estadoDelPlan(validacion, abrir),
    h(
      "div",
      { class: "herramientas" },
      cajaDePedido(ctx),
      h(
        "div",
        { class: "herramientas__botones" },
        interruptor("Subtítulos", plan.subtitulos !== false, (v) =>
          ctx.pedir("/plan", { metodo: "POST", cuerpo: { op: "subtitulos", activos: v } }).catch(mostrarError),
        ),
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
      tramos.map((t, i) => tarjetaDePlano(ctx, t, i, problemas.has(i), () => abrir(i))),
    ),
    h(
      "div",
      { class: "pie-paso" },
      validacion?.ok
        ? boton("Siguiente: crear el reel", { icono: "adelante", clase: "boton--primario boton--grande boton--icono-derecha", onclick: () => ctx.ir("reel") })
        : h("p", { class: "suave" }, "Cuando no haya nada para arreglar, vas a poder crear el reel."),
    ),
    editor,
  );
}

function estadoDelPlan(v, abrir) {
  if (!v) return null;
  if (v.ok && !v.avisos.length) return h("div", { class: "estado-plan estado-plan--ok" }, icono("check"), "Todo en orden. Cuando quieras, creá el reel.");
  const item = (texto) => {
    const i = planoDelMensaje(texto);
    return h("li", null, i !== null ? h("button", { type: "button", class: "enlace", onclick: () => abrir(i) }, amigable(texto)) : amigable(texto));
  };
  return h(
    "div",
    null,
    v.errores.length
      ? h("div", { class: "alerta alerta--error" }, icono("alerta"), h("div", null, h("strong", null, v.errores.length === 1 ? "Hay algo para arreglar" : `Hay ${v.errores.length} cosas para arreglar`), h("ul", null, v.errores.map(item))))
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

function tarjetaDePlano(ctx, t, i, conProblema, abrir) {
  const velocidad = etiquetaVelocidad(t.velocidad);
  return h(
    "button",
    { type: "button", class: ["plano", recuerdo.elegido === i && "plano--elegido", conProblema && "plano--problema"], onclick: abrir },
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

// --- Editor de un plano ---

function editorDePlano(ctx, i, problema) {
  const { reel } = ctx;
  const tramos = reel.plan.tramos;
  const t = tramos[i];
  const clip = reel.material.clips.find((c) => c.archivo === t.clip);
  const enInventario = reel.inventario.find((c) => c.archivo === t.clip);
  const duracionPlano = t.fin - t.inicio;
  const velocidad = t.velocidad ?? 1;
  const usa = velocidad === 0 ? 0 : duracionPlano * velocidad;

  const cambiar = (cambios) => ctx.pedir("/plan", { metodo: "POST", cuerpo: { op: "cambiar", indice: i, cambios } }).catch(mostrarError);
  const operar = (op, extra) => ctx.pedir("/plan", { metodo: "POST", cuerpo: { op, indice: i, ...extra } }).catch(mostrarError);
  const cerrar = () => {
    recuerdo.elegido = null;
    ctx.recargar();
  };
  const ir = (j) => {
    recuerdo.elegido = j;
    ctx.recargar();
  };

  // Vista previa: se actualiza al toque mientras se mueve el momento o el encuadre, y se guarda al soltar
  const previa = imagen(urlCuadro(reel.nombre, t.clip, t.arrancaEn, t.encuadre, 640));
  const vistaPrevia = sinApuro((segundo, encuadre) => (previa.src = urlCuadro(reel.nombre, t.clip, segundo, encuadre, 640)), 120);

  return h(
    "aside",
    { class: "editor", "aria-label": `Plano ${i + 1}`, "data-scroll": "editor" },
    h(
      "div",
      { class: "editor__cabeza" },
      boton("", { icono: "atras", clase: "boton--icono", title: "Plano anterior", disabled: i === 0, onclick: () => ir(i - 1) }),
      h("div", { class: "editor__titulo" }, h("strong", null, `Plano ${i + 1}`), h("span", { class: "suave chico" }, `${reloj(t.inicio)} – ${reloj(t.fin)} · ${seg(duracionPlano)}`)),
      boton("", { icono: "adelante", clase: "boton--icono", title: "Plano siguiente", disabled: i === tramos.length - 1, onclick: () => ir(i + 1) }),
      boton("", { icono: "equis", clase: "boton--icono", title: "Cerrar", onclick: cerrar }),
    ),
    problema ? h("div", { class: "alerta alerta--error alerta--chica" }, icono("alerta"), h("div", null, problema)) : null,
    h("div", { class: "editor__previa en-pantalla" }, previa, textoEnPantalla(t.texto), t.logo ? h("span", { class: "en-pantalla__logo" }, icono("logo")) : null),

    t.sinVoz ? bloqueDuracion(t, cambiar) : bloqueFrase(ctx, t, i, operar),
    bloqueVideo(ctx, t, i, cambiar, usa),
    bloqueMomento(t, clip ?? enInventario, enInventario, usa, cambiar, (s) => vistaPrevia(s, t.encuadre)),
    clip ? bloqueEncuadre(t, clip, cambiar, (e) => vistaPrevia(t.arrancaEn, e)) : null,
    bloqueVelocidad(t, cambiar),
    bloqueTexto(t, cambiar),
    bloqueLogo(ctx, t, cambiar),
    t.sinVoz ? bloqueAudio(t, clip, cambiar) : null,
    t.nota ? h("p", { class: "suave chico editor__nota" }, "Nota: ", t.nota) : null,
    h(
      "div",
      { class: "editor__pie" },
      boton("Sacar este plano", {
        icono: "basura",
        clase: "boton--peligro-suave",
        onclick: async () => {
          const texto = t.sinVoz ? "Desaparece del reel." : "Lo que se dice en este plano pasa al plano de al lado.";
          if (await confirmar(`¿Sacar el plano ${i + 1}?`, texto, { si: "Sacarlo", peligro: true })) {
            recuerdo.elegido = null;
            operar("quitar");
          }
        },
      }),
    ),
  );
}

function bloque(titulo, ...contenido) {
  return h("section", { class: "bloque" }, h("h3", null, titulo), ...contenido);
}

/** Las palabras de este plano (y las primeras del siguiente), para partir o mover el corte. */
function bloqueFrase(ctx, t, i, operar) {
  const { palabras, plan } = ctx.reel;
  const propias = palabras.filter((w) => w.desde >= t.desde - 0.05 && w.desde < t.hasta);
  const j = plan.tramos.findIndex((x, k) => k > i && !x.sinVoz);
  const siguiente = j >= 0 ? plan.tramos[j] : null;
  const ajenas = siguiente ? palabras.filter((w) => w.desde >= siguiente.desde - 0.05 && w.desde < siguiente.hasta).slice(0, 6) : [];

  const menu = (ancla, opciones) => {
    document.querySelector(".menu-palabra")?.remove();
    const caja = h(
      "div",
      { class: "menu-palabra", role: "menu" },
      opciones.map(([texto, accion, ic]) =>
        boton(texto, {
          icono: ic,
          clase: "boton--menu",
          role: "menuitem",
          onclick: () => {
            caja.remove();
            accion();
          },
        }),
      ),
    );
    ancla.after(caja);
    setTimeout(() => document.addEventListener("click", (e) => !caja.contains(e.target) && caja.remove(), { once: true }), 0);
  };

  return bloque(
    "Qué se dice",
    h("p", { class: "suave chico" }, "Tocá una palabra para partir el plano o mover dónde corta."),
    h(
      "div",
      { class: "palabras" },
      propias.map((w, k) =>
        h(
          "button",
          {
            type: "button",
            class: "palabra",
            disabled: k === 0,
            title: k === 0 ? "Así empieza el plano" : null,
            onclick: (e) =>
              menu(e.currentTarget, [
                ["Empezar un plano nuevo acá", () => operar("partir", { segundo: w.desde }), "tijera"],
                siguiente ? ["Que desde acá siga el plano siguiente", () => operar("corte", { segundo: w.desde }), "adelante"] : null,
              ].filter(Boolean)),
          },
          w.texto,
        ),
      ),
      ajenas.length ? h("span", { class: "palabras__corte", title: "Acá corta al plano siguiente" }, icono("tijera")) : null,
      ajenas.map((w) => {
        // Alargar hasta esta palabra (incluida): el corte pasa a la palabra que viene después, si sigue dentro del plano siguiente
        const despues = palabras.find((x) => x.desde > w.desde);
        const puede = despues && despues.desde < siguiente.hasta - 0.1;
        return h(
          "button",
          {
            type: "button",
            class: "palabra palabra--ajena",
            disabled: !puede,
            title: puede ? null : "Es lo último del plano siguiente",
            onclick: (e) => menu(e.currentTarget, [["Alargar este plano hasta acá", () => operar("corte", { segundo: despues.desde }), "atras"]]),
          },
          w.texto,
        );
      }),
    ),
  );
}

function bloqueDuracion(t, cambiar) {
  const pasos = [-0.5, -0.1, 0.1, 0.5];
  return bloque(
    "Cuánto dura",
    h("p", { class: "suave chico" }, "Este plano va sin tu voz en off: la voz espera mientras se ve."),
    h(
      "div",
      { class: "fila" },
      h("span", { class: "numero-grande" }, seg(t.duracion)),
      pasos.map((p) =>
        boton(`${p > 0 ? "+" : "−"}${String(Math.abs(p)).replace(".", ",")}`, {
          clase: "boton--secundario boton--chico",
          disabled: t.duracion + p < 0.2,
          onclick: () => cambiar({ duracion: Math.round((t.duracion + p) * 100) / 100 }),
        }),
      ),
    ),
  );
}

function bloqueVideo(ctx, t, i, cambiar, usa) {
  const { reel } = ctx;
  const elegirVideo = () => {
    const descripciones = new Map(reel.inventario.map((c) => [c.archivo, c.descripcion]));
    const cerrar = ventana(
      [
        h("h2", null, `Elegí el video del plano ${i + 1}`),
        h(
          "div",
          { class: "selector-videos" },
          reel.material.clips.map((c) =>
            h(
              "button",
              {
                type: "button",
                class: ["selector-video", c.archivo === t.clip && "selector-video--actual"],
                onclick: () => {
                  cerrar();
                  // Si el momento de antes entra en el video nuevo, se mantiene; si no, arranca del principio
                  const arrancaEn = t.arrancaEn + usa <= c.duracion ? t.arrancaEn : 0;
                  cambiar({ clip: c.archivo, arrancaEn });
                },
              },
              h("div", { class: "selector-video__imagen" }, imagen(c.miniatura), h("span", { class: "clip__duracion" }, seg(c.duracion))),
              h("strong", { class: "corta" }, c.archivo),
              descripciones.get(c.archivo) ? h("span", { class: "suave chico selector-video__descripcion" }, descripciones.get(c.archivo)) : null,
            ),
          ),
        ),
      ],
      { clase: "ventana--grande" },
    );
  };
  return bloque("Video", h("div", { class: "fila fila--separada" }, h("span", { class: "archivo-unico__nombre" }, icono("video"), t.clip), boton("Cambiar video", { clase: "boton--secundario boton--chico", onclick: elegirVideo })));
}

function bloqueMomento(t, clip, enInventario, usa, cambiar, previa) {
  if (!clip) return null;
  const maximo = Math.max(0, clip.duracion - usa - 0.05);
  const valor = h("strong", null, seg(t.arrancaEn));
  const ventanaUso = h("div", { class: "linea-clip__uso" });
  const dibujarUso = (desde) => {
    ventanaUso.style.left = `${(desde / clip.duracion) * 100}%`;
    ventanaUso.style.width = `${Math.max(1, (Math.max(usa, 0.05) / clip.duracion) * 100)}%`;
  };
  dibujarUso(t.arrancaEn);
  const deslizador = h("input", {
    type: "range",
    class: "deslizador",
    min: 0,
    max: maximo.toFixed(2),
    step: 0.05,
    value: Math.min(t.arrancaEn, maximo),
    "aria-label": "Desde qué segundo del video",
    oninput: () => {
      const s = Number(deslizador.value);
      valor.textContent = seg(s);
      dibujarUso(s);
      previa(s);
    },
    onchange: () => cambiar({ arrancaEn: Number(deslizador.value) }),
  });
  const mover = (d) => cambiar({ arrancaEn: Math.min(maximo, Math.max(0, Math.round((t.arrancaEn + d) * 100) / 100)) });
  const momentos = enInventario?.momentos ?? [];
  const cercano = momentos.reduce((m, x, k) => (Math.abs(x - t.arrancaEn) < Math.abs(momentos[m] - t.arrancaEn) ? k : m), 0);

  return bloque(
    "Desde qué momento del video",
    h("p", { class: "suave chico" }, "Arranca en el segundo ", valor, ` · usa ${usa ? seg(usa) : "un solo cuadro"} de un video de ${seg(clip.duracion)}.`),
    momentos.length
      ? h(
          "div",
          { class: "tira" },
          momentos.map((m, k) =>
            h(
              "button",
              { type: "button", class: ["tira__cuadro", k === cercano && "tira__cuadro--cerca"], title: `Desde el segundo ${seg(m)}`, onclick: () => cambiar({ arrancaEn: Math.min(m, maximo) }) },
              imagen(urlCuadro(ctxNombre(), t.clip, m, t.encuadre, 160)),
              h("span", null, seg(m)),
            ),
          ),
        )
      : null,
    h("div", { class: "linea-clip" }, ventanaUso, deslizador),
    h(
      "div",
      { class: "fila fila--centro" },
      [-1, -0.2, 0.2, 1].map((d) => boton(`${d > 0 ? "+" : "−"}${String(Math.abs(d)).replace(".", ",")} s`, { clase: "boton--secundario boton--chico", onclick: () => mover(d) })),
    ),
  );
}

// El nombre del reel abierto (para armar URLs dentro de bloques que no reciben el contexto)
function ctxNombre() {
  return recuerdo.reel;
}

function bloqueEncuadre(t, clip, cambiar, previa) {
  if (!clip.ancho || !clip.alto) return null;
  const proporcion = clip.ancho / clip.alto;
  if (Math.abs(proporcion - 9 / 16) < 0.02) return null; // Ya es vertical como el reel: no hay nada que recortar
  const horizontal = proporcion > 9 / 16;
  const [a, b] = horizontal ? ["Izquierda", "Derecha"] : ["Arriba", "Abajo"];
  const nombres = horizontal ? { izquierda: 0, centro: 0.5, derecha: 1 } : { arriba: 0, centro: 0.5, abajo: 1 };
  const actual = typeof t.encuadre === "number" ? t.encuadre : t.encuadre in { izquierda: 1, arriba: 1 } ? 0 : t.encuadre in { derecha: 1, abajo: 1 } ? 1 : 0.5;
  const deslizador = h("input", {
    type: "range",
    class: "deslizador",
    min: 0,
    max: 1,
    step: 0.05,
    value: actual,
    "aria-label": "Encuadre",
    oninput: () => previa(Number(deslizador.value)),
    onchange: () => cambiar({ encuadre: Number(deslizador.value) }),
  });
  return bloque(
    "Encuadre",
    h("p", { class: "suave chico" }, horizontal ? "El video es horizontal: elegí qué parte se ve." : "Elegí qué parte del video se ve."),
    h("div", { class: "deslizador-con-extremos" }, h("span", { class: "suave chico" }, a), deslizador, h("span", { class: "suave chico" }, b)),
    h(
      "div",
      { class: "segmentado" },
      Object.entries(nombres).map(([nombre, v]) =>
        h("button", { type: "button", class: ["segmentado__opcion", Math.abs(actual - v) < 0.01 && "segmentado__opcion--elegida"], onclick: () => cambiar({ encuadre: nombre }) }, nombre[0].toUpperCase() + nombre.slice(1)),
      ),
    ),
  );
}

function bloqueVelocidad(t, cambiar) {
  const actual = t.velocidad ?? 1;
  const conAudio = t.sinVoz && t.audioDelClip;
  const opciones = VELOCIDADES.some((o) => o.v === actual) ? VELOCIDADES : [...VELOCIDADES, { v: actual, texto: `×${String(actual).replace(".", ",")}` }];
  return bloque(
    "Velocidad",
    conAudio ? h("p", { class: "suave chico" }, "Como se escucha el video, va a velocidad normal.") : null,
    h(
      "div",
      { class: "segmentado" },
      opciones.map((o) =>
        h(
          "button",
          { type: "button", class: ["segmentado__opcion", o.v === actual && "segmentado__opcion--elegida"], disabled: conAudio && o.v !== 1, onclick: () => o.v !== actual && cambiar({ velocidad: o.v }) },
          o.texto,
        ),
      ),
    ),
  );
}

function bloqueTexto(t, cambiar) {
  const campo = h("textarea", {
    class: "campo",
    rows: 2,
    placeholder: "Ej: CASA GIRO\nMARTÍNEZ",
    value: t.texto ?? "",
    onblur: () => campo.value !== (t.texto ?? "") && cambiar({ texto: campo.value.trim() ? campo.value : null }),
  });
  return bloque(
    "Texto grande",
    h("p", { class: "suave chico" }, "Aparece arriba, palabra por palabra mientras lo decís. Con Enter cortás la línea. Si el plano de al lado tiene el mismo texto, queda fijo entre los dos."),
    campo,
  );
}

function bloqueLogo(ctx, t, cambiar) {
  const hayLogo = Boolean(ctx.reel.material.logo);
  return bloque(
    "Logo",
    interruptor("Mostrar el logo en el centro", Boolean(t.logo), (v) => cambiar({ logo: v }), !hayLogo && !t.logo),
    !hayLogo ? h("p", { class: "suave chico" }, "Para usarlo, subí un logo en el paso Material.") : null,
  );
}

function bloqueAudio(t, clip, cambiar) {
  const tieneAudio = clip?.tieneAudio ?? true;
  return bloque(
    "Sonido",
    interruptor("Que se escuche el video", Boolean(t.audioDelClip), (v) => cambiar({ audioDelClip: v }), !tieneAudio && !t.audioDelClip),
    h("p", { class: "suave chico" }, tieneAudio ? "Por ejemplo, alguien que habla a cámara. Si no, solo suena la música." : "Este video no tiene sonido."),
  );
}

function interruptor(texto, valor, alCambiar, deshabilitado) {
  return h(
    "label",
    { class: ["interruptor", deshabilitado && "interruptor--apagado"] },
    h("input", { type: "checkbox", checked: valor, disabled: deshabilitado, onchange: (e) => alCambiar(e.currentTarget.checked) }),
    h("span", { class: "interruptor__pista" }),
    h("span", null, texto),
  );
}
