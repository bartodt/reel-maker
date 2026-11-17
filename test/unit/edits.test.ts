import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test, type TestContext } from "node:test";
import { Edits, ErrorDeEdits } from "../../src/lib/edits.js";
import { ErrorReel } from "../../src/lib/errores.js";
import { EditsFalso, puertoDe, type Falla, type OpcionesDeEditsFalso } from "../lib/edits-falso.js";

const QUE = "poner el plano 3 en la pista principal";

async function abrirFalso(t: TestContext, opciones: OpcionesDeEditsFalso = {}) {
  const falso = await EditsFalso.abrir({ duracion: () => 10, ...opciones });
  t.after(() => falso.cerrar());
  return falso;
}

async function conProyecto(t: TestContext, opciones: OpcionesDeEditsFalso = {}) {
  const falso = await abrirFalso(t, opciones);
  const edits = new Edits(falso.clave, falso.url);
  await edits.conectar();
  const proyecto = await edits.proyectoNuevo();
  await assert.rejects(edits.importar("/videos/uno.mp4"), /no pudo cargar uno\.mp4/);
  const alias = await edits.importar("/videos/uno.mp4");
  return { falso, edits, proyecto, alias };
}

const conDatos = (datos: unknown): Falla => ({ tipo: "resultado", resultado: { content: [{ type: "text", text: JSON.stringify(datos) }] } });

const RESPUESTAS_MALAS: { caso: string; falla: Falla; motivo: RegExp }[] = [
  { caso: "sin added", falla: conDatos({ ok: true }), motivo: /"added"/ },
  { caso: "con dos agregados cuando se pidió uno", falla: conDatos({ added: [{}, {}] }), motivo: /"added"/ },
  { caso: "con un id que no es un texto", falla: conDatos({ added: [{ id: 7, trackId: "pista", start: 0 }] }), motivo: /"id"/ },
  { caso: "con isError", falla: { tipo: "resultado", resultado: { isError: true, content: [{ type: "text", text: "the track is locked" }] } }, motivo: /the track is locked/ },
  { caso: "con ok: false", falla: conDatos({ ok: false, error: "no space left" }), motivo: /no space left/ },
  { caso: "que no es un resultado de herramienta", falla: { tipo: "resultado", resultado: "listo" }, motivo: /listo/ },
  { caso: "con los eventos cortados", falla: { tipo: "eventos-cortados" }, motivo: /resultado/ },
  { caso: "con HTTP 500", falla: { tipo: "http", estado: 500, tipoDeContenido: "text/plain", cuerpo: "Internal Server Error" }, motivo: /500/ },
  { caso: "con HTML en vez de JSON", falla: { tipo: "http", estado: 200, tipoDeContenido: "text/html", cuerpo: "<html>Edits</html>" }, motivo: /<html>/ },
  {
    caso: "con un error del protocolo",
    falla: { tipo: "http", estado: 200, tipoDeContenido: "application/json", cuerpo: '{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"Invalid params"}}' },
    motivo: /Invalid params/,
  },
];

for (const { caso, falla, motivo } of RESPUESTAS_MALAS) {
  test(`una respuesta ${caso} da un ErrorReel que dice qué paso falló`, async (t) => {
    const { falso, edits, alias } = await conProyecto(t);
    falso.fallar("addMediaPanelItemsToTimeline", falla);

    await assert.rejects(edits.agregarALaLinea({ alias, desde: 0, hasta: 1, inicio: 0, superpuesto: true }, QUE), (e) => {
      assert.ok(e instanceof ErrorReel, `tenía que ser un ErrorReel y fue ${e}`);
      assert.ok(e instanceof ErrorDeEdits);
      assert.ok(e.message.includes(QUE), e.message);
      assert.ok(e.motivo.includes("addMediaPanelItemsToTimeline"), e.motivo);
      assert.match(e.motivo, motivo);
      return true;
    });
  });
}

