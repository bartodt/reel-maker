// Piezas chicas que usan todas las pantallas: armar elementos, hablar con el servidor, avisos, formatos.

/** Arma un elemento: h("button", { class: "boton", onclick }, "Texto"). Los textos nunca se interpretan como HTML. */
export function h(etiqueta, props, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = Array.isArray(v) ? v.filter(Boolean).join(" ") : v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value" || k === "checked" || k === "indeterminate") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  agregar(el, hijos);
  return el;
}

function agregar(el, hijos) {
  for (const hijo of hijos) {
    if (hijo === undefined || hijo === null || hijo === false) continue;
    if (Array.isArray(hijo)) agregar(el, hijo);
    else el.append(hijo instanceof Node ? hijo : String(hijo));
  }
}

// Íconos (trazos simples, 24x24)
const TRAZOS = {
  mas: "M12 5v14M5 12h14",
  atras: "M15 18l-6-6 6-6",
  adelante: "M9 18l6-6-6-6",
  carpeta: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 10l5-3v10l-5-3",
  microfono: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  musica: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  imagen: "M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4M15 9h.01",
  texto: "M4 6h16M4 12h10M4 18h13",
  subir: "M12 16V4M7 9l5-5 5 5M4 20h16",
  check: "M5 12l5 5 9-11",
  equis: "M6 6l12 12M18 6L6 18",
  chispa: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  deshacer: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  play: "M7 4l13 8-13 8z",
  descargar: "M12 4v12M7 11l5 5 5-5M4 20h16",
  tijera: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12",
  basura: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  alerta: "M12 3l10 18H2zM12 10v4M12 17.5v.01",
  reloj: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  ojo: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  rayo: "M13 2L4 14h7l-1 8 9-12h-7z",
  lapiz: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  logo: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
  altavoz: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12",
  llave: "M15 7a4 4 0 1 1-3.5 6L4 20.5V17h3v-3h3l1.5-1.5A4 4 0 0 1 15 7zM16 9h.01",
};

export function icono(nombre, clase = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", `icono ${clase}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", TRAZOS[nombre] ?? "");
  svg.append(path);
  return svg;
}

export function boton(texto, { icono: ic, clase = "", ...props } = {}) {
  return h("button", { type: "button", class: `boton ${clase}`.trim(), ...props }, ic ? icono(ic) : null, texto ? h("span", null, texto) : null);
}

// --- Servidor ---

