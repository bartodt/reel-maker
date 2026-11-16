# Casa Giro: edición real reconstruida

Sacada del final (`WhatsApp Video 2026-11-11 at 4.31.23 PM.mp4`, 44,5 s) con `npm run reconstruir` sobre los crudos de `~/reels/hola-luli/clips` (52 videos), y revisada a mano.
Los cortes los detecta ffmpeg (`scdet`, umbral 10) y salen iguales a los del primer prototipo. Cada plano se encontró en un crudo con un parecido de 0,94 a 1,00, menos el plano 1 (0,57), que se revisó a ojo y con el audio del clip.
Los tiempos son sobre el final. "Desde" es el segundo del clip donde arranca el plano.
`storyboard.jpg` tiene un par de cuadros por plano, de la mitad del plano: el final a la izquierda y el clip elegido a la derecha, con el número y el parecido.

| # | Final | Dura | Clip | Desde | Vel. | Qué se ve | Qué se dice | Texto en pantalla |
|---|---|---|---|---|---|---|---|---|
| 1 | 0,0–2,4 | 2,4 | IMG_6427 | 0,0 | 1,1x | Ella a cámara, caminando por la vereda | Besis, hoy vine a conocer Casa Giro. | "CASA GIRO" (desde 1,5) |
| 2 | 2,4–9,0 | 6,5 | IMG_6385 | 5,1 | 1x y **2x** desde 4,7 | Abre la puerta del balcón y, ya acelerado, muestra la calle | Sobre la calle General Pirán en Martínez… pensado para trabajar, crear y encontrarse. | ídem hasta 4,1. "UN ESPACIO PARA TUS IDEAS" desde 7,5 |
| 3 | 9,0–14,7 | 5,8 | IMG_6379 | 0,0 | **1,5x** | Recorrido: sala con sillones, una habitación, la barra de la cocina, el comedor | ¿Tenés una idea dando vueltas hace tiempo? ¿Un taller…? Capaz que llegó el momento de hacerlo realidad. | ídem hasta 10,0 |
| 4 | 14,7–16,6 | 1,9 | IMG_6381 | 1,5 | 1x | Consultorio con escritorio y biblioteca | Acá podés atender a tus pacientes, trabajar, | "CONSULTORIOS Y OFICINAS" (desde 15,5) |
| 5 | 16,6–17,6 | 1,0 | IMG_6388 | 1,9 | 1x | Oficina con escritorio de vidrio | organizar reuniones o | ídem |
| 6 | 17,6–19,1 | 1,4 | IMG_6376 | 0,0 | 1x | La mesa larga del salón, con flores | dar talleres y capacitaciones para | ídem hasta 18,2 |
| 7 | 19,1–20,5 | 1,4 | IMG_6377 | 2,3 | 1x | El salón con la tele | grupos de hasta catorce personas. | "TALLERES Y CAPACITACIONES 14 personas" (desde 18,8) |
| 8 | 20,5–21,9 | 1,4 | IMG_6400 | 0,0 | 1,5x | La cocina: mesada y ventana | Además, cuenta con cocina, | ídem |
| 9 | 21,9–22,7 | 0,8 | IMG_6406 | 0,0 | 1x | Hornallas y pileta, de cerca | vajilla, tele | ídem |
| 10 | 22,7–24,6 | 1,9 | IMG_6395 | 0,0 | **1,8x** | La tele de presentaciones | para presentaciones y una estación de café, | |
| 11 | 24,6–29,2 | 4,7 | IMG_6391 | 0,0 | **2x** | La estación de café ("A cup of coffee") | té y mate sin costo adicional. Y algo que me parece superpráctico es que no necesitás alquilar por | "DESDE $15.000 LA HORA" (desde 27,3) |
| 12 | 29,2–31,6 | 2,4 | IMG_6387 | 5,2 | 1x | La oficina del plano 5, desde otro lado | períodos largos. Podés reservar por una hora o por módulos | ídem hasta 30,9 |
| 13 | 31,6–33,0 | 1,4 | IMG_6383 | 0,0 | 1x | Consultorio con escritorio blanco y placard | según lo que necesites. No | |
| 14 | 33,0–37,8 | 4,8 | IMG_6401 | 2,0 | **2,9x** | Sale por la puerta de la cocina al patio interno | solo esto, sino que además el lugar cuenta con un patio interno… una parrillita. Así que | |
| 15 | 37,8–39,1 | 1,3 | IMG_6408 | 3,2 | 1x | Ella con dos personas en el salón, se ríen | si tenés una idea en mente, | |
| 16 | 39,1–40,3 | 1,2 | IMG_6411 | 0,3 | 1x | Una mano con stickers de "hacé que pase" | animate a hacer que pase. | |
| 17 | 40,3–43,5 | 3,2 | IMG_6414 | 0,0 | 1x | El frente del edificio; una chica saluda en la puerta | Consultá disponibilidad en @casagiro.martinez | "📍 General Pirán 120 1A" (desde 40,8) |
| 18 | 43,5–44,5 | 1,0 | IMG_6421 | 2,9 | 1x | Ella saluda en la vereda | (termina la voz) | Logo de Somos San Isidro (desde 43,5) |

