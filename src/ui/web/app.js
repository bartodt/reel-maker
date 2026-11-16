// La app: pantalla de inicio (tus reels) y la pantalla de cada reel, con sus cuatro pasos.
import { api, avisar, boton, h, haceCuanto, icono, imagen, mostrarError, plural, ventana } from "./dom.js";
import { vistaMaterial } from "./material.js";
import { vistaPreparar } from "./preparar.js";
import { vistaCortes } from "./cortes.js";
import { vistaReel } from "./final.js";
import { actualizarPaneles } from "./trabajo.js";

const app = document.getElementById("app");

const PASOS = [
  { id: "material", titulo: "Material", detalle: "Videos y voz", vista: vistaMaterial },
  { id: "preparar", titulo: "Preparar", detalle: "Silencios y textos", vista: vistaPreparar },
  { id: "cortes", titulo: "Cortes", detalle: "Qué se ve y cuándo", vista: vistaCortes },
  { id: "reel", titulo: "Tu reel", detalle: "Crear y descargar", vista: vistaReel },
];

const ETAPAS = {
  material: { texto: "Falta material", clase: "chip--gris" },
  preparar: { texto: "Para preparar", clase: "chip--amarillo" },
  cortes: { texto: "Armando cortes", clase: "chip--violeta" },
  reel: { texto: "Falta crear el reel", clase: "chip--rosa" },
  listo: { texto: "Terminado", clase: "chip--verde" },
};

let inicio = null; // Lo que dice el servidor de la compu: ffmpeg, Claude, clave de ElevenLabs
let actual = null; // { nombre, paso, reel, huella, trabajo }
let consulta = null;

// --- Rutas: #/  y  #/reel/<nombre>/<paso> ---

window.addEventListener("hashchange", mostrar);
mostrar();

