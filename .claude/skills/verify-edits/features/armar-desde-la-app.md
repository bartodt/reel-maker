# Armar el reel desde la app

En la pantalla "Tu reel" de la app, el botón "Armarlo en Edits" arma el reel en Edits y muestra el avance plano por plano. Cuando termina, la tarjeta dice "Tu reel está en Edits" con el nombre del proyecto.

## Sub-features

- `app-boton` arranca el armado desde la tarjeta "Terminalo en Edits".
- `app-avance` muestra las etapas y "Plano N de M" mientras arma.
- `app-listo` avisa que terminó y cambia la tarjeta a "Tu reel está en Edits".

## How to get to it (user POV)

- Abrir la app, entrar al reel, paso 4 "Tu reel", botón "Armarlo en Edits".
- Si ya se armó antes, el mismo lugar dice "Armarlo de nuevo en Edits".

## Driving it with verify-edits

Preconditions:

- El punto de partida del [mapa](./README.md), con la copia `prueba-pyc`.
- Sin `edit/edits.json` en la copia, para que el botón diga "Armarlo en Edits" (`rm ~/reels/_verificacion/<tu-id>/prueba-pyc/edit/edits.json`, solo en tu copia).

- **Abrir la app.** Corré en segundo plano `REELS_DIR=/Users/bartodt/reels/_verificacion/<tu-id> PORT=43NN npx tsx src/ui/iniciar.ts --sin-abrir`, con un puerto libre propio. Imprime `La app está en http://localhost:43NN`. Abrí esa dirección en el navegador integrado.
- **Entrar al reel.** Elegí el link `prueba-pyc` (`#/reel/prueba-pyc`). La app pasa sola a `#/reel/prueba-pyc/reel` y muestra "Terminalo en Edits".
- **Armar.** Elegí el botón "Armarlo en Edits". El título cambia a "Armando tu reel en Edits", la etapa "Poner cada plano" avanza con "Plano 1 de 19" hasta "Plano 19 de 19" y después "Escribiendo y corrigiendo los subtítulos".
- **Terminar.** En un minuto más o menos aparece el aviso "¡Listo! Abrí Edits: está como "prueba-pyc"." y la tarjeta dice "Tu reel está en Edits".
- **Prueba.** Capturas del avance (con "Plano N de 19") y del final. En Edits, `state` dice `"title": "prueba-pyc"` y `"clipCount": 19`.

## Gotchas

- La app lee los reels de `REELS_DIR`. Sin esa variable usa `~/reels` y no ve las copias de `_verificacion`.
- Cerrá la app matando el proceso que lanzaste, no por nombre.
- En la última etapa la barra de avance queda en un valor viejo. Es de la app, no de Edits.
