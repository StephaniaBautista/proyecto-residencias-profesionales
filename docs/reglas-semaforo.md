# Reglas del semáforo

El color no sale del modelo. Cada señal suma puntos y el total fija el nivel.

| Señal | Puntos |
| --- | --- |
| Promedio menor a 70 | 2 |
| Asistencia menor a 80% | 2 |
| Tres o más materias reprobadas | 2 |
| Avance curricular menor a 50% | 1 |
| Dos o más acuerdos vencidos | 1 |

| Puntos | Nivel | Acción que muestra la ficha |
| --- | --- | --- |
| 0 o 1 | Verde | Seguimiento ordinario |
| 2 a 4 | Amarillo | Seguimiento preventivo y un acuerdo |
| 5 o más | Rojo | Entrevista prioritaria, asesoría y seguimiento semanal |

La ficha lista las señales que sumaron. Si no hay ninguna, el caso es verde con cero puntos.

## Alertas

- Rojo sin una revisión de asesoría en el periodo.
- Acción en seguimiento con compromiso dentro de los próximos 7 días, o ya vencida.

Marcar la alerta como atendida no cambia el color.

## Modelo de riesgo

La etiqueta de entrenamiento (bajo, medio, alto) usa otro corte: alto si asistencia o promedio están bajo 70 o hay 3 o más reprobadas; medio si asistencia está bajo 85, promedio bajo 78 o hay al menos una reprobada. Por eso un caso puede ser amarillo en el semáforo y alto en el modelo.

Se entrenan regresión logística, árbol y bosque aleatorio. Se guarda el árbol, porque la ficha puede leer la predicción como umbrales. El bosque y la regresión solo aparecen en la vista técnica.
