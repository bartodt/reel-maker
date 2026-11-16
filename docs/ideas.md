# Pendientes

## Rumbo

Asistente post filmación hecho a medida de una creadora (Somos San Isidro). Ella filma y graba la voz. La app revisa el material, arma el corte con su criterio y lo deja en **Edits para Mac**, donde ella lo retoca y lo publica.

- No hace guion ni lista de tomas, y no es un editor de video: lo que ya hace Edits no se construye acá.
- **Cómo medimos:** cada reel, la diferencia entre lo que arma la app y lo que ella publica (`npm run comparar`) tiene que achicarse.

## Cómo trabajamos

Con [pstack](https://github.com/cursor/plugins/tree/main/pstack) de Lauren Tan, ya instalada en Claude Code. Cada tarea arranca con `/pstack:poteto-mode` y la tarea de esta lista. Cada fase se cierra verificada antes de pasar a la siguiente. Al lado de cada fase va el playbook que corresponde; entre paréntesis, la skill que hace falta en esa tarea.

## Fase 1: que el armado en Edits ande siempre (playbook: feature)

1. [ ] Probar `npm run edits` contra Edits con la clave en `.env`, sobre `~/reels/pancho-y-coca-prueba/referencia` (`prove-it-works`).
2. [ ] Crear la skill `verify-edits`: chequea que Edits esté abierto y la clave sirva, arma la referencia, guarda cuadros como prueba y borra el proyecto de prueba (`create-verification-skill`).
3. [ ] Que reintentar no deje proyectos duplicados ni a medias (`make-operations-idempotent`).
4. [ ] Revisar en un solo lugar lo que contesta Edits, para que un cambio suyo dé un error claro (`boundary-discipline`).
5. [ ] Respetar el encuadre de los clips horizontales.
6. [ ] Bajar la música cuando ella habla.
7. [ ] Su look en Edits: elegir con ella subtítulos, fuente y animación de los textos grandes.
8. [ ] Logo real de Somos San Isidro, con la imagen de atrás oscurecida.
9. [ ] Textos grandes al ritmo de la voz.
10. [ ] Que el audio de un clip pueda seguir sonando sobre el plano siguiente.
11. [ ] Que ella lo pruebe con un reel suyo, de punta a punta, desde la app, y anotar dónde se traba.
12. [ ] Revisar cada cambio en `src/pasos/edits.ts` antes de darlo por bueno (`interrogate`).

## Fase 2: aprender su criterio (playbook: hillclimb)

1. [ ] Conseguir 5 a 10 reels suyos publicados, con material crudo y voz.
2. [ ] Validar `npm run comparar` como métrica: que distinga una edición buena de una mala y no premie copiar el reel del que salió `estilo.md` (`benchmark-checklist`, `explain-the-number`).
3. [ ] Afinar `estilo.md` con esos reels, con una estructura por formato si repite formatos.
4. [ ] Hillclimb: cada cambio a `estilo.md` o a la skill `reel` se mide contra todas las referencias y se queda solo si mejora (`show-me-your-work`).
5. [ ] Leer cómo quedó cada reel en Edits después de que ella lo retocó y proponerle como regla lo que corrige en dos o más reels. Se anota solo si dice que sí (método de `automate-me` y `reflect`).

## Fase 3: revisar el material por ella (playbook: prototype, después feature)

1. [ ] Marcar los momentos buenos de cada video, con segundos. Comparar lo nuestro con lo que trae Edits (`describeClip`, `detectShots`) antes de elegir.
2. [ ] Descartar lo movido, lo fuera de foco, los planos vacíos y las tomas repetidas.
3. [ ] Transcribir el audio de los clips donde habla alguien.
4. [ ] Usar las fotos, no solo los videos.

## Fase 4: arreglar la voz y avisar lo que falta (playbook: feature)

1. [ ] Corregir los nombres de la transcripción con el guion.
2. [ ] Detectar frases dichas dos veces y quedarse con la mejor.
3. [ ] Avisar antes de armar si nombra algo que no está filmado, y proponer una salida.
4. [ ] Probar `limpiar` con voces reales con ruido y eco.

## Fase 5: simplificar la app (playbook: refactoring)

1. [ ] Que Cortes sea para mirar y pedir cambios con palabras, no un editor plano por plano (`blast-radius` antes de borrar).
2. [ ] Decidir si el render propio queda como vista previa o se saca.
3. [ ] Opcional: dos versiones con distinto gancho para que ella elija (`arena`).

## Después

- [ ] Texto de la publicación: descripción, hashtags y ubicación.
- [ ] Portada: el mejor cuadro, con el título.
- [ ] Historias o un adelanto con lo que sobró.
- [ ] Borrar de `~/Movies/reel-maker/` el material de reels viejos.
- [ ] Si `@ricky0123/vad-node` da problemas, correr Silero directo con `onnxruntime-node`.
- [ ] Abrir reels que están fuera de `~/reels/`.

## Ya no

Agregar o reordenar planos en la app, vista previa en baja calidad, transiciones, zoom lento, títulos animados, estilos de subtítulos y encuadre automático propio. Lo trae Edits o no va con el rumbo.

## Hecho

- [x] Transcribir con ElevenLabs (probado con Pancho y Coca).
- [x] Velocidad por tramo y tramos sin voz (gancho, cierre, alguien del clip hablando).
- [x] Paso `npm run edits` y botón "Armarlo en Edits" en la app, con subtítulos corregidos con la transcripción. Falta probarlo con la clave (fase 1, tarea 1).
