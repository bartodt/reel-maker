# Referencias

Reels que el usuario editó a mano. Sirven para probar si la herramienta edita parecido y si cada cambio la acerca o la aleja.

## Pancho y Coca (`pancho-y-coca/`)

| Archivo | Qué es |
|---|---|
| `guion.md` | El guion original |
| `edicion.md` | La edición real reconstruida plano por plano |
| `storyboard.jpg` | Un cuadro de cada plano de la edición real |
| `plan-real.json` | La edición real como `plan.json`, sobre la voz limpia de la prueba. Cada tramo puede tener `alternativas`: otros clips que muestran lo mismo |
| `prueba-N.md` / `.jpg` | Resultados de cada prueba |

Lo que no está en el repo:
- Los crudos: `~/Downloads/1 influencer` (28 videos y 30 fotos).
- La carpeta de prueba: `~/reels/pancho-y-coca-prueba`. Tiene la voz ya aislada (`voz.wav`, sin la frase del chico), la voz limpia y la transcripción. No hace falta volver a llamar a ElevenLabs.
- `~/reels/pancho-y-coca-prueba/referencia/` tiene `plan-real.json` renderizado con la herramienta, para comparar con el video original.

## Cómo correr una prueba

1. Armá una carpeta nueva dentro de `~/reels/pancho-y-coca-prueba/` con un enlace `clips` a los crudos, `voz.wav` y, dentro de `edit/`, `voz-limpia.wav`, `voz-cortes.json`, `transcripcion.json` y `transcripcion.md` (copiados de `~/reels/pancho-y-coca-prueba/edit/`).
2. `npm run inventario -- <carpeta>`.
3. Pedile a un agente nuevo, que no haya visto la edición real, que arme el plan con la skill. Sin leer `referencias/`, sin ver el video final y con ritmo `"tranquilo"`, que es el que eligió el usuario.
   Ojo: `estilo.md` salió en parte de este mismo reel. Para que la prueba sea justa, dale una copia sin los ejemplos de Pancho y Coca (hay una en `~/reels/pancho-y-coca-prueba/b-con-estilo/estilo.md`).
4. `npm run comparar -- <carpeta> referencias/pancho-y-coca/plan-real.json`.
5. Anotá el resultado en `pancho-y-coca/prueba-N.md`.

Como hay un solo reel de referencia con crudos, los números sirven para ver si un cambio ayuda, no como nota final.