test("si Edits crea el proyecto pero no lo abre, el detalle guarda el id que mandó junto con el error", async (t) => {
  const falso = await abrirFalso(t);
  const edits = new Edits(falso.clave, falso.url);
  await edits.conectar();
  // Así contestó Edits real con la Mac muy cargada
  const dicho = { id: "65A9A844-BDC7-4A85-8747-D5256D1C40B1", screen: "loading", error: "project was created but the editor did not open it" };
  falso.fallar("newProject", { tipo: "resultado", resultado: { isError: true, content: [{ type: "text", text: JSON.stringify(dicho) }] } });

  await assert.rejects(edits.proyectoNuevo(), (e) => {
    assert.ok(e instanceof ErrorDeEdits);
    assert.equal(e.message, "Edits no pudo crear el proyecto.");
    assert.match(e.motivo, /project was created but the editor did not open it/);
    assert.match(e.motivo, /65A9A844-BDC7-4A85-8747-D5256D1C40B1/);
    return true;
  });
});

for (const { caso, falla, motivo } of [
  { caso: "no contesta nunca", falla: { tipo: "cuelga" }, motivo: /pasaron 0\.2 segundos/ },
  { caso: "corta la conexión", falla: { tipo: "corta" }, motivo: /convertToMain quedó sin respuesta/ },
] satisfies { caso: string; falla: Falla; motivo: RegExp }[]) {
  test(`si Edits ${caso}, el error dice en qué paso quedó`, async (t) => {
    const falso = await abrirFalso(t);
    const edits = new Edits(falso.clave, falso.url, 0.2);
    await edits.conectar();
    await edits.proyectoNuevo();
    await edits.importar("/videos/uno.mp4").catch(() => {});
    const { id } = await edits.agregarALaLinea({ alias: await edits.importar("/videos/uno.mp4"), desde: 0, hasta: 1, inicio: 0, superpuesto: true }, QUE);
    falso.fallar("convertToMain", falla);

    await assert.rejects(edits.pasarAPrincipal(id, QUE), (e) => {
      assert.ok(e instanceof ErrorDeEdits);
      assert.equal(e.message, "Edits dejó de contestar al poner el plano 3 en la pista principal. Fijate que siga abierto y probá de nuevo.");
      assert.match(e.motivo, motivo);
      return true;
    });
    assert.equal(falso.abierto?.elementos[0].trackType, "video", "Edits llegó a hacerlo, aunque la respuesta no llegó");
  });
}

test("en la pantalla de inicio las herramientas del editor fallan, y una pantalla que no conozco también", async (t) => {
  const falso = await abrirFalso(t);
  const edits = new Edits(falso.clave, falso.url);
  await edits.conectar();
  assert.equal(await edits.pantalla(), "inicio");

  await assert.rejects(edits.titulo(), (e) => e instanceof ErrorDeEdits && /unknown tool \(not in current manifest\): title/.test(e.motivo));
  falso.fallar("appState", conDatos({ ok: true, screen: "export" }));
  await assert.rejects(edits.pantalla(), (e) => e instanceof ErrorDeEdits && /No entendí/.test(e.message) && /"export"/.test(e.motivo));
});

test("el mensaje para la creadora no nombra la herramienta ni lo que contestó Edits", async (t) => {
  const { falso, edits, alias } = await conProyecto(t);
  falso.fallar("addMediaPanelItemsToTimeline", { tipo: "rechazo", motivo: "sourceOut is past the source end (9.99s)" });

  await assert.rejects(edits.agregarALaLinea({ alias, desde: 0, hasta: 1, inicio: 0 }, QUE), (e) => {
    assert.ok(e instanceof ErrorDeEdits);
    assert.equal(e.message, "Edits no pudo poner el plano 3 en la pista principal.");
    assert.match(e.motivo, /sourceOut is past the source end/);
    return true;
  });
});

test("si Edits deja de contestar en el medio, el error dice en qué paso", async (t) => {
  const { falso, edits } = await conProyecto(t);
  await falso.cerrar();

  await assert.rejects(edits.guardarProyecto(), (e) => e instanceof ErrorReel && /dejó de contestar al guardar el proyecto/.test(e.message));
});

