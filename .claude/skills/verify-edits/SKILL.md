---
name: verify-edits
description: Prueba sobre Edits para Mac real (su servidor de automatización en 127.0.0.1:19501) que reel-maker arma bien un reel ahí. Usala antes de dar por bueno un cambio en src/pasos/edits.ts, src/lib/edits.ts o src/lib/montaje.ts, cuando un armado en Edits falla o queda distinto al plan, o cuando pidan "probar Edits", "verificar Edits" o verify-edits.
---

# Verificar el armado en Edits

Edits es la app de la creadora, en esta Mac, y hay una sola. Lo que hagas acá aparece en su pantalla y en su lista de proyectos. Leé las reglas antes de la primera llamada.

## Reglas

- **Un agente por vez.** `npm run verificar-edits` toma el candado `~/.reel-maker-edits.lock` solo, espera si lo tiene otro y lo suelta al terminar. No lo tomes antes de correrlo, porque se queda esperando su propio candado. Para todo lo demás que toque Edits (`npm run edits` sobre una copia, la app, las herramientas `mcp__metapilot-native__*`), tomalo vos: `mkdir ~/.reel-maker-edits.lock && echo "<quién sos> $(date)" > ~/.reel-maker-edits.lock/dueno`. Si `mkdir` falla, otro agente está usando Edits. Esperá y probá de nuevo cada 30 segundos, sin borrar el candado ajeno. Soltalo con `rm -rf ~/.reel-maker-edits.lock` apenas dejás de usar Edits, también si algo falló.
- **Solo borrás lo tuyo.** Un proyecto se borra solo si lo creaste vos en esta prueba y su título empieza con `prueba-`. Nunca borres ni cambies otros proyectos (por ejemplo "Prueba reel-maker: Pancho y Coca" o "Example project"). Borrá siempre por id, nunca por un título parecido.
- **Copias, no originales.** Trabajá sobre copias en `~/reels/_verificacion/<tu-id>/`, con `clips` como enlace. Nunca escribas dentro de `clips/`, en `~/reels/pancho-y-coca-prueba` ni en `~/Downloads`.
- **Al terminar**, Edits queda en la pantalla de inicio y `projects` no lista ningún proyecto tuyo.

## Launch

Edits no se abre desde acá. Tiene que estar abierto y con el servidor prendido en Edits › Ajustes › Automation. Si no responde, avisale al operador. No cierres ni reinicies Edits.

Preparar la terminal (Node 22 y ffmpeg-full; el Node y el ffmpeg de siempre de esta Mac no sirven):

```bash
export PATH=/opt/homebrew/opt/ffmpeg-full/bin:/Users/bartodt/.nvm/versions/node/v22.23.4/bin:$PATH
```

En un worktree nuevo, corré `npm ci` y `cp /Users/bartodt/reel-maker/.env .` (ahí está `EDITS_TOKEN`). Nunca imprimas la clave.

## Doctor

```bash
npm run verificar-edits -- --revisar
```

Solo lee. Imprime `Edits responde` si Edits contesta, acepta la clave y está en la pantalla de inicio. Si no, dice en español qué falta (abrir Edits, copiar de nuevo la clave o volver al inicio) y sale con código 1. Con las herramientas `mcp__metapilot-native__*` cargadas, `appState` (tiene que decir `"screen": "home"`) y `projects` dan lo mismo.

## Drive

La prueba completa es un comando:

```bash
npm run verificar-edits
```

Tarda unos 30 segundos. Arma con el material de Pancho y Coca un reel chico de 7 planos (gancho con texto, alguien del clip hablando, una velocidad y un cierre congelado con logo) en `~/reels/_verificacion/verificar-edits/prueba-<fecha>/`. Lo manda a Edits por el mismo camino que `npm run edits`. Después compara la línea de tiempo de Edits (`elements` y `captions`) con lo que pide el plan (`diferenciasConEdits` de `src/lib/montaje.ts`), guarda tres cuadros y borra el proyecto de prueba. Sale bien cuando imprime esto, una línea por plano, y termina con código de salida 0:

