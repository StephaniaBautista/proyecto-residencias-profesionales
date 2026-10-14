# Uso del prototipo

Entra en `http://localhost:5173` con una cuenta de la pantalla de acceso. La contraseña de la semilla es `Semaforo-demo-2026`.

| Rol | Qué puede hacer |
| --- | --- |
| Tutor A y B (`tutor@ittla.demo`) | Ve GRP-A y GRP-B, abre fichas y registra acciones |
| Tutor C (`tutor.c@ittla.demo`) | Solo GRP-C |
| Coordinación | Ve todos los grupos. No registra acciones |
| Asesoría | Ve todos y marca la ficha como aprobada, con ajuste o con información insuficiente |
| Administración técnica | Además abre la vista Técnica: métricas, corpus y bitácora |

## Recorrido

1. En el tablero filtra periodo `2026-1` y, si quieres, un grupo. Los conteos dicen Verde, Amarillo o Rojo, no solo el color.
2. Abre un caso en rojo. La ficha muestra las señales, la acción de la regla y, aparte, la sugerencia del árbol.
3. Con el tutor, registra una acción con fecha cercana. Aparece en Alertas.
4. Con asesoría, guarda una revisión. La alerta de “rojo sin revisión” de ese caso se cierra.
5. En Consulta pregunta algo que esté en las fuentes cargadas, por ejemplo qué debe registrar el seguimiento. La respuesta cita documento, fragmento y página; abre una consulta reciente para volver a ver la respuesta y sus fuentes.
6. Pregunta algo que el programa no cubre, por ejemplo un trámite de becas. La respuesta debe ser: «No se encontró evidencia suficiente en los documentos autorizados cargados.»

Si la consulta dice que falta `OPENROUTER_API_KEY` o que no hay evidencia en la primera pregunta cubierta, falta correr `npm run ingest` en `backend/`.