## Números

- 18 planos en 44,5 s: promedio 2,5 s, mitad de 1,66 s. Sin los cuatro recorridos acelerados (2, 3, 11 y 14), los planos duran entre 0,8 y 3,2 s, con promedio de 1,6 s.
- Se usaron 18 de los 52 videos, cada uno una sola vez.
- Siete planos van acelerados, entre 1,1x y 2,9x. Los recorridos largos (balcón, ambientes, café y patio) van a 1,5x o más para mostrar todo el lugar en pocos segundos.
- El plano 2 cambia de velocidad sin cortar: abre la puerta a velocidad normal y en el segundo 4,7 la misma toma pasa a 2x. En `plan-real.json` son dos tramos seguidos del mismo clip, porque cada tramo tiene una sola velocidad. `reconstruir` lo marca para revisar a mano: el principio del plano no coincide con la velocidad del medio.
- Nueve planos arrancan en el segundo 0 del clip: casi no recorta el principio de las tomas.
- La voz no para: no hay gancho ni cierre sin voz. El plano 1 es ella hablando a cámara, y esa frase es parte de la voz.
- Hay seis textos grandes y el logo al final. Los textos aparecen letra por letra cuando se nombra lo que muestran y cruzan los cortes.

## Dónde caen los cortes

Medido contra las palabras de `transcripcion.json` (segundos de la voz limpia):

- 5 de 17 cortes caen al empezar una frase, entre 0,1 y 0,3 s antes ("Sobre la calle", "¿Tenés una idea", "Acá podés", "Además", "Consultá").
- 6 cortes siguen una enumeración, una cosa por plano: "organizar reuniones", "dar talleres", "grupos de hasta catorce", "vajilla", "tele para presentaciones" y "té y mate".
- 6 cortes caen en medio de una frase, sobre una palabra: "períodos", "según", "No solo esto", "si tenés", "animate" y "@casagiro".

## Planos que `reconstruir` marca para revisar

- Plano 1: la selfie se mueve mucho y el texto le tapa la cara, así que el parecido baja. La velocidad sale del audio del clip: la frase dura 2,1 s en el clip y 1,94 s en el final, o sea 1,1x.
- Plano 2: cambia de velocidad sin cortar (ver Números).
- Plano 18: la velocidad está bien. Las puntas bajan porque al final aparece el logo encima.

## Lo que no hay en este plan

- `plan-real.json` está sobre la voz limpia, que acá es el audio del final (`voz.mpeg`). Limpiar sacó 0,26 s de silencio al principio y 0,38 s al final, así que el plan dura 43,9 s y no tiene esos pedazos.
- La flecha y el texto de la dirección del plano 17 llevan un 📍 que el plan no tiene.
- Cada texto va en los tramos donde se ve medio segundo o más. En el final cruzan los cortes y duran menos que esos tramos.

## Alternativas

Otros clips que muestran lo mismo, anotados en `plan-real.json`. Cada una la propuso `reconstruir` o se ve en `alternativas.jpg`: el cuadro del final, el del clip elegido y el cuadro más parecido del otro clip, con su parecido.

- Plano 8: IMG_6401 empieza en la misma cocina, con la misma mesada y ventana (`reconstruir` la da con 0,95 de parecido contra 0,98).
- Plano 17: IMG_6416 muestra el mismo frente desde la calle (`reconstruir` la da con 0,85 contra 0,94).
- Plano 11: IMG_6392 (0,79) e IMG_6393 (0,76) muestran la misma estación de café: los mismos termos, frascos, azucarera rosa y cuadro de "A cup of coffee", con otro encuadre. `reconstruir` no las propone porque pide que el otro clip quede a 0,1 o menos del elegido.
- Planos 5 y 12: IMG_6388 e IMG_6387 son la misma oficina, con el mismo escritorio de vidrio, la silla y los dos cuadros. Una la muestra de cerca y la otra desde la puerta (0,67 y 0,66).

Los planos 6 y 7 no tienen alternativa. Son el mismo salón, pero el 6 mira hacia el espejo rojo y el 7 hacia la tele, y ningún cuadro de un clip se parece al del otro plano (0,04 y 0,22).
