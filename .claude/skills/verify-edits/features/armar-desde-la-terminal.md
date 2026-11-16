# Armar el reel desde la terminal

`npm run edits -- <carpeta>` arma en Edits el reel que dice `edit/plan.json`: cada plano en la pista principal, en orden y con su velocidad, la voz en off en pedazos, los textos grandes, el logo y los subtítulos. Termina con el proyecto guardado y abierto en Edits.

## Sub-features

- `armar-planos` pone los planos en la pista principal, en el orden del plan.
- `armar-voz` pone la voz limpia en pedazos, con un hueco donde habla alguien del clip.
- `armar-textos` pone cada texto grande donde lo pide el plan, con su animación.
- `armar-logo` pone el logo sobre el cierre congelado.
- `armar-carpeta` copia el material a `~/Movies/reel-maker/<carpeta>` o a `EDITS_CARPETA`.

## How to get to it (user POV)

- `npm run edits -- <carpeta del reel>` desde la raíz del repo.
- `npm run reel -- edits <carpeta del reel>` hace lo mismo.

## Driving it with verify-edits

Preconditions:

- El punto de partida del [mapa](./README.md), con la copia `prueba-pyc`.
- `npm run verificar-edits -- --revisar` imprime `Edits responde`.

- **Armar.** Corré `/usr/bin/time -p npm run edits -- ~/reels/_verificacion/<tu-id>/prueba-pyc`. Imprime `Copiando el material para Edits`, `Proyecto nuevo en Edits: prueba-pyc`, `Plano 1/19` hasta `Plano 19/19`, `Poniendo la voz`, `Poniendo los textos`, `Escribiendo los subtítulos` y `Proyecto guardado en Edits: "prueba-pyc".`, en unos 40 a 60 segundos.
- **Comparar con el plan.** Con el proyecto abierto, leé `elements` (todas las páginas, `limit` 200) y `captions`, y pasalos por `diferenciasConEdits(armarMontaje(plan), elementos, captions, palabras, plan.tramos)` de `src/lib/montaje.ts`. Tiene que dar una lista vacía.
- **Mirar.** `frameSheet` con `times` en el medio de cada plano (`0.48,1.55,2.89,4.52,5.97,7.78,9.26,10.1,11.3,12.5,13.92,15.92,18.73,21.2,22.77,28.7,34.18,36.3,40.15`), `columns` 7 y `cellWidth` 200. Se ven los 19 planos en el orden del plan, "El Pancho y la Coca" al principio, "SÁCATE LAS GANAS" sobre el chico, los dos textos de promos y "LOGO" sobre el tren congelado.
- **Escuchar.** `playFromStart`, `sampleOutputLevel` con `seconds` 8 y `pause`. `nonSilentSamples` es mayor que 0.
- **Otra carpeta.** Borrá `~/Movies/reel-maker/prueba-pyc` si existe y corré `EDITS_CARPETA=/Users/bartodt/Movies/prueba-<tu-id> npm run edits -- <copia>`. Los videos, `voz-limpia.wav`, `logo.png` y `congelado-19.jpg` quedan en `~/Movies/prueba-<tu-id>/prueba-pyc/`, `~/Movies/reel-maker/` no cambia y `getMediaPanelItems` no tiene nada con `isOffline: true`.
- **Prueba.** Guardá la salida de la terminal, la hoja de `frameSheet` y el resultado de la comparación.

## Gotchas

- Edits tiene que estar en la pantalla de inicio. Si no, el comando lo dice y no copia nada.
- El comando deja el proyecto abierto en Edits. Cerralo y borralo por id antes de la siguiente prueba (Cleanup en SKILL.md).
- La primera vez que se copia el material tarda más (unos 300 MB). Las siguientes saltean los archivos que ya están iguales.
- `EDITS_CARPETA` fuera de `~/Movies` hace que Edits no pueda abrir los archivos.
