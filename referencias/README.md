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
`alternativas.jpg` muestra por qué valen las alternativas que no propuso `reconstruir` (ver `edicion.md`). `logo.png` es el logo de Somos San Isidro que aparece en el último plano. La carpeta del reel no lo tiene, y sin él `npm run validar` da error por el `"logo"` del plan.

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
3. Mirá el storyboard y revisá los planos que dicen "revisalo a mano": tienen parecido bajo, necesitan más clip del que hay, o sus puntas no siguen la velocidad del medio. Lo segundo pasa cuando la misma toma cambia de velocidad sin cortar (el balcón de Casa Giro). Ahí partí el tramo en dos. Si las dos partes se ven muy parecidas puede no marcarse, como en la caminata de Pancho y Coca.
4. Copiá el borrador a `referencias/<reel>/plan-real.json` y sumale los textos grandes, el logo y las notas. Las `alternativas` que propone `reconstruir` quedan. Sumá otra solo si un par de cuadros, el del final y el del otro clip, muestra lo mismo: guardalo en `referencias/<reel>/` y explicá en `edicion.md` por qué vale. Si no, `comparar` cuenta como acierto un clip que no muestra lo mismo. Escribí `edicion.md` con la misma tabla que las otras referencias.
5. Si el plan usa el logo y la carpeta no lo tiene, guardalo en `referencias/<reel>/logo.png`.

Tarda unos dos minutos con 52 clips en 4K: casi todo es leer los videos.

## Cómo correr una prueba

Cada referencia sale de una carpeta que ya tiene la voz limpia y la transcripción, así que no hace falta volver a llamar a ElevenLabs:

| | Pancho y Coca | Casa Giro |
|---|---|---|
| Carpeta original | `~/reels/pancho-y-coca-prueba` | `~/reels/hola-luli` |
| Voz | `voz.wav` | `voz.mpeg` |
| Logo | `~/reels/pancho-y-coca-prueba/referencia/logo.png` (dice "LOGO") | `referencias/casa-giro/logo.png` |
| Plan real | `referencias/pancho-y-coca/plan-real.json` | `referencias/casa-giro/plan-real.json` |

1. Armá una carpeta nueva, fuera de la original, con un enlace `clips` a los `clips` de la original, una copia de la voz y del logo (como `logo.png`) y, dentro de `edit/`, copias de `voz-limpia.wav`, `voz-cortes.json`, `transcripcion.json` y `transcripcion.md` del `edit/` de la original. No escribas nada en la carpeta original.
2. Para ver que la referencia está bien armada, copiá el plan real a `edit/plan.json` y corré `npm run validar -- <carpeta>`. Tiene que decir "Plan OK", sin errores.
3. `npm run inventario -- <carpeta>`.
4. Pedile a un agente nuevo, que no haya visto la edición real, que arme el plan con la skill. Sin leer `referencias/`, sin ver el video final y con ritmo `"tranquilo"`, que es el que eligió el usuario.
   Ojo: `estilo.md` salió en parte de Pancho y Coca. Para que la prueba sea justa, dale una copia sin sus ejemplos (hay una en `~/reels/pancho-y-coca-prueba/b-con-estilo/estilo.md`).
5. `npm run comparar -- <carpeta> <plan real>`.
6. Anotá el resultado en `referencias/<reel>/prueba-N.md`.

Como hay dos reels de referencia con crudos, los números sirven para ver si un cambio ayuda, no como nota final.
