# reel-maker

Arma un reel vertical para Instagram (1080x1920, 30 fps) a partir de varios clips crudos y una voz en off grabada aparte.

La voz manda: se le cortan los silencios, se transcribe, y los clips se acomodan encima según un plan de cortes (`plan.json`). También se pueden meter partes sin voz en off: un gancho al principio, alguien hablando a cámara con su propio audio, o un cierre con el logo. Ese plan lo puede escribir Claude Code con la skill incluida, o lo podés escribir a mano.

## Qué necesitás

- Node.js 22 (está en `.nvmrc`)
- ffmpeg con soporte de subtítulos (libass) y de texto (freetype). En Mac, el `ffmpeg` común de Homebrew no los trae: instalá `ffmpeg-full` y hacé que se use ese en vez del común.
  ```bash
  brew install ffmpeg-full
  echo 'export PATH="$(brew --prefix ffmpeg-full)/bin:$PATH"' >> ~/.zshrc
  ```
  Abrí una terminal nueva y chequeá: `ffmpeg -hide_banner -filters | grep -E " (ass|drawtext) "` tiene que mostrar dos líneas.
- Una clave de ElevenLabs para transcribir

## Instalación

```bash
npm install
cp .env.example .env   # y pegá tu ELEVENLABS_API_KEY
npm run check          # chequea que todo ande (tarda ~1 minuto)
```

## La app (sin terminal)

```bash
npm run ui
```

