# Ideas y pendientes

Lista para ir iterando. Lo de arriba es lo más urgente.

## Para verificar

- [ ] Probar `transcribir` con una clave real de ElevenLabs (está armado según su API pero no se probó).
- [ ] Probar `limpiar` con voces reales en distintos ambientes (con ruido, con eco) y ajustar `VOZ` en `src/config.ts`.
- [ ] `@ricky0123/vad-node` no se actualiza desde 2024. Si da problemas, la alternativa es correr el modelo de Silero directo con `onnxruntime-node`.

## Mejoras

- [ ] Test de punta a punta de `limpiar` con una voz real (por ejemplo generada con espeak-ng en CI).
- [ ] Encuadre automático: detectar dónde está el sujeto en cada clip en vez de elegirlo a mano.
- [ ] Movimiento suave (zoom lento) en clips quietos.
- [ ] Transiciones entre tramos (hoy son cortes directos).
- [ ] Títulos y gráficos animados hechos en HTML y renderizados con Puppeteer.
- [ ] Exportar una portada (un cuadro elegido del reel).
- [ ] Varias versiones de subtítulos (estilos) para elegir.
- [ ] Velocidad por tramo (cámara lenta o rápida).
