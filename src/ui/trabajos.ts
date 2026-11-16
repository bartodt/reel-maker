// Las cosas que tardan (preparar el material, que Claude arme los cortes, crear el reel) corren en segundo plano.
// La app pregunta cada tanto cómo van.
import { execFile, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { entornoParaClaude, leerLinea, leerSesion } from "../lib/actividad.js";
import { RAIZ_REPO } from "../lib/entorno.js";
import { ErrorReel } from "../lib/errores.js";
import type { Ritmo } from "../lib/plan.js";
import type { Proyecto } from "../lib/proyecto.js";
import { mandarAEdits } from "../pasos/edits.js";
import { inventario } from "../pasos/inventario.js";
import { limpiar } from "../pasos/limpiar.js";
import { render } from "../pasos/render.js";
import { transcribir } from "../pasos/transcribir.js";
import type { Pasos } from "../lib/estado.js";
import { descartarVersionSiNoCambio, guardarVersion, planDelFinal } from "./reels.js";

type EstadoEtapa = "pendiente" | "corriendo" | "listo" | "error";

export interface Trabajo {
  tipo: "preparar" | "claude" | "render" | "edits";
  estado: "corriendo" | "listo" | "error" | "cancelado";
  etapas: { id: string; titulo: string; estado: EstadoEtapa }[];
  /** De 0 a 1. Si no está, no se sabe cuánto falta. */
  progreso?: number;
  /** Qué está haciendo ahora, en palabras simples */
  ahora?: string;
  /** Lo último que fue haciendo */
  actividad: string[];
  /** Lo que imprimieron los pasos, por si hace falta ver el detalle */
  detalle: string[];
  mensaje?: string;
  error?: string;
  empezo: number;
  termino?: number;
}

const trabajos = new Map<string, Trabajo & { cancelar?: () => void }>();

export function trabajoDe(p: Proyecto): Trabajo | null {
  const t = trabajos.get(p.raiz);
  if (!t) return null;
  const { cancelar: _, ...visible } = t;
  return visible;
}

export function cancelar(p: Proyecto) {
  const t = trabajos.get(p.raiz);
  if (!t || t.estado !== "corriendo" || !t.cancelar) throw new ErrorReel("No hay nada para cancelar.");
  t.cancelar();
}

function nuevo(p: Proyecto, tipo: Trabajo["tipo"], etapas: Trabajo["etapas"]) {
  if (trabajos.get(p.raiz)?.estado === "corriendo") throw new ErrorReel("Ya hay algo en marcha en este reel. Esperá a que termine.");
  const t: Trabajo & { cancelar?: () => void } = { tipo, estado: "corriendo", etapas, actividad: [], detalle: [], empezo: Date.now() };
  trabajos.set(p.raiz, t);
  return t;
}

function anotar(t: Trabajo, linea: string) {
  t.detalle.push(linea);
  if (t.detalle.length > 300) t.detalle.splice(0, t.detalle.length - 300);
}

function contar(t: Trabajo, actividad: string) {
  t.ahora = actividad;
  if (t.actividad.at(-1) !== actividad) t.actividad.push(actividad);
  if (t.actividad.length > 40) t.actividad.splice(0, t.actividad.length - 40);
}

function fallo(t: Trabajo, e: unknown) {
  t.estado = "error";
  t.termino = Date.now();
  t.ahora = undefined;
  const corriendo = t.etapas.find((x) => x.estado === "corriendo");
  if (corriendo) corriendo.estado = "error";
  if (e instanceof ErrorReel) {
    t.error = e.message;
  } else {
    t.error = "Algo salió mal. Abrí el detalle y mandáselo a quien te instaló la app.";
    anotar(t, e instanceof Error ? e.message : String(e));
  }
}

// --- Preparar: limpiar la voz, transcribir y mirar los videos ---

export function preparar(p: Proyecto, pasos: Pasos, todo: boolean) {
  const hacerLimpiar = todo || !pasos.limpio;
  const hacerTranscribir = hacerLimpiar || !pasos.transcripto;
  const hacerInventario = todo || !pasos.inventario;
  if (hacerTranscribir && !process.env.ELEVENLABS_API_KEY) {
    throw new ErrorReel("Falta la clave de ElevenLabs para escribir lo que decís. Cargala y probá de nuevo.");
  }
  const etapa = (id: string, titulo: string, hacer: boolean) => ({ id, titulo, estado: (hacer ? "pendiente" : "listo") as EstadoEtapa });
  const t = nuevo(p, "preparar", [
    etapa("limpiar", "Sacar los silencios de tu voz", hacerLimpiar),
    etapa("transcribir", "Escribir lo que decís", hacerTranscribir),
    etapa("inventario", "Mirar tus videos", hacerInventario),
  ]);

  const clips = p.clips();
  const correr = async () => {
    for (const e of t.etapas) {
      if (e.estado === "listo") continue;
      e.estado = "corriendo";
      t.progreso = undefined;
      t.ahora = e.titulo;
      if (e.id === "limpiar") await limpiar(p, (l) => anotar(t, l));
      if (e.id === "transcribir") await transcribir(p, (l) => anotar(t, l));
      if (e.id === "inventario") {
        let vistos = 0;
        t.progreso = 0;
        await inventario(p, (l) => {
          anotar(t, l);
          const clip = clips.find((c) => l.startsWith(`${c}: `));
          if (clip) {
            t.progreso = ++vistos / clips.length;
            t.ahora = `Miré ${vistos} de ${clips.length} videos`;
          }
        });
      }
      e.estado = "listo";
    }
    t.estado = "listo";
    t.termino = Date.now();
    t.ahora = undefined;
    t.mensaje = "¡Material listo!";
  };
  correr().catch((e) => fallo(t, e));
}

// --- Crear el reel ---

export function renderizar(p: Proyecto) {
  const t = nuevo(p, "render", [
    { id: "planos", titulo: "Recortar cada plano", estado: "corriendo" },
    { id: "final", titulo: "Juntar todo con la voz, la música y los textos", estado: "pendiente" },
  ]);
  t.progreso = 0;
  t.ahora = "Empezando";
  // Se anota con qué plan se creó, para saber después si los cortes cambiaron
  let plan = "";
  try {
    plan = readFileSync(p.plan, "utf8");
  } catch {
    // Sin plan, el render avisa
  }
  render(p, (l) => {
    anotar(t, l);
    const m = /^Tramo (\d+)\/(\d+)/.exec(l);
    if (!m) return;
    const [hecho, total] = [Number(m[1]), Number(m[2])];
    t.progreso = hecho / total;
    t.ahora = `Plano ${hecho} de ${total}`;
    if (hecho === total) {
      t.etapas[0].estado = "listo";
      t.etapas[1].estado = "corriendo";
      t.progreso = undefined;
      t.ahora = "Juntando todo (es lo que más tarda)";
    }
  })
    .then(() => {
      writeFileSync(planDelFinal(p), plan);
      t.etapas.forEach((e) => (e.estado = "listo"));
      t.estado = "listo";
      t.termino = Date.now();
      t.ahora = undefined;
      t.mensaje = "¡Tu reel está listo!";
    })
    .catch((e) => fallo(t, e));
}

// --- Armar el reel en Edits ---

export function armarEnEdits(p: Proyecto) {
  if (!process.env.EDITS_TOKEN) throw new ErrorReel("Falta la clave de Edits. Cargala y probá de nuevo.");
  const t = nuevo(p, "edits", [
    { id: "material", titulo: "Preparar el material para Edits", estado: "corriendo" },
    { id: "planos", titulo: "Poner cada plano", estado: "pendiente" },
    { id: "resto", titulo: "Voz, música, textos y subtítulos", estado: "pendiente" },
  ]);
  t.ahora = "Empezando";
  const etapa = (id: string) => {
    for (const e of t.etapas) {
      if (e.id === id) {
        e.estado = "corriendo";
        break;
      }
      e.estado = "listo";
    }
  };
  mandarAEdits(p, (l) => {
    anotar(t, l);
    const m = /^Plano (\d+)\/(\d+)/.exec(l);
    if (m) {
      etapa("planos");
      t.progreso = Number(m[1]) / Number(m[2]);
      t.ahora = `Plano ${m[1]} de ${m[2]}`;
    } else if (/^Proyecto nuevo/.test(l)) {
      etapa("planos");
      t.progreso = 0;
      t.ahora = "Cargando tus videos en Edits";
    } else if (/^(Poniendo|Escribiendo)/.test(l)) {
      etapa("resto");
      t.progreso = undefined;
      t.ahora = l === "Poniendo la voz" ? "Poniendo tu voz" : l === "Escribiendo los subtítulos" ? "Escribiendo y corrigiendo los subtítulos" : l;
    }
  })
    .then(({ titulo }) => {
      t.etapas.forEach((e) => (e.estado = "listo"));
      t.estado = "listo";
      t.termino = Date.now();
      t.ahora = undefined;
      t.progreso = undefined;
      t.mensaje = `¡Listo! Abrí Edits: está como "${titulo}".`;
    })
    .catch((e) => fallo(t, e));
}

// --- Claude arma o cambia los cortes ---

/** "listo": se puede usar. "sin-sesion": está instalado pero hay que iniciar sesión. "falta": no está instalado. */
export type EstadoClaude = "listo" | "sin-sesion" | "falta";
let estadoClaude: { valor: EstadoClaude; cuando: number } | undefined;

let revisando: Promise<EstadoClaude> | undefined;

/**
 * Se fija si Claude Code está instalado y con sesión (tarda un segundo o dos). Si ya se sabe, contesta al toque;
 * si no estaba listo, se vuelve a fijar en segundo plano cada tanto, por si mientras tanto inició sesión.
 */
export async function revisarClaude(): Promise<EstadoClaude> {
  const viejo = estadoClaude && estadoClaude.valor !== "listo" && Date.now() - estadoClaude.cuando > 10_000;
  if (!estadoClaude || viejo) {
    revisando ??= new Promise<EstadoClaude>((resolver) =>
      execFile("claude", ["auth", "status"], { env: entornoParaClaude(process.env), timeout: 20_000 }, (error, salida) => {
        if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return resolver("falta");
        resolver(leerSesion(salida) ? "listo" : "sin-sesion");
      }),
    ).then((valor) => {
      estadoClaude = { valor, cuando: Date.now() };
      revisando = undefined;
      return valor;
    });
    if (!estadoClaude) return revisando;
  }
  return estadoClaude.valor;
}

const SIN_SESION =
  "Claude no tiene la sesión iniciada en esta compu. Abrí la Terminal, escribí claude, apretá Enter y seguí los pasos para entrar. Se hace una sola vez.";

export function promptParaClaude(p: Proyecto, o: { modo: "armar" | "cambiar"; pedido?: string; ritmo?: Ritmo }) {
  const pedido = o.pedido?.trim();
  const sinPreguntas =
    "Esto corre desde la app de reels y no hay nadie para contestarte: no hagas preguntas. " +
    "Si algo no está claro, decidí vos con el criterio de la skill y de estilo.md.";
  const validar = `Corré \`npm run validar -- ${p.raiz}\` hasta que dé OK. No renderices: la creadora revisa los cortes en la app y crea el reel desde ahí.`;
  if (o.modo === "armar") {
    return [
      `Usá la skill reel para armar el plan de cortes del reel de la carpeta ${p.raiz}.`,
      "Los pasos 1 a 3 (voz limpia, transcripción e inventario) ya están hechos: no los vuelvas a correr. Completá las descripciones que falten en inventario.json mirando las capturas.",
      o.ritmo ? `Ritmo: "${o.ritmo}".` : "",
      pedido ? `La creadora pidió esto: "${pedido}".` : "",
      sinPreguntas,
      `Escribí edit/plan.json. ${validar}`,
      "Al final, contale en 2 o 3 oraciones simples cómo armaste el reel (sin tecnicismos, sin nombres de archivos ni de campos del plan).",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `En la carpeta ${p.raiz} hay un reel con su plan de cortes (edit/plan.json). La creadora pide este cambio: "${pedido}".`,
    'Usá la skill reel (la parte "Cambios después del primer render"). Cambiá solo lo que pide.',
    "Si el pedido es sobre su forma de editar en general (no solo de este reel), anotalo también en estilo.md.",
    sinPreguntas,
    validar,
    "Al final, contale en 1 o 2 oraciones simples qué cambiaste (sin tecnicismos, sin nombres de archivos ni de campos del plan).",
  ].join("\n");
}

/** Qué puede hacer Claude cuando lo llama la app: leer, escribir solo dentro de edit/ del reel (y estilo.md), y validar. */
export function permisosParaClaude(p: Proyecto) {
  const absoluta = (ruta: string) => `/${ruta}`; // En los permisos, las rutas absolutas van con dos barras
  const editable = [`${absoluta(p.edit)}/**`, absoluta(`${RAIZ_REPO}/.claude/skills/reel/estilo.md`)];
  return ["Read", "Glob", "Grep", "Skill", ...editable.flatMap((r) => [`Edit(${r})`, `Write(${r})`]), "Bash(npm run validar:*)"];
}

export async function pedirAClaude(p: Proyecto, o: { modo: "armar" | "cambiar"; pedido?: string; ritmo?: Ritmo }) {
  const claude = await revisarClaude();
  if (claude === "falta") throw new ErrorReel("No encontré Claude Code en esta compu.");
  if (claude === "sin-sesion") throw new ErrorReel(SIN_SESION);
  if (o.modo === "cambiar" && !o.pedido?.trim()) throw new ErrorReel("Escribí qué querés cambiar.");
  const t = nuevo(p, "claude", [
    { id: "claude", titulo: o.modo === "armar" ? "Claude está armando los cortes" : "Claude está haciendo el cambio", estado: "corriendo" },
  ]);
  contar(t, "Arrancando");
  const copia = guardarVersion(p);

  const proceso = spawn(
    "claude",
    [
      "-p", promptParaClaude(p, o),
      "--output-format", "stream-json",
      "--verbose",
      "--add-dir", p.raiz,
      "--allowedTools", ...permisosParaClaude(p),
    ],
    { cwd: RAIZ_REPO, stdio: ["ignore", "pipe", "pipe"], env: entornoParaClaude(process.env) },
  );
  t.cancelar = () => {
    t.estado = "cancelado";
    t.termino = Date.now();
    t.ahora = undefined;
    proceso.kill("SIGTERM");
  };

  let resultado: { texto: string; error: boolean } | undefined;
  createInterface({ input: proceso.stdout }).on("line", (linea) => {
    const leido = leerLinea(linea);
    for (const a of leido.actividades) contar(t, a);
    if (leido.resultado) resultado = leido.resultado;
  });
  createInterface({ input: proceso.stderr }).on("line", (l) => anotar(t, l));
  proceso.on("error", (e) => fallo(t, e));
  proceso.on("close", (codigo) => {
    descartarVersionSiNoCambio(p, copia);
    if (t.estado !== "corriendo") return;
    if (codigo === 0 && resultado && !resultado.error) {
      t.etapas[0].estado = "listo";
      t.estado = "listo";
      t.termino = Date.now();
      t.ahora = undefined;
      t.mensaje = resultado.texto;
    } else {
      if (resultado?.texto) anotar(t, resultado.texto);
      const deSesion = /not logged in|\/login|failed to authenticate|oauth|invalid api key/i;
      const sinSesion = t.detalle.some((l) => deSesion.test(l)) || deSesion.test(resultado?.texto ?? "");
      if (sinSesion) estadoClaude = undefined;
      fallo(t, new ErrorReel(sinSesion ? SIN_SESION : "Claude no pudo terminar. Probá de nuevo en un rato."));
    }
  });
}
