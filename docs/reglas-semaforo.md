# Reglas del semáforo académico (RA-01…RA-08)

> **Aviso.** Esta versión del catálogo (`RA-2026.2-v1`, estado `experimental`) es un supuesto de ingeniería para probar el prototipo con datos sintéticos. **No son criterios oficiales del TecNM ni del ITTLA** y no deben usarse para generar alertas operativas sobre estudiantes reales sin aprobación institucional documentada. El propio sistema lo declara en la base de datos (`configuracion.reglas_aprobadas = false`) y en el banner de la interfaz.

El color del semáforo **no lo decide el modelo de riesgo ni el asistente**. Lo calcula un motor de reglas que lee el catálogo versionado de la tabla `regla_semaforo`; cada evaluación guarda qué reglas se activaron para que el resultado sea explicable y auditable.

## Estados posibles

| Nivel | Significado | Qué muestra la ficha |
| --- | --- | --- |
| `verde` | Sin señales de riesgo en el corte evaluado | Seguimiento ordinario |
| `amarillo` | Señal preventiva; conviene intervenir temprano | Acción sugerida por la regla activada |
| `rojo` | Señal de atención prioritaria | Acción sugerida y revisión tutorial prioritaria |
| `informacion_insuficiente` | Faltan datos indispensables para clasificar con confiabilidad | Verificación de datos; no se presume acreditación ni reprobación |
| `inconsistencia` | Los datos son contradictorios entre sí o con su fuente | Se bloquea la clasificación automática y se envía a validación humana |

`informacion_insuficiente` e `inconsistencia` son estados de **calidad de datos**, no niveles de gravedad académica: no equivalen a verde ni a rojo y no deben interpretarse como reprobación.

## Catálogo vigente

Tabla sembrada por `npm run seed` desde `backend/datos/reglas-semaforo.json`. La columna «prioridad» es el orden interno de resolución (mayor número = se evalúa antes como criterio de precedencia); el estado final siempre respeta la precedencia de severidad.

| Regla | Prioridad | Condición | Estado | Acción sugerida |
| --- | --- | --- | --- | --- |
| **RA-01** | 10 | Todas las asignaturas evaluadas del semestre anterior están acreditadas y no hay datos faltantes | `verde` | Mantener el seguimiento ordinario del periodo |
| **RA-02** | 40 | Exactamente una asignatura no acreditada en el semestre anterior | `amarillo` | Sugerir asesoría académica y registrar un acuerdo de seguimiento |
| **RA-03** | 50 | Exactamente dos asignaturas no acreditadas en el semestre anterior | `amarillo` | Agendar entrevista tutorial y plan de recuperación |
| **RA-04** | 80 | Tres o más asignaturas no acreditadas en el semestre anterior | `rojo` | Revisión tutorial prioritaria y canalización a asesoría disciplinar |
| **RA-05** | 60 | Dos o más evaluaciones parciales exigibles no acreditadas en una misma asignatura del periodo actual | `amarillo` | Revisar avance por unidad y sugerir asesoría académica antes del corte final |
| **RA-06** | 90 | Curso especial registrado oficialmente en el periodo | `rojo` (provisional) | Revisión de trayectoria y lineamientos; validar el registro con Servicios Escolares |
| **RA-07** | 100 | Faltan datos indispensables para el corte evaluado (sin corte de referencia o calificaciones exigibles sin registrar) | `informacion_insuficiente` | Verificar la captura de datos con el área responsable antes de clasificar |
| **RA-08** | 20 | Antecedentes históricos de reprobación, pero el corte de referencia y el avance actual están acreditados | `verde` actual | Seguimiento de antecedentes sin alerta automática; conservar la trazabilidad |

Cada fila de `regla_semaforo` guarda además `version`, `vigencia_desde`, `vigencia_hasta`, `activa`, `aprobada_por` y `aprobada_en`. La versión sembrada tiene `aprobada_por = null` y `vigencia_hasta = null`: es experimental y está vigente solo para pruebas.

### Condiciones declarativas

La columna `condicion` es un JSON evaluado por el motor; no hay umbrales escondidos en TypeScript. Las condiciones soportadas por el catálogo actual son:

