# Línea de base: qué tan cerca queda la skill de hoy

Antes de mejorar la app, dos preguntas. ¿Qué tan cerca de las ediciones reales llega hoy la skill `reel`? ¿Y la medida (`npm run medir`) distingue una mejora de verdad del ruido de una corrida a otra?

**Respuesta corta.** Hoy no. La skill queda en 20% de mismo contenido en Pancho y Coca y en 14% en Casa Giro, y ninguna columna separa a la skill de un plan tonto en las dos referencias. Según la regla de abajo, primero hay que arreglar la medida y después tocar la app.

## Regla de decisión

Escrita antes de correr nada. Todos los números salen de `npm run medir`, de 0 a 100%, por referencia y por columna.

- **Dispersión.** Para cada referencia y columna, la mejor menos la peor de las tres corridas a ciegas de la skill.
- **Piso al azar.** El percentil 90 de 20 planes con clips al azar, con la misma cantidad de cortes que la referencia en momentos al azar.
- **Piso de un clip.** El mejor plan que muestra un solo clip durante toda la voz. Se elige sabiendo la respuesta, así que es el techo de una estrategia tonta.
- **Una columna sirve hoy** si, en las dos referencias, la mediana de la skill queda arriba del piso al azar y del piso de un clip por más que la dispersión, y el techo (la referencia contra sí misma) deja más lugar que la dispersión.
- **Un cambio a la skill es una mejora** en una columna que sirve si, en las dos referencias, la mediana de tres corridas nuevas supera la mediana de hoy por más que la dispersión más grande (la de hoy o la nueva). Si sube en una referencia y baja en la otra, no se decide nada.
- **La copia premia la estructura** si la copia de Pancho y Coca sobre Casa Giro queda en la mediana de la skill en Casa Giro o arriba, en esa columna. Entonces una mejora que solo acerca a Pancho y Coca (de donde salió `estilo.md`) no se distingue de una que generaliza.
- **Qué cambia.** Si mismo contenido sirve, el próximo paso es mejorar cómo la app elige los planos y medirlo con esa columna. Si no sirve, primero se arregla la medida, antes de tocar la app.

## Cómo se midió

Todos los números de esta página son medidos el 16 y 17 de noviembre de 2026, salvo los que dicen "estimado".

- **Corridas de la skill.** `npm run corrida-a-ciegas -- ~/reels/_verificacion/m3/corrida-N`. Cada plan lo arma un Claude nuevo, con el mismo pedido y los mismos permisos que usa la app, ritmo "tranquilo" y el `estilo.md` sin ejemplos de Pancho y Coca. Corre en una copia del repo sin `referencias/`, `docs/`, `test/` ni `scripts/`. El modelo es el que usa hoy el `claude` de la app: `claude-opus-4-8`.
- **Cotas.** `npm run cotas -- ~/reels/_verificacion/m3/cotas`. Usa semillas fijas, así que da lo mismo cada vez que se corre.
- **A ciegas.** Revisé todo lo que pidió y recibió cada Claude. Ninguno leyó `referencias/` ni el video publicado. Fuera de su carpeta y de la copia del repo, algunos buscaron versiones de Node, escribieron archivos de ayuda en `/tmp` o intentaron listar la carpeta original de `clips/`, y el sandbox no les mostró nada.
- **Corridas que quedan aparte.** A mitad de la corrida 1 se llenó el disco de la compu. El Claude de Pancho y Coca empezó a recibir errores al escribir, y a los dos `validar` dejó de andarles un buen rato. En la corrida 4, el Claude de Casa Giro se cortó por el límite de uso de la cuenta justo después de escribir el plan, sin validarlo, y el plan no pasa `validar`. Las dos se decidieron antes de mirar sus números, y figuran abajo, aparte. La corrida 4 de Pancho y Coca ocupa el lugar de la corrida 1. Para Casa Giro, la corrida 5 también se cortó, así que quedan dos corridas completas.
- **Validar con Node 16.** Algunos Claude no pudieron correr `validar` en algún momento, porque su terminal arrancó con el Node 16 de la compu. Le pasó al de Casa Giro de la corrida 3, que igual llegó a "Plan OK". Es el problema que arregla la PR #8 para la app. Todos los planes que cuentan pasan `validar` corrido después con Node 22.

## Resultados

Las columnas son las de `npm run medir`.

**Pancho y Coca.**

