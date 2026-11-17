import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { before, test, type TestContext } from "node:test";
import { promisify } from "node:util";
import { EDITS, MUSICA } from "../../src/config.js";
import { RAIZ_REPO } from "../../src/lib/entorno.js";
import { ErrorReel } from "../../src/lib/errores.js";
import { ffmpeg } from "../../src/lib/ffmpeg.js";
import { armarMontaje, diferenciasConEdits, ratosConAudioDelClip } from "../../src/lib/montaje.js";
import type { Plan } from "../../src/lib/plan.js";
import { leerJson, type Proyecto } from "../../src/lib/proyecto.js";
import type { Palabra } from "../../src/lib/transcripcion.js";
import { archivoEdits, mandarAEdits } from "../../src/pasos/edits.js";
import { EditsFalso, type Falla, type OpcionesDeEditsFalso } from "../lib/edits-falso.js";
import { DURACION_VOZ, crearProyectoDePrueba, escribirPlan } from "../lib/fixtures.js";

const PLAN_COMPLETO: Plan = {
  tramos: [
    { duracion: 1, clip: "vertical.mov", arrancaEn: 0, texto: "HOLA\nPRUEBA" },
    { desde: 0, hasta: 2.5, clip: "horizontal.mp4", arrancaEn: 0, velocidad: 2 },
    { duracion: 1.5, clip: "con-audio.mp4", arrancaEn: 1, audioDelClip: true },
    { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0.2 },
    { duracion: 1, clip: "vertical.mov", arrancaEn: 3.9, velocidad: 0, logo: true },
  ],
};
const DURACION_DEL_REEL = DURACION_VOZ + 3.5;
const SEGUNDOS_DE_VOZ_QUE_NO_SON_MULTIPLO_DE_1_600 = 5.999;

const PLAN_DE_TRES_PLANOS: Plan = {
  tramos: [
    { duracion: 1, clip: "vertical.mov", arrancaEn: 0, texto: "HOLA\nPRUEBA" },
    { desde: 0, hasta: 2.5, clip: "horizontal.mp4", arrancaEn: 0 },
    { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0.2 },
  ],
};

const [dondeHablaAlguienDelClip] = ratosConAudioDelClip(armarMontaje(PLAN_COMPLETO));
const SUBTITULOS_QUE_ESCRIBE_EDITS = [
  { text: "Ola esto es una prueva", startTime: 1.1, endTime: 3 },
  { text: "sácate las ganas", startTime: dondeHablaAlguienDelClip.inicio + 0.2, endTime: dondeHablaAlguienDelClip.fin - 0.2 },
  { text: "y esto tambien", startTime: 5.5, endTime: 6.7 },
];

let p: Proyecto;
let carpetaParaEdits: string;

before(async () => {
  p = await crearProyectoDePrueba({ conMusica: true });
  await ffmpeg(["-f", "lavfi", "-i", `sine=f=440:d=${SEGUNDOS_DE_VOZ_QUE_NO_SON_MULTIPLO_DE_1_600}`, "-ar", "48000", p.vozLimpia]);
  carpetaParaEdits = mkdtempSync(path.join(tmpdir(), "reel-test-edits-"));
});

async function conEditsFalso(t: TestContext, plan: Plan, opciones: OpcionesDeEditsFalso = {}) {
  const falso = await EditsFalso.abrir(opciones);
  t.after(() => falso.cerrar());
  process.env.EDITS_URL = falso.url;
  process.env.EDITS_TOKEN = falso.clave;
  process.env.EDITS_CARPETA = carpetaParaEdits;
  escribirPlan(p.raiz, plan);
  rmSync(archivoEdits(p), { force: true });
  return falso;
}

const silencio = () => {};
const cerca = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 0.05;