async function mostrar() {
  const [, seccion, nombre, paso] = location.hash.replace(/^#/, "").split("/").map(decodeURIComponent);
  try {
    if (seccion === "reel" && nombre) {
      // Lo de la compu (Claude, ffmpeg, clave) se actualiza de fondo: cambiar de paso tiene que ser instantáneo
      if (inicio) api("/inicio").then((datos) => (inicio = datos)).catch(() => {});
      else inicio = await api("/inicio");
      if (actual?.nombre === nombre && PASOS.some((p) => p.id === paso)) {
        actual.paso = paso;
        dibujarReel();
        window.scrollTo(0, 0);
        return recargar();
      }
      await abrirReel(nombre, paso);
    } else {
      inicio = await api("/inicio");
      mostrarInicio();
    }
  } catch (e) {
    mostrarError(e);
    app.replaceChildren(h("main", { class: "contenedor vacio" }, h("h2", null, "No se pudo abrir"), h("p", { class: "suave" }, e.message), boton("Volver al inicio", { clase: "boton--secundario", onclick: () => (location.hash = "#/") })));
  }
}

function ir(nombre, paso) {
  location.hash = `#/reel/${encodeURIComponent(nombre)}/${paso}`;
}

// --- Inicio ---

function mostrarInicio() {
  actual = null;
  clearInterval(consulta);
  document.title = "Tus reels";
  const reels = inicio.reels;

  const tarjetas = reels.map((r) =>
    h(
      "a",
      { class: "tarjeta-reel", href: `#/reel/${encodeURIComponent(r.nombre)}` },
      h("div", { class: "tarjeta-reel__imagen" }, r.miniatura ? imagen(r.miniatura) : icono("video")),
      h(
        "div",
        { class: "tarjeta-reel__cuerpo" },
        h("h3", null, r.titulo),
        h("span", { class: `chip ${ETAPAS[r.etapa].clase}` }, ETAPAS[r.etapa].texto),
        h("small", { class: "suave" }, `${plural(r.clips, "video", "videos")} · ${haceCuanto(r.modificado)}`),
      ),
    ),
  );

  app.replaceChildren(
    barra(h("div", { class: "marca" }, h("span", { class: "marca__logo" }, icono("play")), "Reels")),
    h(
      "main",
      { class: "contenedor" },
      avisosDeLaCompu(),
      h(
        "section",
        { class: "portada" },
        h("div", null, h("h1", null, "Tus reels"), h("p", { class: "suave grande" }, "Subí tus videos y tu voz en off. La app saca los silencios, Claude arma los cortes y vos ajustás lo que quieras.")),
        boton("Nuevo reel", { icono: "mas", clase: "boton--primario boton--grande", onclick: nuevoReel }),
      ),
      reels.length
        ? h("div", { class: "grilla-reels" }, h("button", { type: "button", class: "tarjeta-reel tarjeta-reel--nueva", onclick: nuevoReel }, icono("mas"), h("span", null, "Nuevo reel")), tarjetas)
        : h(
            "div",
            { class: "vacio" },
            h("div", { class: "vacio__dibujo" }, icono("video")),
            h("h2", null, "Todavía no hay reels"),
            h("p", { class: "suave" }, "Creá el primero: le ponés un nombre y después subís el material."),
            boton("Crear mi primer reel", { icono: "mas", clase: "boton--primario", onclick: nuevoReel }),
          ),
      h("p", { class: "pie suave" }, "Tus reels se guardan en ", h("code", null, inicio.carpetaReels)),
    ),
  );
}

function avisosDeLaCompu() {
  if (inicio.ffmpeg === "ok") return null;
  return h(
    "div",
    { class: "alerta alerta--error" },
    icono("alerta"),
    h(
      "div",
      null,
      h("strong", null, inicio.ffmpeg === "falta" ? "Falta instalar ffmpeg" : "El ffmpeg de esta compu no sirve para los reels"),
      h("p", null, "Es el programa que corta y arma los videos. Pedile a quien te instaló la app que siga los pasos de “Qué necesitás” del README."),
    ),
  );
}

function nuevoReel() {
  const entrada = h("input", { class: "campo", placeholder: "Ej: Café de la esquina", maxlength: 60 });
  const crear = async () => {
    if (!entrada.value.trim()) return entrada.focus();
    try {
      const { nombre } = await api("/reels", { metodo: "POST", cuerpo: { titulo: entrada.value } });
      cerrar();
      ir(nombre, "material");
    } catch (e) {
      mostrarError(e);
    }
  };
  entrada.addEventListener("keydown", (e) => e.key === "Enter" && crear());
  const cerrar = ventana(
    [
      h("h2", null, "Nuevo reel"),
      h("p", { class: "suave" }, "¿Cómo se llama? Es solo para que lo encuentres después."),
      entrada,
      h("div", { class: "ventana__botones" }, boton("Cancelar", { clase: "boton--secundario", onclick: () => cerrar() }), boton("Crear", { clase: "boton--primario", onclick: crear })),
    ],
    { clase: "ventana--chica" },
  );
}

function barra(...contenido) {
  return h("header", { class: "barra" }, h("div", { class: "barra__adentro" }, contenido));
}

// --- Un reel ---

async function abrirReel(nombre, paso) {
  // La primera vez que se abre un reel con muchos videos tarda unos segundos
  if (actual?.nombre !== nombre) {
    clearInterval(consulta);
    app.replaceChildren(barra(h("a", { class: "volver", href: "#/" }, icono("atras"), h("span", null, "Tus reels"))), h("div", { class: "cargando" }, h("span", { class: "girando" }), h("p", { class: "suave" }, "Abriendo el reel…")));
  }
  const reel = await api(`/reels/${encodeURIComponent(nombre)}`);
  if (!PASOS.some((p) => p.id === paso)) {
    const etapa = reel.etapa === "listo" ? "reel" : reel.etapa;
    return history.replaceState(null, "", `#/reel/${encodeURIComponent(nombre)}/${etapa}`), abrirReel(nombre, etapa);
  }
  actual = { nombre, paso, reel, trabajo: reel.trabajo, huella: null, pendiente: false };
  document.title = `${reel.titulo} · Reels`;
  dibujarReel();
  window.scrollTo(0, 0);
  empezarConsultas();
}

/** Lo que reciben las pantallas de cada paso. */
function contexto() {
  return {
    reel: actual.reel,
    inicio,
    trabajo: actual.trabajo,
    ir: (paso) => ir(actual.nombre, paso),
    /** Pide algo al servidor sobre este reel. Si devuelve el reel actualizado, se redibuja. */
    pedir: async (ruta, opciones) => {
      const datos = await api(`/reels/${encodeURIComponent(actual.nombre)}${ruta}`, opciones);
      if (datos.nombre === actual.nombre && datos.pasos) actualizar(datos);
      return datos;
    },
    recargar,
    actualizarInicio: async () => {
      inicio = await api("/inicio");
      dibujarReel();
    },
  };
}

function actualizar(reel) {
  actual.reel = reel;
  actual.trabajo = reel.trabajo;
  // Lo que acaba de cambiar ya está en pantalla: la próxima consulta solo anota la huella nueva
  actual.huella = null;
  dibujarReel();
}

async function recargar() {
  if (!actual) return;
  try {
    actualizar(await api(`/reels/${encodeURIComponent(actual.nombre)}`));
  } catch (e) {
    mostrarError(e);
  }
}

function hechos(reel) {
  const p = reel.pasos;
  return {
    material: p.material,
    preparar: p.limpio && p.transcripto && p.inventario,
    cortes: p.plan && reel.validacion?.ok,
    reel: p.final && !p.finalViejo,
  };
}

function dibujarReel() {
  // Si está escribiendo en un campo, no le cambiamos la pantalla: se redibuja cuando sale del campo
  const foco = document.activeElement;
  const escribiendo = foco?.tagName === "TEXTAREA" || (foco?.tagName === "INPUT" && ["text", "password", "search", "number"].includes(foco.type));
  if (escribiendo && app.contains(foco)) {
    if (!actual.pendiente) {
      actual.pendiente = true;
      foco.addEventListener("blur", () => setTimeout(() => actual && actual.pendiente && ((actual.pendiente = false), dibujarReel()), 150), { once: true });
    }
    return;
  }
  actual.pendiente = false;
  const { reel, paso } = actual;
  const listos = hechos(reel);
  const indice = PASOS.findIndex((p) => p.id === paso);
  const ctx = contexto();

  const pasos = h(
    "nav",
    { class: "pasos", "aria-label": "Pasos" },
    PASOS.map((p, i) =>
      h(
        "a",
        { class: ["paso", p.id === paso && "paso--actual", listos[p.id] && "paso--hecho"], href: `#/reel/${encodeURIComponent(actual.nombre)}/${p.id}`, "aria-current": p.id === paso ? "step" : null },
        h("span", { class: "paso__numero" }, listos[p.id] ? icono("check") : String(i + 1)),
        h("span", { class: "paso__textos" }, h("span", { class: "paso__titulo" }, p.titulo), h("span", { class: "paso__detalle" }, p.detalle)),
      ),
    ),
  );

  // Se guarda dónde estaba el scroll para no saltar al redibujar
  const scroll = window.scrollY;
  app.replaceChildren(
    barra(
      h("a", { class: "volver", href: "#/" }, icono("atras"), h("span", null, "Tus reels")),
      h("div", { class: "barra__titulo" }, reel.titulo),
      boton("Abrir carpeta", { icono: "carpeta", clase: "boton--fantasma solo-grande", onclick: () => ctx.pedir("/mostrar", { metodo: "POST", cuerpo: {} }).catch(mostrarError) }),
    ),
    h("div", { class: "contenedor" }, pasos, bannerDeTrabajo(indice)),
    h("main", { class: "contenedor vista", id: "vista" }, PASOS[indice].vista(ctx)),
  );
  window.scrollTo(0, scroll);
}

/** Si hay algo en marcha en otro paso, un aviso arriba para ir a verlo. */
function bannerDeTrabajo(indice) {
  const t = actual.trabajo;
  if (!t || t.estado !== "corriendo") return null;
  const paso = { preparar: "preparar", claude: "cortes", render: "reel", edits: "reel" }[t.tipo];
  // El paso del trabajo ya lo muestra (y el de Claude también se ve en "Tu reel")
  if (paso === PASOS[indice].id || (t.tipo === "claude" && PASOS[indice].id === "reel")) return null;
  const titulo = t.etapas.find((e) => e.estado === "corriendo")?.titulo ?? "Trabajando";
  return h(
    "a",
    { class: "banner-trabajo", href: `#/reel/${encodeURIComponent(actual.nombre)}/${paso}` },
    h("span", { class: "girando" }),
    h("span", null, h("strong", null, titulo), t.ahora ? ` · ${t.ahora}` : ""),
    h("span", { class: "banner-trabajo__ver" }, "Ver", icono("adelante")),
  );
}

// --- Consultas: cada tanto se fija si cambió algo (un trabajo que avanza, Claude que escribió el plan...) ---

function empezarConsultas() {
  clearInterval(consulta);
  consulta = setInterval(consultar, 1500);
}

async function consultar() {
  if (!actual || document.hidden) return;
  const nombre = actual.nombre;
  let datos;
  try {
    datos = await api(`/reels/${encodeURIComponent(nombre)}/huella`);
  } catch {
    return;
  }
  if (!actual || actual.nombre !== nombre) return;
  const antes = actual.trabajo;
  const cambioArchivos = actual.huella !== null && datos.huella !== actual.huella;
  const termino = antes?.estado === "corriendo" && datos.trabajo?.estado !== "corriendo";
  actual.huella = datos.huella;
  if (cambioArchivos || termino) {
    if (termino && datos.trabajo?.estado === "listo") avisar(datos.trabajo.mensaje && datos.trabajo.tipo !== "claude" ? datos.trabajo.mensaje : "¡Listo!");
    return recargar();
  }
  // Mientras corre se actualiza siempre (para que avance el reloj)
  if (datos.trabajo?.estado === "corriendo" || JSON.stringify(datos.trabajo) !== JSON.stringify(antes)) {
    const empezo = datos.trabajo?.estado === "corriendo" && antes?.estado !== "corriendo";
    actual.trabajo = datos.trabajo;
    if (empezo) return dibujarReel();
    actualizarPaneles(datos.trabajo);
    const banner = document.querySelector(".banner-trabajo");
    const nuevo = bannerDeTrabajo(PASOS.findIndex((p) => p.id === actual.paso));
    if (banner && nuevo) banner.replaceWith(nuevo);
  }
}


