# Subtítulos corregidos

Edits escribe los subtítulos con su propio reconocimiento de voz, en español neutro ("puedes") y con errores en lo que dice alguien del clip. El armado los reescribe con las palabras de `edit/transcripcion.json` y borra los que caen donde habla alguien del clip.

## Sub-features

- `sub-voseo` cambia lo neutro por lo que dijo ella ("podés", "tenés").
- `sub-clip` no deja subtítulos donde habla alguien del clip.
- `sub-nombres` escribe los nombres como en la transcripción.

## How to get to it (user POV)

- Sale solo al armar un reel con `subtitulos` sin apagar en el plan, desde la terminal o desde la app.

## Driving it with verify-edits

Preconditions:

- Un reel armado en Edits con [Armar el reel desde la terminal](./armar-desde-la-terminal.md) y todavía abierto.

- **Leer.** `captions` da cada subtítulo con `text`, `startTime`, `endTime` y sus `tokens` (`originalText` es lo que entendió Edits y `editedText` lo que puso el armado).
- **Voseo.** En Pancho y Coca el segundo subtítulo es "un lugar donde podés comer rico, rápido y tenés un montón de aderezos". En sus tokens, `originalText` dice `puedes` y `tienes`, y `editedText` dice `podés` y `tenés`.
- **Alguien del clip.** Ningún subtítulo tiene su medio entre 3,65 y 5,40 s (habla el chico).
- **Nombres.** Compará con `edit/transcripcion.md`. "Martínez", "Eduardo Costa 2048" y "Preto" aparecen igual. Para fotos, `frameSheet` en `2.14,3.21,3.5,24.01,24.37,25.11,26.15` muestra esas palabras una por una.
- **Todo junto.** `diferenciasConEdits` no da ninguna línea que empiece con `Subtítulo`.

## Gotchas

- Edits saca el punto final de cada subtítulo. El armado ya los pide sin punto, así que "para elegir." queda "para elegir" y no cuenta como diferencia.
- Los subtítulos repiten los errores de la transcripción. En Pancho y Coca la transcripción dice "Pancho & Co." y el subtítulo también, aunque el nombre es "Pancho y Coca". Ese error es de `transcripcion.json`, no del armado.
- El estilo "Short Hard Cut" muestra una palabra por vez, así que una foto muestra una sola palabra.
