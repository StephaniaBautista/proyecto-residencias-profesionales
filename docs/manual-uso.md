# Manual de uso

Este manual recorre el prototipo de apoyo tutorial del ITTLA con el dataset sintético de **30 estudiantes**, **3 periodos** (`2025-2`, `2026-1` y `2026-2`, con `2026-2` como activo) y **540 registros** académicos.

En las pantallas de acceso, la nota «Prototipo de residencia profesional · Datos sintéticos · Reglas experimentales no aprobadas por ITTLA» aparece al pie. Dentro de la app, ese aviso vive en **«Acerca de este prototipo»**, en el menú lateral. El acceso es un formulario normal de correo y contraseña, sin franjas de alerta ni listas de cuentas de prueba.

## Acceso

### Iniciar sesión

Abre <http://localhost:5173>. Si no hay sesión, la aplicación te lleva a la pantalla de acceso, donde entras con **correo y contraseña** (`POST /api/auth/ingreso`).

- No hay cuentas ni contraseñas publicadas en el repositorio ni en el bundle del frontend.
- Para roles de coordinación, asesoría y administración técnica puedes usar las cuentas que crea `npm run seed`: la semilla imprime **una sola vez** sus correos y la contraseña compartida (la definida en `DEMO_PASSWORD` o una aleatoria). Ese valor es solo para desarrollo.
- Si la sesión expira o la API responde `401`, la interfaz te devuelve al acceso con un aviso, sin dejar pantallas a medias.
- El botón **Salir** invalida la sesión en la API y borra la cookie.

### Crear cuenta

1. En la pantalla de acceso elige **Crear cuenta**.
2. Captura **nombre**, **correo**, **contraseña** y **confirmación de contraseña**.
3. La contraseña debe tener al menos **10 caracteres**, con al menos una letra y un número; el correo no puede repetirse.
4. Al registrarte, la cuenta queda **activa con rol de tutoría** y la sesión se inicia automáticamente. Llegas a **Inicio** con un **estado vacío**: una cuenta nueva no tiene estudiantes asignados hasta que coordinación se los asigne; no es un error.
5. El registro puede desactivarse en la configuración (`permitir_registro`). Si el enlace no aparece, es porque la institución lo deshabilitó.

### Recuperar contraseña

1. En el acceso elige **¿Olvidaste tu contraseña?** Si el enlace no aparece, la institución deshabilitó la recuperación (`recuperacion_habilitada`).
2. Escribe tu correo. La API (`POST /api/auth/recuperar`) responde siempre de la misma forma, exista o no la cuenta, para no revelar qué correos están registrados.
3. Si la cuenta existe, se genera un token de **un solo uso válido por 30 minutos**. En desarrollo/demo el backend devuelve el token y la interfaz ofrece continuar al restablecimiento; en **producción** el token no se muestra: el envío por correo requiere un proveedor externo, que está **pendiente**.
4. Si no recibes nada en producción, es una limitación conocida, no un fallo de la cuenta.

### Restablecer contraseña

1. Abre el enlace de restablecimiento (o el botón de continuación en desarrollo/demo).
2. Captura la **nueva contraseña** y su confirmación; aplican las mismas reglas (mínimo 10 caracteres, letra y número).
3. `POST /api/auth/restablecer` valida que el token siga vigente y sin usar, guarda la contraseña nueva, **revoca las sesiones anteriores** e invalida el token.
4. Vuelve a iniciar sesión con la contraseña nueva.

## Roles

| Rol | Qué puede hacer |
| --- | --- |
| **Tutoría** | Ve y filtra **solo sus estudiantes** (una cuenta nueva empieza sin ninguno), abre fichas, registra y cierra acciones de seguimiento y consulta el asistente. |
| **Coordinación** | Ve los 30 estudiantes de todos los grupos y periodos. Consulta fichas y alertas; no registra acciones tutoriales. |
| **Asesoría** | Ve todo y registra la revisión de una ficha: aprobada, requiere ajuste o información insuficiente. |
| **Administración técnica** | Además de consultar, abre la pantalla **Administración**: métricas del modelo, reglas, estado del corpus RAG y bitácora. |