test("arma en Edits el reel completo: planos en orden, velocidades, voz, música, texto y logo", async (t) => {
  const plan = { ...PLAN_COMPLETO, subtitulos: false };
  const falso = await conEditsFalso(t, plan, { textosAlCursor: [1] });

  const { proyecto, titulo } = await mandarAEdits(p, silencio);

  const armado = falso.abierto;
  assert.ok(armado?.guardado, "el proyecto tenía que quedar abierto y guardado");
  assert.deepEqual([armado.id, armado.name], [proyecto, path.basename(p.raiz)]);
  assert.deepEqual(leerJson<{ proyecto: string; titulo: string }>(archivoEdits(p)).proyecto, armado.id);

  const principal = armado.elementos.filter((e) => e.trackType === "video");
  assert.deepEqual(
    principal.map((e) => [e.nombreDeArchivo, e.content, e.speed, e.volume]),
    [
      ["vertical.mov", "video", 1, 0],
      ["horizontal.mp4", "video", 2, 0],
      ["con-audio.mp4", "video", 1, 1],
      ["vertical.mov", "video", 1, 0],
      ["congelado-5.jpg", "photo", 1, 1],
    ],
  );
  assert.equal(new Set(principal.map((e) => e.trackId)).size, 1, "todos los planos van en la pista principal");
  assert.ok(cerca(principal.at(-1)?.endTime, DURACION_DEL_REEL), `el reel dura ${principal.at(-1)?.endTime} s y el plan ${DURACION_DEL_REEL}`);

  const { words } = leerJson<{ words: Palabra[] }>(p.transcripcion);
  assert.deepEqual(diferenciasConEdits(armarMontaje(plan), armado.elementos, armado.subtitulos, words, plan.tramos), []);

  const musica = armado.elementos.find((e) => e.nombreDeArchivo === "musica.mp3");
  assert.ok(musica && musica.startTime === 0 && cerca(musica.endTime, 3), "la música va desde el principio y dura lo que dura el archivo");
  assert.equal(musica.volume, MUSICA.volumen);
  const logo = armado.elementos.find((e) => e.nombreDeArchivo === "logo.png");
  assert.ok(logo && cerca(logo.startTime, DURACION_DEL_REEL - 1) && cerca(logo.endTime, DURACION_DEL_REEL), "el logo va sobre el cierre");

  assert.ok(!falso.llamadas.some((l) => l.herramienta === "generateCaptions"), "el plan va sin subtítulos");
  assert.deepEqual(readdirSync(path.join(carpetaParaEdits, titulo)).sort(), [
    "con-audio.mp4",
    "congelado-5.jpg",
    "horizontal.mp4",
    "logo.png",
    "musica.mp3",
    "vertical.mov",
    "voz-limpia.wav",
  ]);
  assert.ok(!existsSync(path.join(homedir(), "Movies", "reel-maker", titulo)), "no tenía que escribir en la carpeta Películas de verdad");
});

test("corrige con la transcripción los subtítulos que escribe Edits y borra los de quien habla en el clip", async (t) => {
  const falso = await conEditsFalso(t, PLAN_COMPLETO, { subtitulos: SUBTITULOS_QUE_ESCRIBE_EDITS });

  await mandarAEdits(p, silencio);

  const armado = falso.abierto;
  assert.ok(armado);
  assert.deepEqual(
    armado.subtitulos.map((s) => s.text),
    ["Hola esto es una prueba", "Y esto también"],
  );
  assert.equal(armado.estiloDeSubtitulos, EDITS.subtitulos.estilo);
  const { words } = leerJson<{ words: Palabra[] }>(p.transcripcion);
  assert.deepEqual(diferenciasConEdits(armarMontaje(PLAN_COMPLETO), armado.elementos, armado.subtitulos, words, PLAN_COMPLETO.tramos), []);
});