| `tipo` | Significado |
| --- | --- |
| `todas_acreditadas_anterior` | Todas las asignaturas evaluadas del periodo de referencia están acreditadas |
| `no_acreditadas_anterior` | Cuenta de asignaturas no acreditadas del periodo de referencia; admite `exacto` o `minimo` |
| `parciales_no_acreditados_misma_asignatura` | Cuenta de parciales exigibles no acreditados por asignatura; `minimo` |
| `curso_especial_registrado` | Existe un registro de curso especial en el periodo |
| `datos_faltantes` | Falta el corte de referencia o hay calificaciones exigibles sin registrar |
| `antecedente_reprobacion_desempeno_actual_acreditado` | Hay historial de reprobación, pero el corte actual está acreditado |

Cambiar un umbral o una condición significa publicar una **versión nueva** del catálogo, no editar código.

## Cómo se evalúa un caso

1. **Permisos e identidad.** Se verifica el rol, la institución y el periodo solicitado.
2. **Integridad de datos.** Se detectan duplicados, resultados incompatibles con la calificación (aprobada con menos de 70, reprobada con 70 o más) y parciales acreditados con calificación reprobatoria. Si hay contradicción esencial, el resultado es `inconsistencia` y se bloquea la clasificación automática.
3. **Suficiencia de datos.** Si falta el periodo de referencia, no hay resultados del corte, faltan asignaturas esperadas o hay calificaciones exigibles sin registrar, el resultado es `informacion_insuficiente`; una calificación ausente **no** se convierte en cero ni en reprobación, y una calificación no exigible no se evalúa.
4. **Evaluación de reglas.** Se evalúan RA-01…RA-08 con el mismo corte y la misma `version_reglas`, ordenadas por prioridad descendente.
5. **Selección del resultado.** Se conserva la regla de mayor prioridad —el catálogo está ordenado de modo que la regla más severa aplicable gane— y se guarda la lista completa de reglas activadas.
6. **Salida.** Se emite nivel, justificación, fecha, fuente, acción sugerida y estado **pendiente de revisión**. La intervención y cualquier consecuencia escolar requieren validación humana.

Los dos estados de calidad de datos se resuelven **antes** de evaluar el catálogo académico y se registran con un código de sistema: `RA-07` para información insuficiente y `SIS-INC` para inconsistencia (ambos con prioridad 100 y sin sumar puntos de reglas académicas). El resultado queda en `evaluacion_riesgo` (una fila por estudiante, periodo y versión de reglas) y se refleja en `trayectoria_periodo` con `estado_datos`, `reglas_activadas`, `cobertura_datos` y `riesgo_observado`.

## Precedencia y empates

- **Precedencia académica:** rojo > amarillo > verde. Si dos reglas válidas producen niveles distintos, gana la más severa y **todas** las reglas activadas quedan registradas para explicar el caso.
- **La calidad de datos manda:** `inconsistencia` e `informacion_insuficiente` impiden una clasificación concluyente aunque otras reglas se activen; no se resuelven como empate de severidad.
- **Prioridad interna:** cada regla tiene una `prioridad` numérica. El motor evalúa en ese orden y toma la primera que aplica, de modo que el catálogo vigente tiene las reglas rojas y los estados de calidad por encima de las amarillas y verdes (RA-07 = 100, RA-06 = 90, RA-04 = 80, RA-05 = 60, RA-03 = 50, RA-02 = 40, RA-08 = 20, RA-01 = 10). Cambiar la prioridad cambia el desempate, por eso se versiona.
- **`puntos`:** se conserva la suma de prioridades de las reglas activadas (tope 999) como referencia; no es un umbral de color, el color lo fija la regla de mayor prioridad.
- **Sin umbrales oficiales:** el valor 70 y demás cifras del catálogo son supuestos ilustrativos; no confirman la regla aplicable a cada plan o modalidad.

## Datos faltantes vs. contradicción

| Situación | Ejemplo | Resultado | Qué no debe hacerse |
| --- | --- | --- | --- |
| Dato ausente | No hay calificación registrada de una materia exigible | `informacion_insuficiente` | Asumir reprobado, aprobado o cero |
| Dato aún no exigible | Parcial todavía no aplicado o fuera del corte | No se evalúa en ese corte | Contarlo como reprobación |
| Dato contradictorio | Una fuente marca acreditada y otra reprobada; promedio incompatible con las calificaciones | `inconsistencia` | «Elegir» una fuente o promediar la contradicción |
| Curso especial registrado | El alumno aparece en curso especial oficial | `rojo` provisional | Presentarlo como sanción o criterio definitivo |

La cobertura de datos se informa junto con el resultado (`cobertura_datos`) para que el tutor sepa sobre qué evidencia se calculó el color.

## Versionado y aprobación