test("con una clave que Edits no acepta, pide copiarla de nuevo", async (t) => {
  const falso = await abrirFalso(t);

  await assert.rejects(new Edits("otra-clave", falso.url).conectar(), (e) => e instanceof ErrorReel && /no aceptó la clave/.test(e.message));
});

test("si no hay nadie en esa dirección, pide abrir Edits", async (t) => {
  const falso = await abrirFalso(t);
  const { clave, url } = falso;
  await falso.cerrar();

  await assert.rejects(new Edits(clave, url).conectar(), (e) => e instanceof ErrorReel && /No pude conectarme con Edits/.test(e.message));
});

test("si en esa dirección contesta otra cosa que no es Edits, pide abrir Edits", async (t) => {
  const otro = createServer((_, respuesta) => respuesta.writeHead(200, { "Content-Type": "text/html" }).end("<html>Otra app</html>"));
  await new Promise<void>((listo) => otro.listen(0, "127.0.0.1", listo));
  t.after(() => otro.close());

  const url = `http://127.0.0.1:${puertoDe(otro)}/mcp`;
  await assert.rejects(new Edits("clave", url).conectar(), (e) => e instanceof ErrorReel && /No pude conectarme con Edits/.test(e.message));
});

test("un plano agregado, acelerado y pasado a la pista principal queda en Edits como se pidió", async (t) => {
  const { edits, alias } = await conProyecto(t);

  const plano = await edits.agregarALaLinea({ alias, desde: 2, hasta: 6, inicio: 0, superpuesto: true }, QUE);
  await edits.cambiarVelocidad(plano.id, 2, QUE);
  const principal = await edits.pasarAPrincipal(plano.id, QUE);
  await edits.cambiarVolumen(plano.id, 0, QUE);

  assert.equal(await edits.finDeLaPista(principal, QUE), 2, "4 segundos de clip al doble de velocidad son 2");
  assert.deepEqual(await edits.elementos(), [
    {
      id: plano.id,
      trackId: principal,
      trackType: "video",
      content: "video",
      startTime: 0,
      endTime: 2,
      sourceInPoint: 2,
      sourceOutPoint: 6,
      speed: 2,
      volume: 0,
      text: undefined,
      animation: undefined,
    },
  ]);
});

test("la voz va toda a la misma pista y dice dónde quedó cada pedazo", async (t) => {
  const { falso, edits } = await conProyecto(t);
  const voz = await edits.importar("/audios/voz-limpia.wav");

  const uno = await edits.agregarALaLinea({ alias: voz, desde: 0, hasta: 2.5, inicio: 1 }, "poner la voz");
  const dos = await edits.agregarALaLinea({ alias: voz, desde: 2.5, hasta: 6, inicio: 5, pista: uno.pista }, "poner la voz");

  assert.equal(dos.pista, uno.pista);
  assert.deepEqual([uno.inicio, dos.inicio], [1, 5]);
  assert.deepEqual(
    falso.abierto?.elementos.map((e) => [e.trackType, e.content, e.startTime, e.endTime, e.sourceInPoint, e.sourceOutPoint]),
    [
      ["audio", "music", 1, 3.5, 0, 2.5],
      ["audio", "music", 5, 8.5, 2.5, 6],
    ],
  );
});