Se abre sola en el navegador (http://localhost:4321). Ahí creás un reel, subís los videos y la voz, y la app te lleva en cuatro pasos:

1. **Material**: arrastrás los videos, la voz en off y, si querés, música, logo y guion.
2. **Preparar**: la app saca los silencios, escribe lo que decís y mira cada video.
3. **Cortes**: Claude arma los cortes y los ves como un storyboard. Para cambiar algo, se lo pedís a Claude con tus palabras. Todo se puede deshacer. Los retoques plano por plano se hacen en Edits.
4. **Tu reel**: lo armás en Edits (la app de Instagram para Mac) para retocarlo y publicarlo desde ahí, o lo creás acá como video, lo mirás y lo descargás.

- Los reels se guardan en `~/reels/` (se cambia en `APP` de `src/config.ts`).
- Para que Claude arme los cortes desde la app, Claude Code tiene que estar instalado y con la sesión iniciada: abrí la Terminal, escribí `claude` y seguí los pasos (una sola vez).
- La clave de ElevenLabs se puede cargar desde la app (se guarda en `.env`).
- Para armarlo en Edits: abrí Edits en la Mac, en Ajustes › Automation prendé el servidor de automatización y pegá su clave en la app la primera vez. Edits tiene que estar en su pantalla de inicio. El material se copia a `~/Movies/reel-maker/`, porque Edits solo puede abrir archivos de la carpeta Películas.
- Para cerrarla, apretá Ctrl+C en la terminal donde la abriste.

## Cómo preparar un reel

Armá una carpeta así (puede estar en cualquier lado, fuera del repo):

```
playa/
  clips/        tus videos crudos
  voz.wav       tu voz en off (también sirve .mp3 o .m4a)
  guion.md      opcional, el guion (ayuda a Claude con los nombres y con las frases que dice alguien a cámara)
  musica.mp3    opcional
  logo.png      opcional, para el cierre
```

Tips:
- Nombrar los clips con lo que muestran (`playa-atardecer.mp4`, `cafe-mesa.mov`) ayuda a elegir mejor.
- Si el logo es siempre el mismo, ponelo una sola vez en `recursos/logo.png` del repo (mejor con fondo transparente).
- En el guion, las frases que dice alguien a cámara van así: `Persona que dice: ¡sácate las ganas!`.

## Uso con Claude Code

Abrí Claude Code en la raíz de este repo y pedile algo como:

> armá un reel con la carpeta ~/reels/playa

La skill está en `.claude/skills/reel/SKILL.md`. Claude corre los pasos, mira las capturas, te pregunta el ritmo, arma el plan, te lo muestra y espera tu OK antes de renderizar.
Tu forma de editar está en `.claude/skills/reel/estilo.md`: Claude lo lee antes de armar cada plan. Si algo no te gusta, corregilo ahí.

## Uso a mano

```bash
npm run limpiar     -- ~/reels/playa   # 1. corta silencios de la voz (Silero VAD)
npm run transcribir -- ~/reels/playa   # 2. transcribe (ElevenLabs Scribe)
npm run inventario  -- ~/reels/playa   # 3. info y capturas de cada clip
# 4. escribí ~/reels/playa/edit/plan.json
npm run validar     -- ~/reels/playa   # 5. revisa el plan
npm run render      -- ~/reels/playa   # 6. genera edit/final.mp4
npm run edits       -- ~/reels/playa   # 6 (otra opción). lo arma en Edits para Mac
```

### Formato del plan

Los tramos van en el orden en que se ven:

```json
{
  "ritmo": "tranquilo",
  "tramos": [
    { "duracion": 1,  "clip": "playa.mp4",  "arrancaEn": 3,   "texto": "UN DÍA\nEN LA PLAYA", "nota": "Gancho, antes de la voz" },
    { "desde": 0,     "hasta": 2.6, "clip": "playa.mp4", "arrancaEn": 1.0, "encuadre": "izquierda", "nota": "Hoy les muestro..." },
    { "duracion": 1.5, "clip": "amiga.mov", "arrancaEn": 4,   "audioDelClip": true, "nota": "Ella dice: ¡qué lindo!" },
    { "desde": 2.6,   "hasta": 5.1, "clip": "cafe.mov",  "arrancaEn": 0.5, "velocidad": 2 },
    { "duracion": 3,  "clip": "cafe.mov",   "arrancaEn": 4,   "velocidad": 0, "logo": true, "nota": "Cierre" }
  ]
}
```

- `ritmo` (opcional): `"rapido"`, `"normal"` o `"tranquilo"`. Si los planos no siguen ese ritmo, `validar` te avisa.
- `subtitulos` (opcional): `false` arma el reel sin subtítulos (los textos grandes siguen saliendo). Si no está, lleva subtítulos. En la app es el interruptor "Con subtítulos" de "Tu reel".
- Tramo **con voz**: `desde` / `hasta` son segundos sobre la voz limpia (los que aparecen en `edit/transcripcion.md`). Los tramos con voz tienen que ir pegados entre sí y cubrir toda la voz.
- Tramo **sin voz**: `duracion` en segundos. La voz en off espera mientras tanto; solo suena la música, o el clip si tiene `audioDelClip`.
- `clip`: nombre del archivo dentro de `clips/`.
- `arrancaEn`: desde qué segundo del clip se toma la imagen.
- `encuadre` (opcional): hacia dónde recortar si el clip no es vertical. `"izquierda"`, `"centro"`, `"derecha"` (o `"arriba"` / `"abajo"`), o un número de 0 a 1. Por defecto, centro.
- `velocidad` (opcional): 1 normal, 2 el doble de rápido, 0.5 cámara lenta, 0 imagen congelada.
- `audioDelClip` (opcional, solo sin voz): se escucha el audio del clip, por ejemplo alguien hablando a cámara.
- `texto` (opcional): texto grande arriba, que aparece palabra por palabra mientras se dice. `\n` corta la línea.
- `logo` (opcional): muestra el logo en el centro.
- `npm run validar` te avisa si algo no cierra.

## Qué se genera en `edit/`

| Archivo | Qué es |
|---|---|
| `voz-limpia.wav` | Tu voz sin silencios largos |
| `voz-cortes.json` | Qué partes de la voz original se conservaron |
| `transcripcion.json` / `.md` | Texto con el tiempo de cada palabra |
| `inventario.json` | Datos y descripción de cada clip |
| `capturas/` | Una grilla por clip, con una captura por segundo (más o menos) y el segundo escrito |
| `plan.json` | El plan de cortes |
| `subtitulos.ass` | Subtítulos y textos grandes generados |
| `final.mp4` | El reel terminado |
| `final-plan.json` | El plan con el que se creó `final.mp4` (la app lo usa para saber si cambiaste algo después) |
| `edits.json` | Con qué nombre y cuándo se armó en Edits |
| `historial/` | Versiones anteriores del plan, para deshacer desde la app |
| `miniaturas/` | Cuadros sueltos de los videos que muestra la app |
| `anteriores/` | La voz, música o logo que reemplazaste desde la app |
| `quitados/` | Los videos que sacaste desde la app (para recuperar uno, volvé a ponerlo en `clips/`) |

## Ajustes

Todo está en `src/config.ts`: tamaño de video, cuánto silencio cortar, estilo de subtítulos (palabras por bloque, fuente, tamaño, altura), textos grandes, tamaño del logo, qué duración de plano corresponde a cada ritmo, capturas del inventario, volumen de la música y cuánto baja cuando hablás.

## Trabajar sobre el código

- `npm run ui` abre la app; el código está en `src/ui/` (servidor en TypeScript, página en `src/ui/web/` sin herramientas de compilación).
- `CLAUDE.md` explica cómo está organizado el código y las reglas para cambiarlo (Claude Code lo lee solo).
- `docs/ideas.md` tiene los pendientes y mejoras para ir iterando.
- `npm test` corre los tests rápidos; `npm run test:e2e` hace un render completo con material de prueba; `npm run check` corre todo.
- `referencias/` tiene reels que editaste a mano, para probar si la herramienta edita parecido. `npm run comparar -- <carpeta> referencias/pancho-y-coca/plan-real.json` compara el `plan.json` de una carpeta con tu edición. `npm run reconstruir -- <carpeta> <final.mp4>` arma una referencia nueva a partir de un reel ya publicado. `npm run medir -- <carpeta de la corrida>` compara de una vez un plan por referencia y da una tabla con el promedio. `npm run corrida-a-ciegas -- <carpeta de la corrida>` arma la corrida, le pide cada plan a un Claude que no vio tus ediciones y la mide. Cómo correr la prueba completa y cómo armar la corrida: `referencias/README.md`. Dónde está hoy la herramienta: `referencias/linea-de-base.md`.
- Hay un workflow de GitHub Actions (`.github/workflows/ci.yml`) que corre `npm run check` en cada push y pull request.