- **Dónde vive:** tabla `regla_semaforo` (una fila por código, versión e institución) y archivo fuente `backend/datos/reglas-semaforo.json` con `version`, `estado`, `vigencia_desde`, `vigencia_hasta` y `aprobada_por`.
- **Nueva versión:** se insertan filas nuevas con otro `version` y su vigencia; las anteriores se cierran con `vigencia_hasta` y/o `activa = false`. Nunca se reescribe el historial de una versión publicada: las evaluaciones guardan `version_reglas` y siguen siendo auditables.
- **Quién aprueba:** la aprobación requiere revisión documentada de Desarrollo Académico, áreas académicas y Servicios Escolares según sus atribuciones, registrada en `aprobada_por`/`aprobada_en`. Mientras no exista, `configuracion.reglas_aprobadas` sigue en `false` y el banner lo advierte.
- **Cómo verificar la versión activa:** consulta la vista Técnica o:

  ```sql
  select codigo, version, nivel, prioridad, aprobada_por, vigencia_desde
  from regla_semaforo
  where institucion_id = (select id from institucion where clave = 'ITTLA')
    and activa
  order by prioridad, codigo;
  ```

- **Trazabilidad de una decisión:** `evaluacion_riesgo.reglas_activadas` guarda las reglas aplicadas con su versión; `bitacora` registra altas, revisiones y recálculos.

## Relación con las alertas

Las alertas son consecuencias operativas del color y de la calidad de datos, no un segundo semáforo:

- **Rojo sin revisión** de asesoría en el periodo.
- **Acción por vencer**: compromiso tutorial en los próximos 7 días o ya vencido.
- **Datos incompletos** (`datos_incompletos`): caso en `informacion_insuficiente`.
- **Inconsistencia de datos** (`inconsistencia_datos`): caso bloqueado para validación.

Marcar una alerta como atendida no cambia el color; el color solo se recalcula al corregir datos o publicar una nueva evaluación de reglas.

## El modelo de riesgo no cambia el color

El modelo predictivo se entrena con la **etiqueta observada del siguiente periodo** y una **división temporal**; reporta métricas fuera de muestra, cobertura y una advertencia de prototipo. Su salida es una sugerencia separada del semáforo: puede aparecer como «—» cuando no hay predicción disponible y nunca modifica el nivel calculado por RA-01…RA-08. Un caso amarillo puede tener riesgo alto sugerido y seguir siendo amarillo.

## Casos de prueba del anexo

El plan de pruebas del proyecto (63 escenarios) incluye estos criterios de aceptación del semáforo; el estado de ejecución se documenta en `docs/resultados_pruebas_2026-10-13.md` (corte del 13-oct-2026: ninguno de los 63 escenarios ejecutado de extremo a extremo) y en el libro de casos:

| Caso | Entrada sintética | Salida esperada |
| --- | --- | --- |
| CP-01 | 6 asignaturas acreditadas | Verde |
| CP-02 | 5 acreditadas, 1 no acreditada | Amarillo |
| CP-03 | 4 acreditadas, 2 no acreditadas | Amarillo |
| CP-04 | 3 acreditadas, 3 no acreditadas | Rojo |
| CP-05 | 2 parciales no acreditados en una asignatura | Amarillo |
| CP-06 | Promedio general alto y 3 no acreditadas | Rojo, con precedencia explicada |
| CP-07 | Calificaciones exigibles sin registrar | Información insuficiente |
| CP-08 | Discapacidad visual, todas acreditadas | Verde académico; apoyo independiente |
| CP-09 | Situación emocional sin indicador académico | Sin aumento automático de riesgo |
| CP-10 | Curso especial y resto acreditado | Rojo provisional; revisión |
| CP-11 | Dos reglas válidas de distinta severidad | Mayor severidad; ambas trazadas |
| CP-12 | Fuentes académicas contradictorias | Inconsistencia; revisión |
| CP-13 | Calificación aún no exigible | No se interpreta como reprobación |
| CP-14 | Mismos datos y versión, dos ejecuciones | Mismo resultado |
| CP-15 | Tutor corrige el dato con autorización | Recalcular y registrar auditoría |

## Límites

- El catálogo es **experimental y no aprobado**; cualquier uso operativo requiere validación institucional.
- No sustituye el juicio del tutor, de Servicios Escolares ni de las instancias académicas.
- No incorpora condiciones médicas, discapacidad ni situaciones emocionales como predictores del riesgo académico; esas necesidades se gestionan por separado (`necesidad_apoyo`, `canalizacion`).
- Los umbrales, calendarios y catálogos de carreras del dataset son sintéticos y no representan la oferta educativa vigente del ITTLA.
