---
name: reel
description: Arma un reel vertical de Instagram (1080x1920) a partir de una carpeta con clips crudos y una voz en off grabada aparte. Usala siempre que el usuario pida armar, editar o renderizar un reel, unir clips con una voz en off, o cambiar el plan de cortes de un reel, aunque no diga "reel" explícitamente (por ejemplo "armá el video de la carpeta playa").
---

# Armar un reel con voz en off

La voz manda: el reel dura lo que dura la voz (sin silencios) y los clips se acomodan encima.
Vos decidís (escribís `edit/plan.json`); los scripts hacen el trabajo pesado. Nunca edites ni borres nada dentro de `clips/`.

## Carpeta esperada

```
<carpeta>/
  clips/        videos crudos (.mp4, .mov, ...)
  voz.wav       voz en off (también .mp3, .m4a, ...)
  musica.mp3    opcional, música de fondo
  edit/         se genera solo
```

Si falta `clips/` o `voz.*`, avisale al usuario qué falta y frená.

Todos los comandos se corren desde la raíz de este repo, pasando la carpeta del reel.

## Pasos

### 1. Limpiar la voz
`npm run limpiar -- <carpeta>`
Detecta la voz con Silero VAD y corta los silencios. Genera `edit/voz-limpia.wav`.
Si dice que no detectó voz, sugerí bajar `VOZ.umbralVoz` en `src/config.ts`.

### 2. Transcribir
`npm run transcribir -- <carpeta>`
Usa ElevenLabs Scribe. Necesita `ELEVENLABS_API_KEY` en `.env`. Si falta, pedile al usuario que la cargue; no sigas sin ella.
Genera `edit/transcripcion.md` (frases con tiempos). Leelo entero.

### 3. Inventario de clips
`npm run inventario -- <carpeta>`
Genera `edit/inventario.json` y una imagen por clip en `edit/capturas/` (4 capturas en fila, tomadas al 10%, 35%, 60% y 85% del clip; los segundos exactos están en `momentosCaptura`).
Mirá cada imagen de `edit/capturas/` y completá el campo `descripcion` de cada clip en `inventario.json` con una frase concreta de lo que se ve. Si una descripción ya estaba escrita, respetala: puede haberla escrito el usuario. Si el nombre del archivo dice algo útil (por ejemplo `playa-atardecer.mp4`), usalo.

### 4. Plan de cortes
Escribí `edit/plan.json` con este formato:

```json
{
  "tramos": [
    { "desde": 0, "hasta": 2.6, "clip": "playa.mp4", "arrancaEn": 1.0, "encuadre": "izquierda", "nota": "Hoy les muestro un día en la playa" }
  ]
}
```

Reglas (las verifica `npm run validar -- <carpeta>`):
- `desde` y `hasta` son segundos sobre la VOZ LIMPIA (los de `transcripcion.md`).
- Los tramos van pegados: cada uno empieza donde termina el anterior. El primero en 0 y el último en la duración total de la voz.
- `arrancaEn` es el segundo del clip desde donde se toma la imagen. Tiene que alcanzar: `arrancaEn + (hasta - desde)` no puede pasar la duración del clip.
- `encuadre` (opcional): hacia dónde recortar cuando el clip no es vertical. En clips horizontales: `"izquierda"`, `"centro"` o `"derecha"`; en clips más altos que el reel: `"arriba"`, `"centro"` o `"abajo"`. También acepta un número de 0 a 1. Si no se pone, recorta al centro. Mirá las capturas: si lo importante está a un costado, usalo.
- `nota`: la frase que se dice en ese tramo, para que el usuario entienda el plan.

Criterio de edición por defecto (si el usuario pide otra cosa, manda lo que pida):
- Elegí el clip que mejor muestre lo que se está diciendo en ese momento.
- Cortá en los cambios de frase o en pausas, no en la mitad de una palabra.
- Evitá tramos de menos de 0,5 s y evitá repetir el mismo pedazo de un clip.
- Preferí partes del clip con movimiento o con el sujeto bien visible (fijate en las capturas).

Corré `npm run validar -- <carpeta>` y arreglá hasta que dé OK.

### 5. Mostrar el plan y esperar el OK
Mostrale al usuario el plan en una tabla corta (tiempo, clip, encuadre, qué se dice). No renderices hasta que lo apruebe.

### 6. Render
`npm run render -- <carpeta>`
Genera `edit/final.mp4`: 1080x1920, 30 fps, voz limpia, música con ducking si hay `musica.*`, y subtítulos quemados.
Después sacá 3 o 4 cuadros del final con ffmpeg (por ejemplo `ffmpeg -ss 2 -i edit/final.mp4 -frames:v 1 edit/revision-1.jpg`) y miralos: revisá que el encuadre no corte lo importante y que los subtítulos se lean. Contale al usuario lo que viste.

## Cambios después del primer render

- "Cambiá el clip del segundo X" → editá solo ese tramo en `plan.json`, validá y volvé a renderizar. No repitas los pasos 1 a 3.
- Subtítulos, música o tamaños → están en `src/config.ts`.
- Si el usuario cambia la voz, hay que empezar desde el paso 1.
