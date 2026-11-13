# reel-maker

Arma un reel vertical para Instagram (1080x1920, 30 fps) a partir de varios clips crudos y una voz en off grabada aparte.

La voz manda: se le cortan los silencios, se transcribe, y los clips se acomodan encima según un plan de cortes (`plan.json`). Ese plan lo puede escribir Claude Code con la skill incluida, o lo podés escribir a mano.

## Qué necesitás

- Node.js 22 (está en `.nvmrc`)
- ffmpeg con soporte de subtítulos (libass). En Mac: `brew install ffmpeg`.
  Para chequear: `ffmpeg -hide_banner -filters | grep " ass "` tiene que mostrar una línea.
- Una clave de ElevenLabs para transcribir

## Instalación

```bash
npm install
cp .env.example .env   # y pegá tu ELEVENLABS_API_KEY
npm run check          # chequea que todo ande (tarda ~1 minuto)
```

## Cómo preparar un reel

Armá una carpeta así (puede estar en cualquier lado, fuera del repo):

```
playa/
  clips/        tus videos crudos
  voz.wav       tu voz en off (también sirve .mp3 o .m4a)
  musica.mp3    opcional
```

Tip: nombrar los clips con lo que muestran (`playa-atardecer.mp4`, `cafe-mesa.mov`) ayuda a elegir mejor.

## Uso con Claude Code

Abrí Claude Code en la raíz de este repo y pedile algo como:

> armá un reel con la carpeta ~/reels/playa

La skill está en `.claude/skills/reel/SKILL.md`. Claude corre los pasos, mira las capturas, arma el plan, te lo muestra y espera tu OK antes de renderizar.

## Uso a mano

```bash
npm run limpiar     -- ~/reels/playa   # 1. corta silencios de la voz (Silero VAD)
npm run transcribir -- ~/reels/playa   # 2. transcribe (ElevenLabs Scribe)
npm run inventario  -- ~/reels/playa   # 3. info y capturas de cada clip
# 4. escribí ~/reels/playa/edit/plan.json
npm run validar     -- ~/reels/playa   # 5. revisa el plan
npm run render      -- ~/reels/playa   # 6. genera edit/final.mp4
```

### Formato del plan

```json
{
  "tramos": [
    { "desde": 0,   "hasta": 2.6, "clip": "playa.mp4", "arrancaEn": 1.0, "encuadre": "izquierda", "nota": "Hoy les muestro..." },
    { "desde": 2.6, "hasta": 5.1, "clip": "cafe.mov",  "arrancaEn": 0.5 }
  ]
}
```

- `desde` / `hasta`: segundos sobre la voz limpia (los que aparecen en `edit/transcripcion.md`).
- `clip`: nombre del archivo dentro de `clips/`.
- `arrancaEn`: desde qué segundo del clip se toma la imagen.
- `encuadre` (opcional): hacia dónde recortar si el clip no es vertical. `"izquierda"`, `"centro"`, `"derecha"` (o `"arriba"` / `"abajo"`), o un número de 0 a 1. Por defecto, centro.
- Los tramos tienen que ir pegados y cubrir toda la voz. `npm run validar` te avisa si algo no cierra.

## Qué se genera en `edit/`

| Archivo | Qué es |
|---|---|
| `voz-limpia.wav` | Tu voz sin silencios largos |
| `voz-cortes.json` | Qué partes de la voz original se conservaron |
| `transcripcion.json` / `.md` | Texto con el tiempo de cada palabra |
| `inventario.json` | Datos y descripción de cada clip |
| `capturas/` | 4 capturas por clip |
| `plan.json` | El plan de cortes |
| `subtitulos.ass` | Subtítulos generados |
| `final.mp4` | El reel terminado |

## Ajustes

Todo está en `src/config.ts`: tamaño de video, cuánto silencio cortar, estilo de subtítulos (palabras por bloque, fuente, tamaño, altura), volumen de la música y cuánto baja cuando hablás.

## Trabajar sobre el código

- `CLAUDE.md` explica cómo está organizado el código y las reglas para cambiarlo (Claude Code lo lee solo).
- `docs/ideas.md` tiene los pendientes y mejoras para ir iterando.
- `npm test` corre los tests rápidos; `npm run test:e2e` hace un render completo con material de prueba; `npm run check` corre todo.
- Hay un workflow de GitHub Actions (`.github/workflows/ci.yml`) que corre `npm run check` en cada push y pull request.
