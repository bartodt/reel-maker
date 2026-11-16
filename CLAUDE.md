# reel-maker

Herramienta de línea de comandos que arma reels verticales (1080x1920, 30 fps) a partir de clips crudos y una voz en off grabada aparte.
Para USAR la herramienta sobre una carpeta de videos está la skill `.claude/skills/reel/SKILL.md`. Este archivo es para TRABAJAR SOBRE EL CÓDIGO.

## Comandos

- `npm run ui`: abre la app (servidor local en http://localhost:4321 + navegador). Es como la usa la creadora de contenido.
- `npm run reel -- <paso> <carpeta>`: corre un paso (limpiar, transcribir, inventario, validar, render, edits)
- `npm run comparar -- <carpeta> <referencia.json>`: compara el plan de una carpeta con una edición hecha a mano (ver `referencias/README.md`)
- `npm run typecheck`: chequeo de tipos
- `npm test`: tests rápidos (lógica pura y validación del plan)
- `npm run test:e2e`: render completo con material generado por ffmpeg (tarda ~1 minuto)
- `npm run check`: todo lo anterior. Correlo antes de dar por terminado un cambio.

## Cómo está organizado

- `src/cli.ts`: lee los argumentos, carga `.env` y llama al paso.
- `src/pasos/`: un archivo por paso. Cada uno exporta una función `async (proyecto, log)`.
- `src/lib/`: piezas reutilizables. La lógica pura (sin ffmpeg ni red) va acá y lleva test en `test/unit/`:
  `voz.ts` (qué partes de la voz conservar), `transcripcion.ts` (frases), `subtitulos.ts` (archivo .ass con subtítulos y textos grandes), `encuadre.ts` (recorte), `plan.ts` (formato y validación de plan.json), `linea.ts` (dónde cae cada tramo en el reel, qué audio suena, cuándo aparece cada palabra de los textos), `capturas.ts` (momentos de las capturas del inventario), `montaje.ts` (qué va en la línea de tiempo de Edits y cómo corregir sus subtítulos), `comparar.ts` (plan contra edición de referencia), `paralelo.ts` (correr cosas de a varias).
  Para la app: `edicion.ts` (cambios al plan: cambiar un plano, mover un corte, partir, sacar), `estado.ts` (en qué paso está un reel), `nombres.ts` (nombres de carpetas y archivos subidos), `actividad.ts` (traduce lo que hace Claude a frases simples).
- `src/ui/`: la app. `servidor.ts` (rutas, sin dependencias: `node:http`), `reels.ts` (leer y guardar cosas de un reel), `trabajos.ts` (lo que tarda corre en segundo plano: preparar, render y `claude -p`), `cuadros.ts` (miniaturas en `edit/miniaturas/`), `iniciar.ts` (entrada de `npm run ui`).
  `src/ui/web/`: la página, en JavaScript sin compilar (módulos ES). `cortes.js` es el storyboard y el editor de cada plano.
- `src/lib/edits.ts`: habla con Edits para Mac (su servidor MCP en 127.0.0.1:19501, clave `EDITS_TOKEN`). `src/pasos/edits.ts` arma el reel ahí.
- `src/lib/ffmpeg.ts`: todo lo que llama a ffmpeg/ffprobe pasa por acá (`info` guarda lo que ya leyó mientras el archivo no cambie). `src/lib/vad.ts`: el detector de voz (Silero).
- `src/config.ts`: valores ajustables (tamaños, silencios, subtítulos, textos, logo, ritmos, capturas, música).
- `referencias/`: ediciones reales del usuario para probar la herramienta (los crudos no están en el repo).
- `test/lib/fixtures.ts`: arma un proyecto de prueba en una carpeta temporal, sin red.

## Reglas

- Textos para el usuario (logs, errores, README) en español rioplatense, simple y sin tecnicismos.
- Errores esperados (falta un archivo, plan mal armado) se tiran con `ErrorReel`; la CLI los muestra sin stack trace. Nada de `process.exit` fuera de `cli.ts`.
- Si agregás un campo a `plan.json`, actualizá en el mismo cambio: el tipo en `src/lib/plan.ts`, su validación, su test, la skill, el README y, si se puede tocar a mano, el editor de la app (`src/lib/edicion.ts` y `src/ui/web/cortes.js`).
- La app es para alguien que no programa: textos cortos, sin nombres de campos ni de archivos internos, y todo cambio al plan se puede deshacer (`guardarVersion` antes de escribir).
- El servidor de la app solo escucha en esta compu y rechaza pedidos de otros sitios (revisa el `Host` y pide el encabezado `x-reel` para cambiar algo). No lo saques.
- Los tiempos de los tramos con voz (`desde`/`hasta`) son siempre sobre la voz limpia, no sobre la voz original. Los tramos sin voz tienen `duracion` y empujan la voz para adelante; para pasar un segundo de la voz al reel terminado está `vozAReel` en `linea.ts`.
- Nunca modificar ni borrar archivos dentro de `clips/` de un proyecto.
- El paso `transcribir` se probó contra la API real de ElevenLabs (noviembre 2026). Si lo tocás, volvé a probarlo con una clave real.
- Cuando la app llama a Claude (`pedirAClaude` en `src/ui/trabajos.ts`), le da permiso solo para leer, escribir dentro de `edit/` del reel y en `estilo.md`, y correr `npm run validar`. Si cambiás el prompt o los permisos, probalo con la sesión de Claude iniciada.

- Edits: el material se copia a `~/Movies/reel-maker/` (Edits está en sandbox y solo lee Películas). Los planos se agregan de a uno, al final y en orden, y se pasan a la pista principal con `convertToMain`: hacerlo de a varios o en el medio los deja en otra pista. Probalo con Edits abierto antes de dar por bueno un cambio en `src/pasos/edits.ts`.

## Pendientes

Ver `docs/ideas.md`.