test("un texto se puede mover y animar, y una imagen se recorta al largo pedido", async (t) => {
  const { falso, edits } = await conProyecto(t, { textosAlCursor: [1] });
  const que = 'poner el texto "HOLA"';

  const texto = await edits.agregarTexto({ texto: "HOLA", inicio: 4, duracion: 1.5 }, que);
  assert.equal(texto.inicio, 0, "Edits lo dejó donde estaba el cursor y lo dijo");
  await edits.mover(texto.id, 4, que);
  await edits.estiloDeTexto(texto.id, { tamano: 38, negrita: true, color: "#FFFFFF", alineacion: "center" }, que);
  await edits.posicionDeTexto(texto.id, { x: 0.5, y: 0.25 }, que);
  await edits.animacionDeTexto(texto.id, "fadeIn", que);

  const logo = await edits.agregarImagen({ ruta: "/imagenes/logo.png", inicio: 8.5, x: 0.5, y: 0.5, escala: 0.6 }, "poner el logo");
  const { inicio, duracion } = await edits.elemento(logo, "poner el logo");
  await edits.recortarFinal(logo, duracion - 1, "poner el logo");

  assert.equal(inicio, 8.5);
  assert.deepEqual(
    falso.abierto?.elementos.map((e) => [e.content, e.startTime, e.endTime, e.text, e.animation]),
    [
      ["text", 4, 5.5, "HOLA", "fadeIn"],
      ["photo", 8.5, 9.5, undefined, undefined],
    ],
  );
});

test("los subtítulos se leen, se corrigen y se borran de a uno", async (t) => {
  const { falso, edits } = await conProyecto(t, {
    subtitulos: [
      { text: "Ola", startTime: 0, endTime: 1 },
      { text: "ruido", startTime: 1, endTime: 2 },
      { text: "chau", startTime: 2, endTime: 3 },
    ],
  });

  await edits.generarSubtitulos("es");
  const [hola, ruido] = await edits.subtitulos();
  assert.deepEqual({ ...hola, id: "" }, { id: "", text: "Ola", startTime: 0, endTime: 1 });
  await edits.corregirSubtitulo(hola.id, "Hola.");
  await edits.borrarSubtitulo(ruido.id);
  await edits.estiloDeSubtitulos("Short Hard Cut");

  assert.deepEqual(
    (await edits.subtitulos()).map((s) => s.text),
    ["Hola", "chau"],
    "Edits esconde el punto final de un subtítulo",
  );
  assert.equal(falso.abierto?.estiloDeSubtitulos, "Short Hard Cut");
});

test("la línea de tiempo se lee entera aunque Edits la conteste en varias páginas", async (t) => {
  const { edits } = await conProyecto(t);
  for (let i = 0; i < 205; i++) await edits.agregarTexto({ texto: `texto ${i}`, inicio: i, duracion: 1 }, QUE);

  const elementos = await edits.elementos();

  assert.equal(elementos.length, 205);
  assert.equal(elementos.at(-1)?.text, "texto 204");
});

test("si las páginas de la línea de tiempo no avanzan, corta con un error en vez de seguir pidiendo", async (t) => {
  const { falso, edits } = await conProyecto(t);
  falso.fallar("elements", conDatos({ elements: [], nextOffset: 0 }));

  await assert.rejects(edits.elementos(), (e) => e instanceof ErrorReel && /leer la línea de tiempo/.test(e.message));
});

test("el proyecto se puede nombrar, guardar, cerrar y borrar, y un cuadro llega como JPEG", async (t) => {
  const { falso, edits, proyecto } = await conProyecto(t, { listadosAtrasados: 1 });

  assert.equal(await edits.pantalla(), "editor");
  await edits.ponerTitulo("prueba-reel");
  assert.equal(await edits.titulo(), "prueba-reel");
  const cuadro = await edits.cuadro(1.5);
  assert.deepEqual([...cuadro.subarray(0, 2)], [0xff, 0xd8], "un JPEG empieza con FF D8");
  await edits.guardarProyecto();
  assert.equal(falso.abierto?.guardado, true);
  assert.deepEqual(await edits.proyectos(), [{ id: proyecto, nombre: "prueba-reel" }]);

  assert.equal(await edits.cerrarProyecto(), proyecto);
  assert.equal(await edits.pantalla(), "inicio");
  assert.equal(await edits.cerrarProyecto(), undefined, "ya no había nada abierto");
  await edits.borrarProyecto(proyecto);

  assert.deepEqual(await edits.proyectos(), [{ id: proyecto, nombre: "prueba-reel" }], "la lista de Edits tarda en ponerse al día");
  assert.deepEqual(await edits.proyectos(), []);
  assert.deepEqual(falso.proyectos, []);
});
