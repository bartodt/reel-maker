# Prueba 2: con la herramienta nueva

Fecha: 11 de noviembre de 2026.

## Qué cambió desde la prueba 1

- **Inventario:** una grilla por clip, con más o menos una captura por segundo y el segundo escrito, y marcas `· habla` donde alguien habla.
- **Plan:** tramos sin voz (gancho, cierre, `audioDelClip`), `velocidad`, `texto`, `logo` y `ritmo`.
- **Skill:** lee `estilo.md` y el guion, y pregunta el ritmo.
- **Comparación:** contra `plan-real.json` (la edición real en el formato nuevo, con clips alternativos), usando `npm run comparar`.

## Cómo se hizo

Igual que la prueba 1. Un agente que no vio la edición real armó el plan en `~/reels/pancho-y-coca-prueba/c-herramienta-nueva/` con:
- la skill nueva
- `estilo.md` sin los ejemplos de este reel
- `guion.md`
- ritmo `"tranquilo"`

Tardó 13 minutos.

## Resultados (`npm run comparar`)

| | Real | Prueba 1 (B, con estilo) | Prueba 2 |
|---|---|---|---|
| Muestra lo mismo que el real | | 42% | 43% |
| Mismo clip exacto | | 36% | 31% |
| Mismo clip y mismo momento | | 11% | 5% |
| Tramos con voz | 15 | 27 | 18 |
| Plano típico | 1,47 s | 1,06 s | 1,65 s |
| Frase del chico con su audio | sí, en el segundo 2,7 de la voz | no | sí, en el segundo 2,7, mismo clip (9,0 s contra 8,8 s) |
| Textos grandes | 4 | 0 | 6 |
| Caminata acelerada para la dirección | sí (4,9x) | no | sí (5x) |
| Cierre con logo | sí | no | sí |
| Gancho sin voz | sí | no | no |

`prueba-2.jpg`: arriba el real, en el medio la prueba 1, abajo la prueba 2. La primera columna es el gancho y la última el cierre (en gris, si no hay). Las del medio son la mitad de cada plano real.

## Qué aprendimos

- **La estructura ahora sale igual que la tuya:** la frase del chico en el lugar exacto y con su audio, el ritmo, los precios en pantalla, la caminata acelerada y el cierre con logo. Antes nada de eso se podía hacer.
- **La elección de cada plano no mejoró (42% contra 43%).** Las grillas con más cuadros no cambiaron qué clips elige. Hubo errores que el estilo ya prohíbe: usó la licuadora (preparación) para la promo del licuado y el armado visto desde arriba para la de los dos panchos.
- **Faltó el gancho sin voz:** el estilo de prueba no lo pide (la regla del "mejor plano del producto, 1 s antes de la voz" salió de este mismo reel y se la sacamos para que fuera justa).
- **Encontrar la frase del chico le costó:** sin poder escucharla, la buscó mirando el volumen décima por décima. Transcribir el audio de los clips que tienen voz lo resolvería.
- **Sigue siendo lento y caro:** 13 minutos para mirar 28 grillas y armar el plan.
