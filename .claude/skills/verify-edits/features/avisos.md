# Avisos cuando Edits no está listo

Si Edits no está abierto, la clave no sirve o hay un proyecto abierto, el armado y `verificar-edits` lo dicen en español, sin detalles técnicos, y no dejan nada a medias.

## Sub-features

- `aviso-cerrado` pide abrir Edits y prender el servidor.
- `aviso-clave` pide copiar de nuevo la clave.
- `aviso-abierto` pide volver a la pantalla de inicio y no toca el proyecto abierto.

## How to get to it (user POV)

- Correr `npm run edits -- <carpeta>` o `npm run verificar-edits` sin que Edits esté listo.
- Apretar "Armarlo en Edits" en la app sin que Edits esté listo.

## Driving it with verify-edits

Preconditions:

- Edits abierto y en la pantalla de inicio, salvo donde se dice otra cosa.
- Anotá `projects` antes de empezar para comparar después.

- **Edits cerrado.** No cierres Edits. Simulalo con un puerto donde no escucha nadie: `EDITS_URL=http://127.0.0.1:19599/mcp npm run verificar-edits`. Imprime "No pude conectarme con Edits. Abrilo en la Mac y fijate que en Ajustes › Automation esté prendido el servidor de automatización." y sale con código 1. No aparece ninguna carpeta nueva en `~/reels/_verificacion/verificar-edits/`.
- **Clave mala.** `EDITS_TOKEN=x npm run verificar-edits`. Imprime "Edits no aceptó la clave. Copiala de nuevo de Edits › Ajustes › Automation." sin stack trace y sale con código 1.
- **Proyecto abierto.** Dejá abierto en Edits un proyecto `prueba-` tuyo (por ejemplo el que deja [Armar el reel desde la terminal](./armar-desde-la-terminal.md)) y anotá su `state`. Corré `npm run verificar-edits`. Imprime "En Edits hay un proyecto abierto. Volvé a la pantalla de inicio de Edits y probá de nuevo. La prueba no tocó nada." y sale con código 1. `state` da el mismo título, `clipCount` y `currentTime` que antes.
- **Prueba.** La salida de cada comando con su código de salida, y `projects` igual al de antes.

## Gotchas

- `.env` no pisa una variable que ya está en el entorno, por eso `EDITS_TOKEN=x` delante del comando alcanza.
- El caso "Edits cerrado" con Edits cerrado de verdad no se probó, para no cerrar la app de la creadora. El puerto sin servidor da el mismo error de conexión.
