# Línea de base: qué tan cerca queda la skill de hoy

Antes de mejorar la app, dos preguntas. ¿Qué tan cerca de las ediciones reales llega hoy la skill `reel`? ¿Y la medida (`npm run medir`) distingue una mejora de verdad del ruido de una corrida a otra?

## Regla de decisión

Escrita antes de correr nada. Todos los números salen de `npm run medir`, de 0 a 100%, por referencia y por columna.

- **Dispersión.** Para cada referencia y columna, la mejor menos la peor de las tres corridas a ciegas de la skill.
- **Piso al azar.** El percentil 90 de 20 planes con clips al azar, con la misma cantidad de cortes que la referencia en momentos al azar.
- **Piso de un clip.** El mejor plan que muestra un solo clip durante toda la voz. Se elige sabiendo la respuesta, así que es el techo de una estrategia tonta.
- **Una columna sirve hoy** si, en las dos referencias, la mediana de la skill queda arriba del piso al azar y del piso de un clip por más que la dispersión, y el techo (la referencia contra sí misma) deja más lugar que la dispersión.
- **Un cambio a la skill es una mejora** en una columna que sirve si, en las dos referencias, la mediana de tres corridas nuevas supera la mediana de hoy por más que la dispersión más grande (la de hoy o la nueva). Si sube en una referencia y baja en la otra, no se decide nada.
- **La copia premia la estructura** si la copia de Pancho y Coca sobre Casa Giro queda en la mediana de la skill en Casa Giro o arriba, en esa columna. Entonces una mejora que solo acerca a Pancho y Coca (de donde salió `estilo.md`) no se distingue de una que generaliza.
- **Qué cambia.** Si mismo contenido sirve, el próximo paso es mejorar cómo la app elige los planos y medirlo con esa columna. Si no sirve, primero se arregla la medida, antes de tocar la app.
