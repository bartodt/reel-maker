# Prueba 1: la tool arma Pancho y Coca a ciegas

Fecha: 11 de noviembre de 2026.

## Cómo se hizo

1. La voz se separó de la música del final con ElevenLabs (aislamiento de voz). Se sacó a mano la frase del chico a cámara (3,65–5,40 s del final).
2. Con esa voz y los 28 crudos se corrieron `limpiar`, `transcribir` e `inventario`. Voz limpia: 31,7 s.
3. Dos agentes que no vieron la edición real armaron el plan:
   - **A:** solo con la skill, tal como está hoy.
   - **B:** con la skill y un `estilo.md` sin los ejemplos de este reel (solo reglas generales y ejemplos de tenis y panadería).
4. Se comparó cada plan con la edición real sobre los tiempos de la voz limpia.

Carpeta de la prueba: `~/reels/pancho-y-coca-prueba/` (`a-sin-estilo/` y `b-con-estilo/`).

## Resultados

| | Real | A (sin estilo) | B (con estilo) |
|---|---|---|---|
| Planos | 14 | 23 | 27 |
| Duración típica (mitad) | 1,6 s | 1,2 s | 1,1 s |
| Clips distintos | 11 | 19 | 14 |
| Mismo clip exacto que el real | | 7% del tiempo | 37% del tiempo |
| Muestra lo mismo que el real (a ojo, 15 momentos) | | ~5 de 15 | ~9 de 15 |

`prueba-1.jpg`: arriba el real, en el medio A, abajo B. Cada columna es el mismo momento de la voz (la mitad de cada plano real).

## Qué aprendimos

- **El estilo ayuda mucho.** B eligió el plano literal para casi cada producto: el licuado sirviéndose para "licuados", la lata para "gaseosas", la gaseosa sirviéndose para "con gaseosa". También descartó los planos vacíos y la preparación.
- **A usó lo que vos descartás:** la licuadora (preparación), la cocina vacía y el cocinero de lejos.
- **B corta demasiado rápido para este reel:** 27 planos contra tus 14. Aplicó el ritmo del tenis y la panadería. El ritmo cambia de reel a reel, así que hay que decidirlo en cada uno.
- **Con 4 capturas por clip no alcanza.** A se quejó de eso, y B armó por su cuenta hojas con más cuadros: tardó 11 minutos.
- **Lo que el formato no permite** hizo que los dos fallaran en los mismos lugares: el chico hablando con su propio audio, la caminata acelerada, el gancho sin voz, el tren y el logo del cierre, y los textos grandes.
- **Error de transcripción:** "Lo de Pancho y Coca" salió como "lo de Pancho & Co.". Con el guion se puede corregir.

## Ojo

- Esta prueba es con un solo reel, y el estilo general salió en parte de este mismo reel.
- La voz ya venía editada por el usuario, así que no prueba el paso `limpiar`.