| | Mismo contenido | Mismo clip | Mismo momento | Cortes |
|---|---|---|---|---|
| Techo (la referencia contra sí misma) | 100% | 100% | 100% | 100% |
| Piso al azar (percentil 90 de 20) | 25% | 12% | 1% | 29% |
| Piso de un clip (el mejor en cada columna) | 41% | 41% | 4% | 0% |
| Corrida 2 | 18% | 9% | 1% | 22% |
| Corrida 3 | 20% | 10% | 3% | 23% |
| Corrida 4 | 31% | 11% | 2% | 24% |
| **Mediana** | **20%** | **10%** | **2%** | **23%** |
| **Dispersión** | **13 puntos** | **2 puntos** | **2 puntos** | **3 puntos** |
| Corrida 1 (aparte) | 28% | 18% | 4% | 31% |

**Casa Giro.** Su voz sale de la mezcla publicada, no de una grabación aparte. Sus pausas ya son las de la edición real, y eso ayuda a cualquier plan que corte en las pausas.

| | Mismo contenido | Mismo clip | Mismo momento | Cortes |
|---|---|---|---|---|
| Techo (la referencia contra sí misma) | 100% | 100% | 100% | 100% |
| Piso al azar (percentil 90 de 20) | 9% | 8% | 5% | 29% |
| Piso de un clip (el mejor en cada columna) | 15% | 15% | 5% | 0% |
| Copia de Pancho y Coca | 11% | 11% | 4% | 36% |
| Corrida 2 | 11% | 6% | 4% | 51% |
| Corrida 3 | 16% | 13% | 6% | 56% |
| **Mediana (dos corridas)** | **14%** | **10%** | **5%** | **54%** |
| **Dispersión (dos corridas)** | **6 puntos** | **6 puntos** | **2 puntos** | **5 puntos** |
| Corrida 1 (aparte) | 13% | 9% | 4% | 46% |
| Corrida 4 (aparte, cortada) | 16% | 16% | 2% | 54% |

Casa Giro tiene dos corridas completas, no tres. La tercera se cortó dos veces. En la corrida 4 se acabó el límite de uso de la cuenta. En la corrida 5 la compu se durmió con la tapa cerrada y Claude perdió la conexión antes de escribir el plan. Con dos corridas, la mediana es el promedio de las dos, y la dispersión es más chica de lo que sería con tres.

Otras cotas de `npm run cotas`, como mediana de 20 semillas con clips al azar:

| | Pancho y Coca, cortes | Casa Giro, cortes |
|---|---|---|
| Un corte en cada frase de la transcripción | 20% | 41% |
| Un corte cada 0,6 s | 39% | 38% |
| Los mismos cortes que la referencia | 96% | 100% |

## Qué dice cada columna

Ninguna columna sirve hoy. En Pancho y Coca, en ninguna columna la mediana de la skill supera los dos pisos por más que la dispersión, y la regla pide las dos referencias.

- **Mismo contenido.** Pancho y Coca da 20%, debajo del piso al azar (25%) y del piso de un clip (41%). Casa Giro da 14%, apenas arriba del piso al azar (9%) y debajo del piso de un clip (15%). No sirve.
- **Mismo clip.** Pancho y Coca da 10%, contra 12% y 41%. Casa Giro da 10%, contra 8% y 15%. No sirve.
- **Mismo momento.** Todo queda entre 1% y 6%, pisos incluidos. No sirve.
- **Cortes.** En Casa Giro la skill (54%) supera el piso al azar (29%) por 25 puntos, más que la dispersión. En Pancho y Coca da 23%, debajo del piso al azar (29%). No sirve.
- **La copia.** Copiar Pancho y Coca sobre Casa Giro por orden de filmación da 11% de mismo clip, arriba de la mediana de la skill (10%). En esa columna la copia premia la estructura. En mismo contenido da 11%, 3 puntos debajo de la skill y arriba del piso al azar. Hoy no cambia nada, porque ninguna columna sirve.

## Qué limita cada número