```
Edits responde
Copiando el material para Edits
Proyecto nuevo en Edits: prueba-<fecha>
Plano 1/7
...
Plano 7/7
Poniendo la voz
Poniendo los textos
Escribiendo los subtítulos
Proyecto guardado en Edits: "prueba-<fecha>".
Coincide con el plan
Cuadros en edit/verificacion/ (<ruta>)
Proyecto de prueba borrado
```

Si algo no coincide, imprime `No coincide con el plan:` con una línea por diferencia, igual borra el proyecto y sale con código 1.

Para probar otra cosa (el reel completo, la app, una falla), seguí el archivo que corresponda en [features/](features/README.md).

## Evidence

- La salida de `verificar-edits` y los cuadros `cuadro-<n>-<segundo>s.jpg` en `~/reels/_verificacion/verificar-edits/prueba-<fecha>/edit/verificacion/`. Esa carpeta queda después de borrar el proyecto.
- Para ver un proyecto armado, `frameSheet` (sin `id` ni `path`, con `times` en el medio de cada plano) devuelve una hoja de cuadros del render de Edits. Guardá la imagen que viene en la respuesta de la herramienta. No copies el PNG de la ruta que informa. Está dentro del contenedor de Edits, macOS pide permiso y el comando queda colgado.
- `screencapture` no muestra la ventana de Edits cuando está en otro escritorio. Para pruebas visuales usá `captureFrame` o `frameSheet`.
- Una salida de la terminal se pasa a imagen con `qlmanage -t -s 1400 -o <carpeta> <archivo.txt>`.

## Cleanup

- `verificar-edits` cierra su proyecto, lo borra por id y borra su copia en `~/Movies/reel-maker/prueba-<fecha>`, también cuando falla en el medio. Los cuadros quedan. Si en Edits queda un proyecto nuevo que no reconoce, lo nombra con su id y sale con código 1, sin decir `Proyecto de prueba borrado`.
- Si armaste un reel con `npm run edits` sobre una copia, Edits queda con ese proyecto abierto. Cerralo (`closeProject`, que devuelve `closedProjectId`) y borrá ese id con `deleteProject`. Volvé a mirar `projects` hasta que dos veces seguidas no aparezca. La lista tarda en ponerse al día y un proyecto recién borrado puede volver.
- Borrá las copias de material que creaste en `~/Movies` (`~/Movies/reel-maker/prueba-*` o la carpeta de `EDITS_CARPETA`). Nunca `~/Movies/reel-maker/pancho-y-coca`.
- Soltá el candado.

## Helpers

- `scripts/verificar-edits.ts`, con `npm run verificar-edits` (prueba completa) y `npm run verificar-edits -- --revisar` (solo mirar).
- `EDITS_URL` cambia a qué servidor habla (sirve para simular que Edits no está, por ejemplo `EDITS_URL=http://127.0.0.1:19599/mcp`).
- `EDITS_CARPETA` cambia dónde se copia el material. Tiene que quedar dentro de `~/Movies`, porque Edits no puede leer afuera.

## Gotchas

- Si Edits deja de contestar en el medio, la terminal dice "No pude conectarme con Edits" aunque Edits siga abierto. Pasó una vez en 10 armados. Un pedido quedó colgado 2,5 minutos y después las herramientas de Edits volvieron solas. Esperá, mirá `appState` y, si quedó abierto un proyecto `prueba-` a medias, cerralo y borralo por id antes de reintentar.
- `seek` a veces falla con "playhead did not reach". El armado no lo usa.
- Los subtítulos salen de `edit/transcripcion.json`. Si la transcripción escribe mal un nombre, el subtítulo también (en Pancho y Coca dice "Pancho & Co.").