El acceso se resuelve con sesión en cookie `HttpOnly`; el filtro por tutor y por institución se aplica en la API, nunca en el navegador.

## Navegación

La barra lateral (y el menú desplegable en pantallas pequeñas) organiza la app en **Inicio**, **Estudiantes**, **Alertas**, **Asistente** y, solo para administración técnica, **Administración**. Las rutas anteriores redirigen a las nuevas: `/tablero` → `/inicio`, `/tutorados` → `/estudiantes`, `/tutorados/:id` → `/estudiantes/:id`, `/consulta` → `/asistente` y `/tecnica` → `/administracion`.

## Recorrido sugerido

### 0. Antes de empezar: los tres periodos

El selector de periodo no es decorativo. El dataset tiene tres cortes:

| Periodo | Qué representa |
| --- | --- |
| `2025-2` | Primer corte del dataset. No tiene periodo anterior, así que **todos** los casos aparecen como **información insuficiente**: sirve para explicar el estado de calidad de datos y no debe leerse como un semáforo histórico. |
| `2026-1` | Corte con historial clasificado y corte de referencia del periodo activo: aquí viven el dato faltante deliberado (`EST-0029`/`EST-0030`) y la contradicción deliberada (`EST-0028`). |
| `2026-2` | Periodo **activo** por omisión. Su semáforo se calcula contra `2026-1`, así que muestra los cinco estados: 7 verde, 14 amarillo, 6 rojo, 2 información insuficiente y 1 inconsistencia. Concentra además el curso especial (`EST-0027`) y los parciales de RA-05. |

Para una demostración corta alcanza con el periodo activo (`2026-2`); ahí ya se ven los cinco estados. `2025-2` sirve para explicar por qué no se clasifica un corte sin historial.

### 1. Inicio (`/inicio`)

- El **periodo activo** viene de la configuración de la base (`GET /api/contexto`) y aparece en el selector junto con los demás periodos. Cambiar de periodo recalcula los conteos, los casos y las alertas de Inicio.
- Los conteos muestran **Verde**, **Amarillo**, **Rojo**, **Información insuficiente** e **Inconsistencia**, con su nombre además del color.
- La lista de casos prioritarios y de próximas revisiones indica si se está mostrando un subconjunto («mostrando X de Y»); el total no se oculta.
- La leyenda del semáforo forma parte de la pantalla; el aviso de prototipo está en **«Acerca de este prototipo»**, en el menú lateral.

### 2. Estudiantes (`/estudiantes`)

- Listado de **Estudiantes** paginado (25 por página por omisión) con el total de resultados: usa la paginación para recorrer el dataset.
- Filtros por **periodo**, **grupo** y **nivel** (incluidos los estados de calidad de datos). El filtro de periodo se conserva al abrir una ficha y al volver.
- El aviso «Mostrando X–Y de N» indica en qué página estás y el total del filtro.
- Una cuenta nueva de tutoría sin asignaciones muestra el estado vacío correspondiente en **Estudiantes** y en **Inicio**.

### 3. Ficha de estudiante (`/estudiantes/:id`)

La ficha de estudiante es la pantalla central. Se compone de:

- **Identificación:** `EST-0001`…`EST-0030`, carrera, semestre, grupo y generación. El identificador es anónimo; no hay nombres ni matrículas.
- **Semáforo:** nivel, puntos y la lista de **reglas RA-xx activadas**, con su versión y la acción sugerida. Si el caso es **Información insuficiente** o **Inconsistencia**, la ficha lo explica y muestra qué datos faltan o se contradicen; no presenta el caso como verde ni rojo.
- **Trayectoria:** promedio del periodo, asistencia, materias reprobadas, avance curricular y créditos. Los datos del periodo anterior son el corte de referencia de RA-01…RA-04; los parciales del periodo actual alimentan RA-05.
- **Asignaturas y parciales:** resultados por asignatura y, cuando existen, evaluaciones parciales con su carácter exigible. Una calificación ausente se muestra como ausente, no como cero.
- **Seguimiento:** sesiones de tutoría, acciones registradas y revisiones de asesoría.
- **Modelo de riesgo:** aparece como **sugerencia** separada del semáforo, con su leyenda. Si no hay probabilidad disponible se muestra «—». El modelo **no** cambia el color.