- **El techo es 100% en todo.** `medir` no le resta nada a un plan perfecto. No es una meta posible, porque la misma creadora no repetiría su edición al 100%.
- **Mismo contenido en Pancho y Coca depende de un clip.** La caminata de la estación al puesto (`IMG_0655`) es el 41% de la voz de la referencia, y un solo plano acelerado de 10,4 s es el 33%. Ninguna de las corridas de hoy la usa (la corrida 1, 1,6 s), así que todas pierden ese tercio. Las pruebas 1 y 2, con la skill de antes, la usaron para el 22% y el 19% de la voz y sacaron 42% y 43%, medidas con este mismo `medir`. Entre las corridas de hoy, los 13 puntos de dispersión vienen de otros planos. La corrida 4 eligió tres clips que la referencia también usa.
- **Tres corridas son pocas.** Entre las corridas 2, 3 y 4, mismo contenido en Pancho y Coca va de 18% a 31%, y la corrida 4 sola abrió 11 puntos. Una corrida nueva puede caer fuera de la dispersión de la tabla sin que nada haya cambiado.
- **Cortes premia cortar en las frases.** Cortar al azar en cada frase, sin mirar nada más, ya da 20% en Pancho y Coca y 41% en Casa Giro. La skill queda en ese nivel en Pancho y Coca y 10 a 15 puntos arriba en Casa Giro, donde las pausas de la voz ya vienen de la edición real. Cortar cada 0,6 s da 38% a 39% en las dos, más que la skill en Pancho y Coca, así que la columna también premia cortar mucho.
- **Mismo momento tiene muy poca resolución.** Pancho y Coca tiene 15 tramos con voz y Casa Giro 19. Acertar un tramo más mueve la columna unos 3 a 7 puntos (estimado), así que todo lo que se ve ahí son uno o dos aciertos.
- **Las alternativas valen en cualquier momento del clip.** Por eso un solo clip, `IMG_0705`, saca 37% de mismo contenido en Pancho y Coca, porque figura como alternativa de la caminata. Infla los pisos y a la skill por igual.
- **Las referencias se armaron con estas mismas dos.** Los umbrales de `reconstruir`, que armó la referencia de Casa Giro, se ajustaron mirando estos dos reels. Un error en la referencia no se ve en el techo.
- **Son dos reels.** Toda la regla se apoya en dos referencias, y una sola de ellas basta para que una columna no sirva.

## Qué arreglar en la medida

Lo que sigue de lo de arriba, en orden de cuánto ayuda (estimado):

1. Medir con cinco corridas o más por referencia, para que la dispersión no dependa de una corrida suelta.
2. Que una alternativa valga solo cerca del momento de la referencia, no en cualquier parte del clip.
3. Comparar los cortes contra el piso de "un corte en cada frase", para ver si la skill corta mejor que la voz sola.
4. Sumar referencias con crudos.

## Tiempos

| Corrida | Armar la carpeta, Pancho y Coca | Armar la carpeta, Casa Giro | Claude, Pancho y Coca | Claude, Casa Giro | Toda la corrida |
|---|---|---|---|---|---|
| 1 (aparte) | 181 s | 289 s | 19,0 min | 19,1 min | 24,0 min |
| 2 | 207 s | 306 s | 12,3 min | 11,3 min | 16,5 min |
| 3 | 361 s | 418 s | 13,0 min | 16,7 min | 23,7 min |
| 4 | 627 s | 678 s | 8,1 min | 9,6 min (cortado) | 21,1 min |
| 5 (solo Casa Giro) | | 164 s | | 10,4 min (cortado) | no cuenta, la compu se durmió |

- **Antes.** La prueba 2 de Pancho y Coca tardó 13 minutos a mano, según `pancho-y-coca/prueba-2.md`. El Claude de hoy tarda entre 8 y 19 minutos.
- **La regla.** La parte con script (armar la carpeta, `inventario` y `medir`) tenía que tardar menos de 5 minutos por referencia. Pasó de 5 minutos en 5 de las 9 carpetas, todas armadas con las dos referencias a la vez. Las dos veces que se armó Casa Giro sola quedó debajo, con 164 s para toda la carpeta en la corrida 5 y 207 s para el inventario solo, en una prueba aparte. `medir` tarda menos de un décimo de segundo.
- **Qué lo frena.** No lo perfilé, así que es una inferencia. El inventario arranca ffmpeg una vez por captura y tres veces más por clip, unas 340 veces en Pancho y Coca y 520 en Casa Giro (estimado). En esta compu cada arranque de ffmpeg tarda 0,4 a 0,6 s, contra 12 ms de un programa del sistema, y el antivirus usaba unos dos núcleos mientras tanto. El inventario de Casa Giro solo, sin la otra referencia al lado, tardó 207 s y usó en promedio 2,3 de los 8 núcleos. 520 arranques de 0,4 s son unos 208 s (estimado). Con las dos referencias a la vez y la compu más cargada, cada una tardó más.
