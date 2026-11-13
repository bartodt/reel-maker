# reel-maker

Herramienta de línea de comandos que arma reels verticales (1080x1920, 30 fps) a partir de clips crudos y una voz en off grabada aparte.
Para USAR la herramienta sobre una carpeta de videos está la skill `.claude/skills/reel/SKILL.md`. Este archivo es para TRABAJAR SOBRE EL CÓDIGO.

## Comandos

- `npm run reel -- <paso> <carpeta>`: corre un paso (limpiar, transcribir, inventario, validar, render)
- `npm run typecheck`: chequeo de tipos
- `npm test`: tests rápidos (lógica pura y validación del plan)
- `npm run test:e2e`: render completo con material generado por ffmpeg (tarda ~1 minuto)
- `npm run check`: todo lo anterior. Correlo antes de dar por terminado un cambio.

## Cómo está organizado

- `src/cli.ts`: lee los argumentos, carga `.env` y llama al paso.
- `src/pasos/`: un archivo por paso. Cada uno exporta una función `async (proyecto, log)`.
- `src/lib/`: piezas reutilizables. La lógica pura (sin ffmpeg ni red) va acá y lleva test en `test/unit/`:
  `voz.ts` (qué partes de la voz conservar), `transcripcion.ts` (frases), `subtitulos.ts` (archivo .ass), `encuadre.ts` (recorte), `plan.ts` (formato y validación de plan.json).
- `src/lib/ffmpeg.ts`: todo lo que llama a ffmpeg/ffprobe pasa por acá.
- `src/config.ts`: valores ajustables (tamaños, silencios, subtítulos, música).
- `test/lib/fixtures.ts`: arma un proyecto de prueba en una carpeta temporal, sin red.

## Reglas

- Textos para el usuario (logs, errores, README) en español rioplatense, simple y sin tecnicismos.
- Errores esperados (falta un archivo, plan mal armado) se tiran con `ErrorReel`; la CLI los muestra sin stack trace. Nada de `process.exit` fuera de `cli.ts`.
- Si agregás un campo a `plan.json`, actualizá en el mismo cambio: el tipo en `src/lib/plan.ts`, su validación, su test, la skill y el README.
- Los tiempos del plan son siempre sobre la voz limpia, no sobre la voz original.
- Nunca modificar ni borrar archivos dentro de `clips/` de un proyecto.
- El paso `transcribir` todavía no se probó contra la API real de ElevenLabs. Si lo tocás, probalo con una clave real.

## Pendientes

Ver `docs/ideas.md`.
