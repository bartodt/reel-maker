# Mapa de lo que se prueba en Edits

Cada archivo es una cosa que la creadora usa para llevar su reel a Edits, con cómo llegar, cómo probarla y qué muestra que anda. Leé primero las reglas de [SKILL.md](../SKILL.md): candado, solo proyectos `prueba-` tuyos, copias en `~/reels/_verificacion/`.

## Punto de partida

- Edits abierto, en la pantalla de inicio, con el servidor de Ajustes › Automation prendido. `npm run verificar-edits -- --revisar` imprime `Edits responde`.
- Terminal con Node 22 y ffmpeg-full (ver Launch en SKILL.md) y `.env` con `EDITS_TOKEN` en la raíz del repo.
- Una copia de Pancho y Coca en `~/reels/_verificacion/<tu-id>/prueba-pyc`. El nombre de la carpeta es el título del proyecto en Edits, así que tiene que empezar con `prueba-`:

```bash
D=~/reels/_verificacion/<tu-id>/prueba-pyc
mkdir -p $D/edit
ln -s "/Users/bartodt/Downloads/1 influencer" $D/clips
cp ~/reels/pancho-y-coca-prueba/voz.wav ~/reels/pancho-y-coca-prueba/referencia/logo.png $D/
for f in voz-limpia.wav voz-cortes.json transcripcion.json transcripcion.md inventario.json; do cp ~/reels/pancho-y-coca-prueba/edit/$f $D/edit/; done
cp referencias/pancho-y-coca/plan-real.json $D/edit/plan.json
```

## Cómo probar

- Cada prueba arranca del punto de partida y vuelve a él al terminar (Cleanup en SKILL.md).
- Probá lo que ve ella: la salida de la terminal, la app en el navegador, lo que hay en Edits. No alcanza con que el comando termine.
- Para mirar Edits sin cambiar nada: `appState`, `projects`, `state`, `elements`, `captions`, `captureFrame`, `frameSheet`.
- Anotá con cada prueba qué archivo de este mapa seguiste y por qué camino entraste.
- Si un camino no se pudo probar, decí qué comando corriste y qué faltaba. No lo cuentes como probado por otro camino.

## Cosas

- [Armar el reel desde la terminal](./armar-desde-la-terminal.md): `npm run edits` sobre un reel con plan.
- [Armar el reel desde la app](./armar-desde-la-app.md): el botón "Armarlo en Edits" y su avance.
- [Subtítulos corregidos](./subtitulos.md): los subtítulos de Edits reescritos con la transcripción.
- [Avisos cuando Edits no está listo](./avisos.md): Edits cerrado, clave mala, un proyecto abierto.