const rechazo = (motivo: string): Falla => ({ tipo: "rechazo", motivo });
const FALLAS: { caso: string; herramienta: Parameters<EditsFalso["fallar"]>[0]; vez?: number; falla: Falla; mensaje: string; detalle: RegExp }[] = [
  {
    caso: "no puede abrir el proyecto nuevo",
    herramienta: "newProject",
    falla: rechazo("project was created but the editor did not open it"),
    mensaje: "Edits no pudo crear el proyecto.",
    detalle: /^Detalle: Edits contestó a newProject: project was created but the editor did not open it$/,
  },
  {
    caso: "corta la conexión al crear el proyecto",
    herramienta: "newProject",
    falla: { tipo: "corta" },
    mensaje: "Edits dejó de contestar al crear el proyecto. Fijate que siga abierto y probá de nuevo.",
    detalle: /^Detalle: newProject quedó sin respuesta: /,
  },
  {
    caso: "no puede cargar un archivo",
    herramienta: "importToMediaPanel",
    falla: rechazo("unsupported media"),
    mensaje: "Edits no pudo cargar vertical.mov.",
    detalle: /^Detalle: Edits contestó a importToMediaPanel: unsupported media$/,
  },
  {
    caso: "no puede pasar el tercer plano a la pista principal",
    herramienta: "convertToMain",
    vez: 3,
    falla: rechazo("the main track is locked"),
    mensaje: "Edits no pudo poner el plano 3 en la pista principal.",
    detalle: /^Detalle: Edits contestó a convertToMain: the main track is locked$/,
  },
  {
    caso: "se cuelga en el tercer plano",
    herramienta: "convertToMain",
    vez: 3,
    falla: { tipo: "cuelga" },
    mensaje: "Edits dejó de contestar al poner el plano 3 en la pista principal. Fijate que siga abierto y probá de nuevo.",
    detalle: /^Detalle: convertToMain quedó sin respuesta: pasaron 0\.5 segundos$/,
  },
  {
    caso: "contesta HTML al poner un texto",
    herramienta: "addText",
    falla: { tipo: "http", estado: 200, tipoDeContenido: "text/html", cuerpo: "<html>Edits</html>" },
    mensaje: 'No entendí lo que contestó Edits al poner el texto "HOLA / PRUEBA". Avisale a quien te instaló la app.',
    detalle: /^Detalle: En la respuesta de addText, .*<html>/,
  },
];

for (const { caso, herramienta, vez, falla, mensaje, detalle } of FALLAS) {
  test(`si Edits ${caso}, el error dice qué paso no se pudo hacer`, async (t) => {
    const falso = await conEditsFalso(t, PLAN_DE_TRES_PLANOS);
    falso.fallar(herramienta, falla, vez);
    if (falla.tipo === "cuelga") {
      process.env.EDITS_ESPERA = "0.5";
      t.after(() => delete process.env.EDITS_ESPERA);
    }
    const lineas: string[] = [];

    await assert.rejects(
      mandarAEdits(p, (l) => lineas.push(l)),
      (e) => {
        assert.ok(e instanceof ErrorReel, `tenía que ser un ErrorReel y fue ${e}`);
        assert.equal(e.message, mensaje);
        return true;
      },
    );

    assert.match(lineas.at(-1) ?? "", detalle);
    assert.ok(!existsSync(archivoEdits(p)), "no tenía que anotar el proyecto como armado");
  });
}

test("en la terminal, una falla de Edits sale en una línea, sin stack trace y con código de salida 1", async (t) => {
  const falso = await conEditsFalso(t, PLAN_DE_TRES_PLANOS);
  falso.fallar("convertToMain", rechazo("the main track is locked"), 3);

  const corrida = promisify(execFile)(process.execPath, ["--import", "tsx", "src/cli.ts", "edits", p.raiz], { cwd: RAIZ_REPO, env: process.env });

  await assert.rejects(corrida, (e: { code?: number; stdout?: string; stderr?: string }) => {
    assert.equal(e.code, 1);
    assert.match(e.stderr ?? "", /^Edits no pudo poner el plano 3 en la pista principal\.$/m);
    assert.doesNotMatch(e.stderr ?? "", /^\s+at /m, "no tenía que mostrar un stack trace");
    assert.match(e.stdout ?? "", /Plano 2\/3\nDetalle: Edits contestó a convertToMain: the main track is locked\n$/);
    return true;
  });
});