Acciones según el rol:

- **Tutoría:** registrar una acción (entrevista, asesoría disciplinar, taller, canalización o seguimiento) con fecha de compromiso y observación. También puede **cerrar** una acción con estatus cumplida, vencida o cancelada (`POST /api/tutorados/:id/acciones/:accionId/cerrar`); al cerrarla deja de generar la alerta de «acción por vencer».
- **Asesoría:** guardar una revisión con estatus **aprobada**, **requiere ajuste** o **información insuficiente** y un comentario. Con ello se cierra la alerta de «rojo sin revisión» de ese caso, si existía.
- **Coordinación:** solo lectura; puede revisar cualquier grupo y periodo.

### 4. Alertas

- Se listan las alertas del periodo: **rojo sin revisión**, **acción por vencer** (compromiso en los próximos 7 días o vencido), **datos incompletos** e **inconsistencia de datos**. Con el dataset recién sembrado y periodo activo `2026-2` hay 9 alertas pendientes: 6 de rojo sin revisión, 2 de datos incompletos y 1 de inconsistencia.
- Atender una alerta registra la decisión humana y la bitácora; **no cambia el color**. El color solo se recalcula cuando cambian los datos o la versión de reglas.
- El filtro de periodo aplica también aquí: no se mezclan alertas de periodos distintos.

### 5. Asistente (`/asistente`)

- Si `OPENROUTER_API_KEY` no está configurada, la pantalla aparece **deshabilitada con el motivo**; `GET /api/contexto` devuelve `rag.habilitado = false` y `POST /api/consultas` responde 503 `{ "codigo": "RAG_NO_CONFIGURADO" }`, no un error crudo ni un botón que siempre falla. La semilla registra los 2 documentos del corpus con sus metadatos, pero deja 0 fragmentos indexados: hasta que no se ejecute la ingesta real, el asistente no puede responder.
- Con el corpus ingestado, escribe una pregunta sobre tutoría (por ejemplo, qué debe registrar el seguimiento). La respuesta cita **documento, fragmento y página**, además de la **versión** y la **vigencia** declarada de la fuente.
- Si el mejor fragmento no supera el umbral de similitud, el asistente se abstiene («No se encontró evidencia suficiente en los documentos autorizados cargados») en lugar de inventar.
- El historial de consultas recientes permite volver a abrir una respuesta con sus fuentes.
- Las fuentes del corpus tienen **vigencia local por validar**; la interfaz lo advierte en cada cita. El asistente no sustituye la normativa vigente ni la asesoría humana.

### 6. Administración (`/administracion`, solo administración técnica)

- **Modelo:** algoritmo, versión, etiqueta con la que se entrenó, número de registros de entrenamiento y prueba, métricas fuera de muestra (exactitud, precisión, recall, matriz de confusión), línea base y advertencia. El modelo es de tipo `predictivo` y aprende del **riesgo observado del siguiente periodo** con división temporal (30 registros de entrenamiento y 30 de prueba). Con el dataset actual, el árbol reporta exactitud 0.50 frente a una línea base de 0.63 (clase mayoritaria «medio»), por lo que la vista muestra la advertencia de que debe tratarse como **apoyo explicativo y no como predicción validada**; el bosque (0.633) y la regresión logística se muestran solo como comparación.
- **Reglas:** `GET /api/admin/reglas` (y la tabla `regla_semaforo`) lista el catálogo vigente con código, prioridad, nivel, condición, vigencia y datos de aprobación, para auditar por qué se aplicó RA-xx. `POST /api/admin/semaforo/recalcular` vuelve a evaluar el periodo activo con la versión vigente y actualiza evaluaciones, alertas y bitácora.
- **Corpus:** documentos RAG con emisor, versión, fecha, vigencia verificada, permisos y número de fragmentos. La semilla registra los 2 documentos con metadatos pero **0 fragmentos indexados**, por eso la consulta está deshabilitada hasta correr la ingesta con clave.
- **Bitácora:** ingresos, registros, acciones, revisiones, consultas y recálculos, con fecha y usuario; el listado está paginado y se puede ampliar el tamaño de página.

