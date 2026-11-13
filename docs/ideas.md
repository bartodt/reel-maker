# Ideas y pendientes

Lista para ir iterando. Lo de arriba es lo más urgente.

## Para verificar

- [x] Probar `transcribir` con una clave real de ElevenLabs (anduvo con el reel de Pancho y Coca, noviembre 2026).
- [ ] Probar `limpiar` con voces reales en distintos ambientes (con ruido, con eco) y ajustar `VOZ` en `src/config.ts`.
- [ ] `@ricky0123/vad-node` no se actualiza desde 2024. Si da problemas, la alternativa es correr el modelo de Silero directo con `onnxruntime-node`.

## App (`npm run ui`)

- [ ] Que la creadora la pruebe con un reel de verdad, de punta a punta, y anotar dónde se traba.
- [ ] Agregar planos sin voz (gancho, cierre, alguien hablando a cámara) desde el editor. Hoy se pueden pedir a Claude o editar los que hay.
- [ ] Vista previa rápida de un plano o de todo el reel sin renderizar (por ejemplo, en baja calidad).
- [ ] Abrir reels que están fuera de `~/reels/`.
- [ ] Reordenar planos arrastrándolos.
- [ ] Hoy "Abrir carpeta" y abrir el navegador solo andan en Mac.

## Mejoras

Para saber si una mejora ayuda, correr la prueba de `referencias/README.md` antes y después.

- [ ] Test de punta a punta de `limpiar` con una voz real (por ejemplo generada con espeak-ng en CI).
- [ ] Encuadre automático: detectar dónde está el sujeto en cada clip en vez de elegirlo a mano.
- [ ] Movimiento suave (zoom lento) en clips quietos.
- [ ] Transiciones entre tramos (hoy son cortes directos).
- [ ] Títulos y gráficos animados más vistosos (hoy los textos grandes aparecen palabra por palabra con libass). Por ejemplo, el recuadro con cursor que usa el usuario, hecho en HTML y renderizado con Puppeteer.
- [ ] Exportar una portada (un cuadro elegido del reel).
- [ ] Varias versiones de subtítulos (estilos) para elegir.
- [x] Velocidad por tramo (cámara lenta, rápida o imagen congelada).
- [x] Tramos sin voz: gancho, cierre y alguien del clip hablando con su propio audio.
- [ ] Que el audio de un clip pueda seguir sonando sobre el plano siguiente (en la edición real de Pancho y Coca, el "¡sácate las ganas!" termina sobre el frente del local).
- [ ] Transcribir el audio de los clips que tienen voz (`conVoz` del inventario). Serviría para encontrar sin adivinar la frase de "Persona que dice" (en la prueba 2 el agente la buscó mirando el volumen) y para subtitular lo que dice alguien en un clip.
- [ ] Usar el guion para corregir los subtítulos: la transcripción escribió "Pancho & Co." en vez de "Pancho y Coca".
- [ ] Detectar partes movidas o fuera de foco en el inventario.
- [ ] Oscurecer la imagen detrás del logo del cierre.
- [ ] Usar las fotos de la carpeta de clips (hoy solo se usan videos).