export async function api(ruta, { metodo = "GET", cuerpo } = {}) {
  const r = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: { "x-reel": "1", ...(cuerpo !== undefined ? { "content-type": "application/json" } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(datos.error || "No me pude comunicar con la app. ¿Sigue abierta la ventana negra?");
    error.detalle = datos.detalle;
    throw error;
  }
  return datos;
}

/** Sube un archivo y va contando cuánto falta. */
export function subirArchivo(reel, tipo, archivo, alAvanzar) {
  return new Promise((resolver, rechazar) => {
    const x = new XMLHttpRequest();
    x.open("PUT", `/api/reels/${encodeURIComponent(reel)}/subir?${new URLSearchParams({ tipo, nombre: archivo.name })}`);
    x.setRequestHeader("x-reel", "1");
    x.upload.onprogress = (e) => e.lengthComputable && alAvanzar?.(e.loaded / e.total);
    x.onload = () => {
      let datos = {};
      try {
        datos = JSON.parse(x.responseText);
      } catch {}
      if (x.status >= 200 && x.status < 300) resolver(datos);
      else rechazar(new Error(datos.error || "No se pudo subir el archivo."));
    };
    x.onerror = () => rechazar(new Error("Se cortó la subida. Probá de nuevo."));
    x.send(archivo);
  });
}

// --- Avisos y ventanas ---

export function avisar(texto, tipo = "info") {
  const caja = document.getElementById("avisos");
  const aviso = h("div", { class: `aviso aviso--${tipo}`, role: "status" }, icono(tipo === "error" ? "alerta" : "check"), h("span", null, texto));
  caja.append(aviso);
  setTimeout(() => aviso.classList.add("aviso--saliendo"), tipo === "error" ? 6000 : 2800);
  setTimeout(() => aviso.remove(), tipo === "error" ? 6400 : 3200);
}

export function mostrarError(e) {
  avisar(e?.message || "Algo salió mal.", "error");
  if (e?.detalle) console.error(e.detalle);
}

/** Ventana con contenido. Devuelve una función para cerrarla. */
export function ventana(contenido, { clase = "", alCerrar } = {}) {
  const fondo = h("div", { class: "ventana-fondo" });
  const equis = h("button", { type: "button", class: "ventana__cerrar", "aria-label": "Cerrar", title: "Cerrar", onclick: () => cerrar() }, icono("equis"));
  const caja = h("div", { class: `ventana ${clase}`.trim(), role: "dialog", "aria-modal": "true" }, equis, contenido);
  fondo.append(caja);
  const cerrar = () => {
    fondo.remove();
    document.removeEventListener("keydown", teclas);
    alCerrar?.();
  };
  const teclas = (e) => e.key === "Escape" && cerrar();
  fondo.addEventListener("mousedown", (e) => e.target === fondo && cerrar());
  document.addEventListener("keydown", teclas);
  document.body.append(fondo);
  setTimeout(() => caja.querySelector("input, textarea, [data-foco]")?.focus(), 30);
  return cerrar;
}

export function confirmar(titulo, texto, { si = "Sí", no = "Cancelar", peligro = false } = {}) {
  return new Promise((resolver) => {
    let respuesta = false;
    const cerrar = ventana(
      [
        h("h2", null, titulo),
        texto ? h("p", { class: "suave" }, texto) : null,
        h(
          "div",
          { class: "ventana__botones" },
          boton(no, { clase: "boton--secundario", onclick: () => cerrar() }),
          boton(si, { clase: peligro ? "boton--peligro" : "boton--primario", "data-foco": true, onclick: () => ((respuesta = true), cerrar()) }),
        ),
      ],
      { clase: "ventana--chica", alCerrar: () => resolver(respuesta) },
    );
  });
}

export function verImagen(url, titulo) {
  ventana([h("img", { src: url, alt: titulo ?? "" }), titulo ? h("p", { class: "suave centro" }, titulo) : null], { clase: "ventana--imagen" });
}

// --- Formatos ---

const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** 1.25 → "1,3 s" */
export function seg(n) {
  return `${decimal.format(n)} s`;
}

/** 75.3 → "1:15" */
export function reloj(n) {
  const total = Math.max(0, Math.round(n));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function haceCuanto(ms) {
  const minutos = Math.round((Date.now() - ms) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return dias === 1 ? "ayer" : `hace ${dias} días`;
  return new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Espera a que dejen de llamarla un rato antes de correr (para guardar mientras se escribe). */
export function sinApuro(fn, ms = 600) {
  let espera;
  const envuelta = (...args) => {
    clearTimeout(espera);
    espera = setTimeout(() => fn(...args), ms);
  };
  envuelta.ya = (...args) => {
    clearTimeout(espera);
    fn(...args);
  };
  return envuelta;
}

/** Zona para soltar archivos (o tocar y elegirlos). */
export function zonaDeArchivos({ titulo, detalle, acepta, varios = false, alElegir, icono: ic = "subir", compacta = false }) {
  const entrada = h("input", { type: "file", accept: acepta, multiple: varios, hidden: true, onchange: () => {
    if (entrada.files?.length) alElegir([...entrada.files]);
    entrada.value = "";
  } });
  const zona = h(
    "label",
    { class: ["zona", compacta && "zona--compacta"], tabindex: 0, onkeydown: (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), entrada.click()) },
    entrada,
    h("span", { class: "zona__icono" }, icono(ic)),
    h("span", { class: "zona__titulo" }, titulo),
    detalle ? h("span", { class: "zona__detalle" }, detalle) : null,
  );
  zona.addEventListener("dragover", (e) => {
    e.preventDefault();
    zona.classList.add("zona--encima");
  });
  zona.addEventListener("dragleave", () => zona.classList.remove("zona--encima"));
  zona.addEventListener("drop", (e) => {
    e.preventDefault();
    zona.classList.remove("zona--encima");
    const archivos = [...(e.dataTransfer?.files ?? [])];
    if (archivos.length) alElegir(varios ? archivos : archivos.slice(0, 1));
  });
  return zona;
}

/** Imagen que, si no carga, muestra un recuadro gris en vez de un ícono roto. */
export function imagen(src, props = {}) {
  const img = h("img", { src, loading: "lazy", decoding: "async", alt: "", ...props });
  img.addEventListener("error", () => img.classList.add("sin-imagen"));
  return img;
}