## Casos concretos para una demostración

El dataset incluye casos deliberados que se pueden abrir en el periodo indicado (requiere una cuenta con alcance sobre ese grupo: administración técnica, coordinación o asesoría; tutoría ve solo sus grupos):

| Caso | Periodo visible | Qué demuestra |
| --- | --- | --- |
| `EST-0029` y `EST-0030` | `2026-2` | **Información insuficiente**: falta una calificación del corte de referencia `2026-1` (`sin_registro`). La ficha lista el faltante (`RA-07`) y la cobertura de datos. |
| `EST-0028` | `2026-2` | **Inconsistencia**: en `2026-1` la calificación 74 no concuerda con el resultado `reprobado`; el caso se bloquea para validación (`SIS-INC`). |
| `EST-0027` | `2026-2` | **Rojo por curso especial** (`RA-06`), con acción de revisión y validación con Servicios Escolares. |
| `EST-0004`, `EST-0005`, `EST-0006`, `EST-0011`, `EST-0012` | `2026-2` | **Rojo** por tres o más asignaturas no acreditadas en el corte anterior (`RA-04`). |
| `EST-0019` y `EST-0026` | `2026-2` | **Amarillo** por dos parciales exigibles no acreditados en la misma asignatura (`RA-05`). |
| Cualquier estudiante | `2025-2` | Primer corte sin periodo anterior: todos aparecen como **información insuficiente**, por diseño del dataset. |

Para ver una acción de tutoría y su alerta: entra con una cuenta de **tutoría**, registra una acción en un caso rojo de `2026-2` y revisa **Alertas**. Para cerrar el ciclo: entra con la cuenta de **asesoría**, guarda una revisión en ese mismo caso y vuelve a Alertas; o cierra la acción desde la ficha como tutoría y observa cómo deja de estar pendiente.

## Preguntas frecuentes

- **No tengo cuenta, ¿cómo entro?** Usa **Crear cuenta** si el registro está habilitado, o pide a coordinación/administración que te dé acceso. En una instalación de desarrollo puedes usar las cuentas sembradas, cuyos correos y contraseña se imprimen una sola vez al correr `npm run seed`.
- **Acabo de crear mi cuenta y no veo estudiantes.** Es el comportamiento esperado: una cuenta nueva de tutoría no tiene estudiantes asignados hasta que coordinación se los asigne.
- **No me llegó el correo de recuperación.** En producción el envío por correo aún no está integrado (limitación conocida); en desarrollo/demo el token aparece en pantalla para continuar el flujo.
- **¿Por qué un alumno es rojo?** Abre la ficha: la lista de reglas activadas indica el código RA-xx, la condición cumplida y la acción sugerida. Puedes auditar la evaluación en `evaluacion_riesgo.reglas_activadas`.
- **¿Por qué un caso dice «información insuficiente»?** Porque falta el corte de referencia, hay calificaciones exigibles sin registrar o no hay resultados del periodo anterior. La ficha indica qué falta para que el área responsable lo capture.
- **¿Por qué un caso dice «inconsistencia»?** Porque dos datos se contradicen (por ejemplo, una asignatura reprobada con calificación aprobatoria o fuentes duplicadas). El caso queda bloqueado para validación humana.
- **¿Puedo cambiar el periodo activo?** Lo define la configuración de la base (`periodo.activo`), no la pantalla. Es parte de la configuración institucional, no del uso diario.
- **¿Los colores son oficiales?** No. Son reglas experimentales (`RA-2026.2-v1`) no aprobadas por el TecNM ni por el ITTLA; la nota al pie lo recuerda.
- **¿Puedo usar datos reales?** No en este prototipo. El dataset es sintético y trazable; el uso con expedientes reales requiere aprobación institucional, aviso de privacidad y controles adicionales.
