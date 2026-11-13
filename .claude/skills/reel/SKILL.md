---
name: reel
description: Arma un reel vertical de Instagram (1080x1920) a partir de una carpeta con clips crudos y una voz en off grabada aparte. Usala siempre que el usuario pida armar, editar o renderizar un reel, unir clips con una voz en off, o cambiar el plan de cortes de un reel, aunque no diga "reel" explícitamente (por ejemplo "armá el video de la carpeta playa").
---

# Armar un reel con voz en off

La voz manda: los clips se acomodan encima de la voz (sin silencios). Además se pueden meter tramos sin voz: un gancho al principio, alguien del clip hablando con su propio audio, o un cierre con el logo.
Vos decidís (escribís `edit/plan.json`); los scripts hacen el trabajo pesado. Nunca edites ni borres nada dentro de `clips/`.

Antes de armar el plan, leé `estilo.md` (en esta misma carpeta): es el estilo de edición del usuario y manda sobre el criterio por defecto de abajo.

## Carpeta esperada

```
<carpeta>/
  clips/        videos crudos (.mp4, .mov, ...)
  voz.wav       voz en off (también .mp3, .m4a, ...)
  guion.md      opcional, el guion (también .txt)
  musica.mp3    opcional, música de fondo
  logo.png      opcional, para el cierre (si no está, se usa recursos/logo.png del repo)
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
Genera `edit/transcripcion.md` (frases con tiempos) y `edit/transcripcion.json` (el tiempo de cada palabra). Leé el `.md` entero; usá el `.json` para cortar justo al empezar una palabra.
Si hay guion, leelo también: la transcripción puede tener errores en los nombres (por ejemplo "Pancho & Co." en vez de "Pancho y Coca").

### 3. Inventario de clips
`npm run inventario -- <carpeta>`
Genera `edit/inventario.json` y una grilla por clip en `edit/capturas/`: más o menos una captura por segundo, cada una con su segundo escrito abajo (por ejemplo `3.5 s`). Si dice `· habla`, en ese momento alguien habla en el clip. Las partes con voz también están en el campo `conVoz` de cada clip.
Mirá cada grilla y completá el campo `descripcion` de cada clip en `inventario.json`, con tiempos de lo que pasa. Por ejemplo: `"0-3 s: apoyan la lata en el mostrador · 3-7 s: espera · 7-9 s: sirven la gaseosa en el vaso"`. Así después podés elegir el momento justo.
Si una descripción ya estaba escrita, respetala: puede haberla escrito el usuario. Si el nombre del archivo dice algo útil (por ejemplo `playa-atardecer.mp4`), usalo.

### 4. Plan de cortes

Si el usuario no dijo qué ritmo quiere, preguntale antes de armar el plan, con una sugerencia:
- `"rapido"`: planos de 0,5 a 1 s. Para guiones que enumeran muchas cosas (productos, lugares).
- `"normal"`: planos de 0,9 a 1,5 s.
- `"tranquilo"`: planos de 1,3 a 2,5 s. Para guiones con pocas cosas para mostrar.

Escribí `edit/plan.json`. Los tramos van en el orden en que se ven:

```json
{
  "ritmo": "tranquilo",
  "tramos": [
    { "duracion": 1, "clip": "pancho.mov", "arrancaEn": 3, "texto": "Lo de Pancho\ny Coca", "nota": "Gancho, antes de la voz" },
    { "desde": 0, "hasta": 1.2, "clip": "cartel.mov", "arrancaEn": 48, "nota": "En plena estación de Martínez" },
    { "desde": 1.2, "hasta": 2.7, "clip": "chico.mov", "arrancaEn": 7.3, "nota": "abrió Lo de Pancho y Coca" },
    { "duracion": 1.8, "clip": "chico.mov", "arrancaEn": 8.8, "audioDelClip": true, "texto": "SÁCATE\nLAS GANAS", "nota": "Lo dice el chico a cámara" },
    { "desde": 2.7, "hasta": 9.2, "clip": "promo.mov", "arrancaEn": 3, "texto": "2 PANCHOS\n+ GASEOSA\n$10.000", "nota": "dos panchos con gaseosa..." },
    { "desde": 9.2, "hasta": 19.6, "clip": "caminata.mov", "arrancaEn": 1.9, "velocidad": 4.9, "nota": "Están en Eduardo Costa 2048..." },
    { "duracion": 4, "clip": "tren.mov", "arrancaEn": 6.8, "velocidad": 0, "logo": true, "nota": "Cierre" }
  ]
}
```

Hay dos tipos de tramo:
- **Con voz** (`desde` y `hasta`): segundos sobre la VOZ LIMPIA (los de `transcripcion.md`). Mientras dura, suena la voz en off. Los tramos con voz van pegados entre sí: cada uno empieza donde termina el anterior con voz. El primero en 0 y el último en la duración total de la voz.
- **Sin voz** (`duracion`): se mete entre dos tramos con voz y la voz en off espera. Sirve para el gancho (antes del primer tramo con voz), el cierre (después del último) o para que hable alguien del clip (con `"audioDelClip": true`). Sin `audioDelClip` solo suena la música.

Campos de cada tramo:
- `clip` y `arrancaEn`: qué clip y desde qué segundo se toma la imagen. Tiene que alcanzar: `arrancaEn + duración del tramo × velocidad` no puede pasar la duración del clip.
- `encuadre` (opcional): hacia dónde recortar cuando el clip no es vertical. En clips horizontales: `"izquierda"`, `"centro"` o `"derecha"`; en clips más altos que el reel: `"arriba"`, `"centro"` o `"abajo"`. También acepta un número de 0 a 1. Si no se pone, recorta al centro.
- `velocidad` (opcional): 1 es normal, 2 el doble de rápido, 0.5 cámara lenta, 0 congela la imagen en `arrancaEn`. Para una caminata hasta el lugar, 4 o 5. Con `audioDelClip` tiene que ser 1.
- `audioDelClip` (opcional, solo en tramos sin voz): se escucha el clip. Buscá dónde habla la persona con `conVoz` del inventario y las capturas marcadas `· habla`.
- `texto` (opcional): texto grande arriba. Cada palabra aparece cuando se dice (los números con cifras también: "2" aparece con "dos"). Usá `\n` para cortar la línea. Si varios tramos seguidos tienen el mismo texto, queda fijo entre todos.
- `logo` (opcional): `true` muestra el logo en el centro, con un fundido. Necesita `logo.png` en la carpeta del reel o en `recursos/` del repo.
- `nota`: la frase que se dice en ese tramo, para que el usuario entienda el plan.

Si hay guion: cada línea que diga "Persona que dice: …" va como tramo sin voz con `audioDelClip`, en el lugar del guion donde aparece. Buscá el clip donde esa persona lo dice. Si no lo encontrás, preguntale al usuario.

Criterio de edición por defecto (manda `estilo.md`, y si el usuario pide otra cosa, manda lo que pida):
- Elegí el clip que mejor muestre lo que se está diciendo en ese momento.
- Cortá en los cambios de frase o en pausas, no en la mitad de una palabra.
- Evitá tramos de menos de 0,5 s y evitá repetir el mismo pedazo de un clip.
- Preferí partes del clip con movimiento o con el sujeto bien visible (fijate en las capturas).

Corré `npm run validar -- <carpeta>` y arreglá hasta que dé OK. Si avisa que el plano típico no sigue el ritmo, ajustá el plan.

### 5. Mostrar el plan y esperar el OK
Mostrale al usuario el plan en una tabla corta (tiempo, clip, qué se dice, y si va sin voz, con texto, con otra velocidad o con logo). No renderices hasta que lo apruebe.

### 6. Render
`npm run render -- <carpeta>`
Genera `edit/final.mp4`: 1080x1920, 30 fps, voz limpia, audio de los clips que lo usan, música con ducking si hay `musica.*`, subtítulos, textos grandes y logo.
Después sacá 3 o 4 cuadros del final con ffmpeg (por ejemplo `ffmpeg -ss 2 -i edit/final.mp4 -frames:v 1 edit/revision-1.jpg`) y miralos: revisá que el encuadre no corte lo importante y que los subtítulos y los textos se lean. Contale al usuario lo que viste.

## Cambios después del primer render

- "Cambiá el clip del segundo X" → editá solo ese tramo en `plan.json`, validá y volvé a renderizar. No repitas los pasos 1 a 3.
- Subtítulos, textos, logo, música o tamaños → están en `src/config.ts`.
- Si el usuario cambia la voz, hay que empezar desde el paso 1.
- Si el usuario corrige algo que tiene que ver con su forma de editar (no con este reel en particular), anotalo en `estilo.md`.
