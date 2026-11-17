# Fallas en el medio del armado

Si Edits falla mientras se arma el reel, la terminal y la app dicen qué paso no se pudo hacer, en español y sin nombres internos. El detalle técnico (la herramienta de Edits y lo que contestó) va aparte, para quien mantiene esto.

## Sub-features

- `falla-paso` nombra el paso que falló, por ejemplo "Edits no pudo poner el plano 3 en la pista principal.".
- `falla-archivo` nombra el archivo que Edits no pudo cargar.
- `falla-rara` avisa cuando Edits contesta algo que no se entiende, como HTML o una respuesta sin los datos esperados.
- `falla-colgado` avisa cuando Edits deja de contestar o corta la conexión, en vez de esperar para siempre.
- `falla-detalle` deja el detalle técnico en una línea `Detalle:` de la terminal y en "Ver detalle" de la app, no en el mensaje.

## How to get to it (user POV)

- `npm run edits -- <carpeta>` o el botón "Armarlo en Edits", con Edits fallando en el medio.

## Driving it with verify-edits

Estas pruebas usan el Edits falso (`test/lib/edits-falso.ts`). No tocan Edits real, así que van sin candado.

Preconditions:

- La copia `prueba-pyc` del [mapa](./README.md).
- Una carpeta vacía cualquiera para `EDITS_CARPETA`. El Edits falso lee los archivos de ahí, así que no hace falta que esté en `~/Movies`.

- **Prender el Edits falso.** Corré en segundo plano `npx tsx test/lib/edits-falso.ts --puerto 196NN --falla convertToMain@3`, con un puerto libre propio. Imprime qué poner en `EDITS_URL` y `EDITS_TOKEN`. Usá esas dos variables y `EDITS_CARPETA` delante de cada comando de abajo.
- **Un paso que falla.** `npm run edits -- ~/reels/_verificacion/<tu-id>/prueba-pyc`. Imprime `Plano 1/19`, `Plano 2/19`, `Detalle: Edits contestó a convertToMain: falla pedida al Edits falso` y `Edits no pudo poner el plano 3 en la pista principal.`, sin stack trace, y sale con código 1.
- **Un archivo que no carga.** Prendé el Edits falso con `--falla importToMediaPanel`. El mensaje es `Edits no pudo cargar IMG_0672.MOV.`.
- **Una respuesta que no se entiende.** Con `--falla addText --como html`, el mensaje es `No entendí lo que contestó Edits al poner el texto "El Pancho / y la Coca". Avisale a quien te instaló la app.`.
- **Edits colgado o sin conexión.** Con `--falla newProject --como cuelga` y `EDITS_ESPERA=5` delante de `npm run edits`, a los 5 segundos el mensaje es `Edits dejó de contestar al crear el proyecto. Fijate que siga abierto y probá de nuevo.`. Con `--como corta` sale el mismo mensaje enseguida.
- **Edits lento.** Con `--demora convertToMain@3:30`, el plano 3 tarda 30 segundos y el armado sigue hasta el final. En la app, la tarjeta se queda en "Plano 2 de 19" mientras espera y después avanza.
- **En la app.** Corré la app con las tres variables delante, como en [Armar el reel desde la app](./armar-desde-la-app.md), y elegí "Armarlo en Edits". La tarjeta muestra el mismo mensaje que la terminal. La línea `Detalle:` aparece solo al abrir "Ver detalle".
- **Prueba.** La salida de la terminal con su código de salida y la captura de la tarjeta de la app.

## Gotchas

- `--falla` sin `@<vez>` hace fallar todas las llamadas a esa herramienta. `--como` acepta `rechazo`, `html`, `500`, `cortado`, `vacio`, `cuelga` y `corta`.
- Sin `EDITS_ESPERA` el armado espera 180 segundos cada respuesta antes de dar a Edits por colgado.
- El Edits falso no escribe subtítulos salvo que un test se los dé, y no dibuja nada. No sirve para ver cómo queda un reel.
- Después de una falla, `edit/edits.json` no se escribe. En la app el botón sigue diciendo "Armarlo en Edits".
- Con Edits real, una falla deja el proyecto a medias abierto en Edits. Cerralo y borralo por id antes de reintentar (Cleanup en SKILL.md).
