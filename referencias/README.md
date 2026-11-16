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

## Casa Giro (`casa-giro/`)

`edicion.md`, `storyboard.jpg` y `plan-real.json`, como en Pancho y Coca. Acá `storyboard.jpg` muestra cada plano del final al lado del clip que se encontró. El guion está en la carpeta del reel.

Lo que no está en el repo:
- La carpeta del reel: `~/reels/hola-luli`, con los 52 crudos en `clips/`, la voz y lo que ya sacó la herramienta en `edit/`.
- El final publicado: `~/Downloads/WhatsApp Video 2026-11-11 at 4.31.23 PM.mp4`.
- Ojo: `voz.mpeg` es el audio del final, no la voz que grabó aparte. Trae la voz ya editada por ella y la frase que dice a cámara en el plano 1, así que un plan armado sobre esta voz arranca con ventaja.

## Cómo armar una referencia nueva

1. Armá la carpeta del reel con `clips/` y la voz, y corré `npm run limpiar -- <carpeta>`.
2. `npm run reconstruir -- <carpeta> <final.mp4>`. Encuentra los cortes del final, busca cada plano en los clips y escribe en `edit/`:
   - `reconstruccion.json`: por plano, el clip, desde qué segundo, la velocidad, el parecido (de 0 a 1), el clip que le sigue, las alternativas y si hay que revisarlo.
   - `storyboard.jpg`: el final a la izquierda y el clip elegido a la derecha, de a un par por plano.
   - `plan-reconstruido.json`: si la voz de la carpeta es el audio del final, el borrador del plan sobre la voz limpia.
3. Mirá el storyboard y revisá los planos que dicen "revisalo a mano": tienen parecido bajo, o sus puntas no siguen la velocidad del medio. Lo segundo pasa cuando la misma toma cambia de velocidad sin cortar (el balcón de Casa Giro). Ahí partí el tramo en dos. Si las dos partes se ven muy parecidas puede no marcarse, como en la caminata de Pancho y Coca.
4. Copiá el borrador a `referencias/<reel>/plan-real.json` y sumale los textos grandes, el logo, las notas y las alternativas que veas. Escribí `edicion.md` con la misma tabla que las otras referencias.

Tarda unos dos minutos con 52 clips en 4K: casi todo es leer los videos.

## Cómo correr una prueba

1. Armá una carpeta nueva dentro de `~/reels/pancho-y-coca-prueba/` con un enlace `clips` a los crudos, `voz.wav` y, dentro de `edit/`, `voz-limpia.wav`, `voz-cortes.json`, `transcripcion.json` y `transcripcion.md` (copiados de `~/reels/pancho-y-coca-prueba/edit/`).
2. `npm run inventario -- <carpeta>`.
3. Pedile a un agente nuevo, que no haya visto la edición real, que arme el plan con la skill. Sin leer `referencias/`, sin ver el video final y con ritmo `"tranquilo"`, que es el que eligió el usuario.
   Ojo: `estilo.md` salió en parte de este mismo reel. Para que la prueba sea justa, dale una copia sin los ejemplos de Pancho y Coca (hay una en `~/reels/pancho-y-coca-prueba/b-con-estilo/estilo.md`).
4. `npm run comparar -- <carpeta> referencias/pancho-y-coca/plan-real.json`.
5. Anotá el resultado en `pancho-y-coca/prueba-N.md`.

Para Casa Giro es igual, con la carpeta `~/reels/hola-luli` y `referencias/casa-giro/plan-real.json`.

Como hay dos reels de referencia con crudos, los números sirven para ver si un cambio ayuda, no como nota final.

## Cómo medir contra todas las referencias

`referencias.json` lista las referencias que tienen crudos: el nombre, la carpeta del reel con el material y su `plan-real.json`.

1. Armá una carpeta para la corrida con una carpeta por referencia, con el mismo nombre que en `referencias.json`. En cada una va el plan a medir, en `edit/plan.json`:
   ```
   corrida/
     pancho-y-coca/edit/plan.json
     casa-giro/edit/plan.json
   ```
   Cada una puede ser la carpeta de una prueba (pasos 1 a 3 de arriba). Para ver que anda, copiá cada `plan-real.json` como `edit/plan.json`: da 100% en todo.
2. `npm run medir -- <carpeta de la corrida>`.

Muestra una fila por referencia y una de promedio, y guarda lo mismo en `medicion.json`, dentro de la corrida (de 0 a 1). Una referencia sin plan sale "sin plan" y no cuenta en el promedio. Las columnas son:

- Mismo contenido, mismo clip y mismo momento: las tres de `comparar`, sobre el tiempo de voz.
- Cortes: de todos los cortes, los de la referencia y los del plan juntos, qué parte forma pareja con uno del otro lado a menos de 0,3 s. Cada corte entra en una sola pareja, así que baja si faltan cortes y también si sobran. Solo cuenta cuando cambia la toma: partir una toma para cambiarle la velocidad o el texto no es un corte. Así Casa Giro tiene 17 cortes, los mismos que se ven en el publicado, y Pancho y Coca 14.

`npm run comparar` también muestra la línea de cortes, con cuántas parejas hay y cuántos cortes tiene cada uno.
