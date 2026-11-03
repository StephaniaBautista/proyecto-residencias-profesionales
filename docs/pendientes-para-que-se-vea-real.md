# Qué falta para que el prototipo se vea real

**Corte:** 27 de octubre de 2026
**Alcance de la revisión:** código del backend y del frontend, esquema y datos de la base local, scripts de `seed`/`ingest`, documentación del proyecto y los materiales de la asesoría.
**Referencias internas:** `docs/resultados_pruebas_2026-10-13.md` (límites ya documentados), `docs/reglas-semaforo.md`, `docs/modelo-datos.md`, `docs/instalacion.md`, `docs/manual-uso.md` y el libro `Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx` (63 escenarios).

## Veredicto

La sensación está fundada: el prototipo tiene hardcodeo en tres capas distintas, no solo en textos o datos.

1. **Configuración y dominio:** periodo, institución, catálogos, reglas y parámetros viven en el código.
2. **Datos:** 150 alumnos inventados ad hoc, un solo periodo, cinco cuentas fijas y una contraseña compartida.
3. **Lógica de negocio:** el semáforo y la etiqueta del "modelo" son constantes en TypeScript; el modelo aprende la misma regla que genera la etiqueta; el RAG no tiene corpus cargado.

Lo importante: **los datos sintéticos no son el problema**. Para un prototipo con expedientes reales de por medio son la decisión correcta y están bien documentados. El problema es que hoy **no se puede cambiar nada** —de periodo, de institución, de carrera, de regla, de fuente— sin editar código y volver a sembrar la base. Eso es lo que se percibe como "maqueta".

Además, el proyecto ya reconoce buena parte de esto con honestidad (`docs/resultados_pruebas_2026-10-13.md` admite 0/63 escenarios ejecutados y umbrales experimentales). Entonces "verse real" no es maquillar: es sustituir el andamiaje de demo por configuración, datos trazables y operación.

> **Actualización del 27-oct-2026 (18:30).** El diagnóstico de este documento corresponde al corte de la mañana. Ese mismo día se implementaron H0 completo y la mayor parte de H1: PostgreSQL local con pgvector, periodo/institución/catálogos/reglas/configuración en base de datos, dataset trazable 30/3/540, motor RA-01…RA-08 con estados de calidad de datos, demo gateado por `DEMO_MODE`, paginación, ciclo de vida de acciones, CI y documentación. El estado implementado, lo que sigue pendiente y los criterios actualizados están en **§8** al final del documento. Las cifras e inventarios de §1–§7 son el estado *anterior* y se conservan como evidencia del diagnóstico.

## 1. Las cinco cosas que más lo delatan

> Corte previo a la intervención; se conserva como evidencia.

| # | Señal | Evidencia | Por qué canta |
| --- | --- | --- | --- |
| 1 | **Modelo con exactitud 1.000** | Base local: `modelo_riesgo.metricas.arbol.exactitud = 1`, matriz de confusión diagonal perfecta. Etiqueta en `backend/src/ml/etiqueta.ts:3-23`; entrenamiento en `backend/src/ml/modelo.ts:56-93` | El árbol aprende la misma regla que produce la etiqueta. No predice riesgo: la copia. Un 100 % es señal de fuga de etiqueta, no de calidad. |
| 2 | **Asistente normativo sin corpus** | Base local: `documento_rag` = 0 filas, `fragmento_rag` = 0; `OPENROUTER_API_KEY` vacía en `backend/.env`; `backend/src/rag/rag.service.ts:28-30` responde 503 | La pantalla "Consulta" del demo no puede responder nunca. La ingesta está simulada: 259 fragmentos preparados, 0 indexados. |
| 3 | **Credenciales demo a la vista** | `frontend/src/pages/Acceso.tsx:6-13,88-94`; `backend/scripts/seed.ts:9`; `README.md:27`; `docs/manual-uso.md:3` | Cualquiera con el repo entra como `admin_tecnico` con un clic. Es lo primero que ve un evaluador. |
| 4 | **Un solo periodo académico** | `'2026-1'` fijo en 9 lugares del backend y del frontend (ver §7); base local: 150 trayectorias en un único periodo | El selector de periodo promete un histórico que no existe; Ficha y Alertas ignoran el filtro. |
| 5 | **Los datos de la app no son los del libro de casos** | Semilla: 150 alumnos, 1 periodo, IDs `EST_001…EST_150`, carreras genéricas y materias `SIS-101` (`backend/scripts/seed.ts:10-40`). Libro: 30 alumnos, 3 periodos, 540 registros, IDs `EST-0001…`, carreras reales de ITTLA, asignaturas `ASG-01…` (hojas Estudiantes/Historial) | Ni el volumen, ni los catálogos, ni los IDs coinciden. No hay importador: lo validado en el Excel nunca entra a la aplicación. |

## 2. Inventario del hardcodeo

### 2.1 Configuración y dominio

| Qué está fijo | Dónde | Qué debería ser |
| --- | --- | --- |
| Periodo `2026-1` | 9 puntos en backend y frontend (ver §7) | Tabla `periodo` con activo, fecha de corte y cierre; endpoint de contexto |
| Institución "ITTLA" / Tlalnepantla | `backend/src/rag/prompt.ts:25,29`; `frontend/src/components/Shell.tsx:22`; `frontend/index.html:6`; `frontend/src/pages/Acceso.tsx:51` | Tabla `institucion` y configuración por plantel (`id_institucion` ya está en la especificación) |
| Carreras, grupos, roles, niveles y tipos de acción | CHECKs en `backend/migrations/001_init.sql:22,27`; Zod en `backend/src/comun/validar.ts:23-42`; mapas en `frontend/src/texto.ts:4-35` | Catálogos en base y endpoint `/api/catalogos` (ya existe y el frontend no lo usa) |
| Formato `EST_###` (máximo 999) | `001_init.sql:21`; `validar.ts:36,42` | Identificador opaco/aleatorio; el anonimato no debe depender del rango |
| Dimensión de embeddings 1536 | `001_init.sql:184` frente a `backend/src/entorno.ts:26,42` (configurable) | Migración explícita al cambiar de modelo y validación al arranque |
| Top-k RAG = 4; límites 12/8/40/12/200 | `backend/src/rag/rag.service.ts:112,142`; `tutorados.service.ts:77,90,158`; `admin/admin.controller.ts:34` | Configuración y paginación con metadatos (`total`, `limite`, `offset`) |
| Umbrales del semáforo y de la etiqueta | `backend/src/semaforo/semaforo.ts:22-43`; `backend/src/ml/etiqueta.ts:8-21` | Tabla `regla` versionada con vigencia, prioridad y aprobación |
| Parámetros del modelo (semilla 42, profundidad 4, mínimo 6, 21 árboles) | `backend/src/ml/modelo.ts:58,68-69,285`; `modelo.service.ts:86` | Configuración versionada y registro del experimento |
| Límites de sesión y rate limit | JWT 8 h `backend/src/auth/auth.service.ts:32`; cookie 8 h `auth/cookie.ts:13`; 8 intentos/10 min `auth.service.ts:18`; 30 consultas/h `rag.service.ts:24`; mapa en memoria `comun/limite.ts:1` | Configuración por entorno y almacén compartido (Redis); revocación de sesión |
| Institución y contrato del prompt RAG | `rag/prompt.ts:24-34` | Plantilla por institución y versión, no texto embebido |
| Lista de fuentes del corpus | `backend/corpus/fuentes-rag.json` (archivo en repo) | Tabla de documentos con versión, vigencia, alcance, permisos y quién aprobó |
| Stack local PGlite oculto | `.tmp-pglite/` (gitignored) frente al Supabase que pide el README | Documentar el entorno de demo o estandarizar uno solo |

### 2.2 Datos sintéticos (por qué no "parecen" datos de prueba reales)

- Semilla única y fija: `mulberry32(42)` produce siempre los mismos 150 casos (`seed.ts:47`), pero sin contrato de dataset, sin versión publicada y sin relación con el libro de casos.
- `210` créditos totales, `4` materias por carrera, `4` carreras genéricas y `3` grupos de 50 (`seed.ts:11,20-40,103`).
- Un solo periodo: no hay historia; el anexo técnico pide 3 periodos (2025-2, 2026-1, 2026-2).
- Solo hay resultado final por asignatura: no existe parcial/final, fecha de corte ni fuente (`001_init.sql:62-72`), requisito explícito de la especificación (§15.3).
- No existe el estado "información insuficiente" ni "inconsistencia": un dato faltante no se puede representar porque los `CHECK`/`NOT NULL` lo impiden.
- `estatus_academico` siempre `'inscrito'`, `modalidad` siempre `'Escolarizada'`, `plan_estudios` = "Plan sintético …" (`seed.ts:110-113`).
- Fechas relativas a la fecha del sistema (`seed.ts:279-283`): el dataset cambia cada día que se corre.
- No hay `institucion_id`: cargar datos reales de ITTLA viola los `CHECK` actuales.

### 2.3 Lógica de negocio

| Tema | Hoy | Especificación / realidad |
| --- | --- | --- |
| Semáforo | 5 señales con puntos (70/80/3/50/2) en TypeScript | El anexo técnico define reglas **RA-01 a RA-08** (asignaturas no acreditadas, parciales, curso especial, datos faltantes, INFORMACIÓN INSUFICIENTE, INCONSISTENCIA). No están implementadas. |
| Etiqueta de riesgo | Regla fija distinta del semáforo (`etiqueta.ts`) | No hay etiqueta observada (por ejemplo, "reprobó el siguiente periodo"); sin etiqueta real no hay modelo predictivo. |
| Modelo | Árbol entrenado contra la etiqueta-regla; métricas 1.000 | Debe entrenarse con resultado observado, split temporal, baseline y model card. Mientras tanto: llamarlo "explicador de reglas (demo)" y no mostrar 100 %. |
| Alertas | Recalculadas al vuelo, umbral de 7 días fijo, solo dos tipos | Falta catálogo de reglas/alertas, versionado y cierre de ciclo; "atender" no audita la decisión humana. |
| RAG | Umbral configurable (`RAG_UMBRAL_SIMILITUD`) y abstención correcta | Corpus vacío; sin metadatos de vigencia por documento; top-k fijo; sin verificación de citas. |
| Acciones tutoriales | Se crean, nunca se cierran; `en_seguimiento` perpetuo | Falta ciclo de vida (cumplida/vencida/cancelada) y responsable/fecha de cierre. |
| Datos faltantes | No modelables | Falta estado y bloqueo por cobertura insuficiente. |

## 3. Qué falta para que se vea real (por horizonte)

### H0 · Higiene de demo — 3 a 5 días
Objetivo: que nadie pueda confundir el prototipo con un sistema en operación y que las pantallas no mientan.

- [ ] Cuentas demo detrás de un flag (`DEMO_MODE`/variable de build); en producción, login normal sin botones ni contraseña visible.
- [ ] Banner persistente: "Prototipo con datos sintéticos · reglas experimentales v0.x no aprobadas por ITTLA".
- [ ] `GET /api/catalogos` como fuente de periodo activo, grupos, carreras y etiquetas de dominio. Eliminar `'2026-1'` de frontend y backend (tabla `periodo` mínima).
- [ ] Ficha y Alertas envían y respetan `periodo`; el selector no promete lo que no hay.
- [ ] Paginación o aviso "mostrando X de Y" en casos, próximas revisiones, bitácora y consultas.
- [ ] Manejo de 401/403/404/429/503 en `frontend/src/api.ts`; expiración de sesión con redirección; `ErrorBoundary`; 404 con salida.
- [ ] Traducir enums en pantalla (`en_seguimiento`, `estatus_acuerdo`, `tipo_apoyo`) y no mostrar errores de infraestructura (`OPENROUTER_API_KEY`) al usuario.
- [ ] RAG: ingestar las dos fuentes aprobadas con clave, o deshabilitar "Consulta" con estado "pendiente de habilitación institucional". Nunca una pantalla que falla siempre.
- [ ] Guardas en `seed`/`migrate`/`ingest`: `NODE_ENV`, confirmación explícita, respaldo previo y prohibición del `TRUNCATE` fuera de dev/demo.

### H1 · Núcleo dirigido por datos — 2 a 4 semanas
Objetivo: cambiar periodo, institución, catálogo o regla sin recompilar.

- [ ] Tablas: `institucion`, `periodo`, `catalogo` (carrera, grupo, plan, asignatura), `regla_semaforo` (código RA-xx, versión, vigencia, prioridad, condición, aprobada_por), `evaluacion_riesgo` (versión de reglas, cobertura, razones, reglas activadas), `servicio_asesoria`, `necesidad_apoyo`, `canalizacion`.
- [ ] Motor de reglas que evalúe RA-01…RA-08 con estados verde, amarillo, rojo, **información insuficiente** e **inconsistencia**; guardar reglas activadas y precedencia (rojo > amarillo > verde).
- [ ] Migrar o retirar el semáforo actual: no puede haber dos verdades (regla del anexo frente a puntos del código).
- [ ] Etiqueta de riesgo basada en resultado observado; split temporal; baseline; métricas fuera de muestra; **model card** con límites y sesgos. Mientras no haya datos reales, etiquetar como demostración.
- [ ] Importador del libro de casos (CSV/XLSX) reproducible: 30 estudiantes, 3 periodos, 540 registros; después CSV de SASS/AMBAR. Contrato de dataset versionado.
- [ ] Registro académico con parcial/final, fecha de corte, fuente y oportunidad; posibilidad de "no exigible" y "sin registro".
- [ ] Metadatos completos del corpus (versión, vigencia verificada, institución aplicable, permisos, páginas) y verificación de citas.
- [ ] Dimensiones de embeddings y parámetros RAG/modelo en configuración con validación al arranque.

### H2 · Operable — 3 a 6 semanas
Objetivo: que un equipo pueda desplegarlo, cuidarlo y responder por él.

- [ ] Identidad institucional (SSO o al menos alta/baja, MFA opcional, recuperación de acceso) y asignación tutor–alumno administrable.
- [ ] Entornos dev/test/prod con `NODE_ENV`; `start:prod`; Dockerfile; CI (build + tests + `npm audit` + secret-scan); TLS/reverse proxy; `trust proxy`; shutdown hooks.
- [ ] Migraciones con checksum/lock y sin truncados; respaldos y PITR con restauración probada.
- [ ] RLS con políticas reales, `FORCE` e `institucion_id`; aislamiento por plantel probado.
- [ ] Observabilidad: logs JSON con request-id, métricas, Sentry, readiness real y alertas de error.
- [ ] Resiliencia: rate limit compartido, colas para entrenamiento/alertas, timeout/retry/circuito y tope de costo en OpenRouter, `max_tokens`.
- [ ] Pruebas: integración con Postgres, autorización/aislamiento, e2e Playwright de las 5 pantallas y los 63 escenarios con evidencia.

### H3 · Validez institucional y legal — depende de ITTLA
Objetivo: que el sistema pueda tocar datos reales sin riesgo.

- [ ] Aprobación documentada de reglas, criterios de acreditación, calendario, Pasa Pares y canalización (matriz §20 del anexo técnico).
- [ ] Aviso de privacidad y DPIA conforme a LGPDPPSO (ente público), retención, derechos ARCO, DPA con Supabase/OpenRouter, contrato de datos sintéticos y licencia del corpus.
- [ ] Accesibilidad WCAG 2.1 AA verificada (los 26 casos de estudiante incluyen 10 de accesibilidad).
- [ ] Aislamiento multiplantel (T-12) y control de acceso por institución.
- [ ] Diccionario de datos completo, manual de operación/runbook, plan de respaldos, política de incidentes, model card y matriz de riesgos.

## 4. Si empiezas mañana: cinco pasos en orden

1. **Apagar la mecha legal/seguridad:** cuentas demo detrás de flag, guardas en scripts, aviso de privacidad mínimo, RAG apagado o ingestado.
2. **Periodo y catálogos desde backend:** tabla `periodo`, `/api/catalogos`, cero `'2026-1'` en código.
3. **Reglas RA-01…RA-08 versionadas** y modelo honesto (etiqueta observada o "explicador demo").
4. **Importador del libro de casos** (30/3/540) con contrato de dataset.
5. **E2E de las 5 pantallas + 401 + paginación**, y ejecutar los 63 escenarios con evidencia.

## 5. Definición de "se ve real" (criterios verificables)

- Cambiar de periodo, carrera o institución no requiere tocar código ni volver a sembrar la base.
- Un administrador da de alta un tutor y le asigna tutorados sin ejecutar `seed`.
- Toda decisión de color muestra la regla (RA-xx), su versión y fecha; se puede explicar por qué un alumno es rojo.
- Un caso con datos faltantes se muestra "información insuficiente", no verde ni rojo.
- El modelo reporta métricas sobre etiquetas observadas y fuera de muestra; sugiere y no decide.
- El RAG responde con documento, página, versión y vigencia, o se abstiene; el corpus está cargado y aprobado.
- Ningún error técnico, enum crudo ni credencial aparece al usuario final.
- CI verde con unitarias + integración + e2e; respaldo restaurado en simulacro; aviso de privacidad publicado.
- Los 63 escenarios tienen resultado, evidencia, responsable y fecha (hoy: 0/63).

## 6. Lo que ya está bien y no hay que romper

- Sesión en cookie `HttpOnly` (sin tokens en `localStorage`) y sin `console.log`.
- SQL parametrizado, Zod para entrada y bcrypt con costo 12.
- Filtro por tutor en la API (`tutorados.service.ts:308-311`, `alertas.service.ts:33`, `rag.service.ts:174`).
- Identificadores anónimos, sin nombres ni matrículas.
- Semáforo que no depende solo del color; enlace de salto, `:focus-visible`, `prefers-reduced-motion`, responsive.
- Abstención del RAG explícita y honesta; leyendas desde el backend.
- 17/17 pruebas unitarias pasan (verificado en esta revisión); compilaciones de backend y frontend aprobadas en el corte del 13-oct.
- Documentación que reconoce límites (0/63, umbrales experimentales, corpus sin indexar).
- Sin secretos versionados: `.env` fuera de git y solo placeholder en `.env.example`.

## 7. Anexo: archivos donde vive el hardcodeo

| Ruta | Qué está fijo |
| --- | --- |
| `backend/src/tutorados/tutorados.service.ts:10` | periodo base |
| `backend/src/alertas/alertas.service.ts:8` | periodo |
| `backend/src/alertas/alertas.controller.ts:27` | periodo por defecto |
| `backend/src/tutorados/tutorados.controller.ts:42,70` | periodo por defecto |
| `backend/src/rag/rag.service.ts:142,172` | top-k y periodo |
| `backend/src/semaforo/semaforo.ts:22-43` | umbrales y puntos |
| `backend/src/ml/etiqueta.ts:8-21` | umbrales de etiqueta |
| `backend/src/ml/modelo.ts:58,68-69,285` | semilla y parámetros |
| `backend/src/ml/modelo.service.ts:20,86` | flag en memoria y semilla |
| `backend/src/entorno.ts:23,26-27,37-43` | defaults y mínimos |
| `backend/src/comun/validar.ts:23-42` | enums y formatos |
| `backend/src/comun/limite.ts:1` | rate limit en memoria |
| `backend/src/auth/auth.service.ts:18,32` | límites y expiración |
| `backend/src/auth/cookie.ts:7,13` | `secure` y 8 h |
| `backend/src/main.ts:13-17,21-26` | CSP/HSTS y CORS |
| `backend/migrations/001_init.sql:21-27,184` | CHECKs y dimensión |
| `backend/scripts/seed.ts:9-11,47,51-65,103` | credenciales, dataset y truncado |
| `backend/corpus/fuentes-rag.json` | fuentes en archivo |
| `frontend/src/pages/Acceso.tsx:6-13,18,88-94` | cuentas, contraseña y correo precargado |
| `frontend/src/pages/Tablero.tsx:30` | periodo |
| `frontend/src/pages/Tutorados.tsx:28` | periodo |
| `frontend/src/api.ts:17-20` | parseo y errores |
| `frontend/src/auth.tsx:25-40` | sesión vencida silenciosa |
| `frontend/src/pages/Ficha.tsx:156,186,209-219` | probabilidad 0 %, enum crudo y resultado |
| `frontend/src/pages/Tecnica.tsx:126` | mensaje para desarrollador |
| `frontend/src/texto.ts:4-35` | catálogos duplicados del backend |

## 8. Estado tras la intervención del 27-oct-2026

### 8.1 Implementado

| Área | Estado |
| --- | --- |
| Base de datos | PostgreSQL 17 + pgvector local (`.local-pg`, puerto 54330); `npm run db:local` / `db:local:stop` / `db:local:status` / `db:local:reset`; migraciones 001 y 002; `migrate`, `seed`, `ingest` con guardas. |
| Dominio configurable | Tablas `institucion`, `periodo`, `catalogo_carrera`, `catalogo_grupo`, `configuracion`, `regla_semaforo`, `evaluacion_riesgo`, `evaluacion_parcial`, `curso_especial`, `servicio_asesoria`, `necesidad_apoyo`, `canalizacion`, `solicitud`. |
| Semáforo | Motor RA-01…RA-08 versionado (`RA-2026.2-v1`), precedencia por severidad, estados `informacion_insuficiente` e `inconsistencia`, reglas activadas y cobertura guardadas; `POST /api/admin/semaforo/recalcular`. |
| Datos | Dataset trazable del libro de casos: 30 estudiantes, 540 asignaturas, 90 trayectorias, 360 parciales, 3 periodos; contrato y generador determinista en `backend/datos/`; casos deliberados en 2026-1 (EST-0028/0029/0030). |
| Modelo | Etiqueta observada del periodo siguiente, split temporal, línea base y advertencia automática cuando el árbol no supera la base. Hoy: exactitud 0.50 vs base 0.63 → apoyo explicativo, no validado. |
| RAG | Manifiesto v2 con versión/vigencia/permisos; 2 documentos registrados con metadatos y 0 fragmentos; sin clave la consulta se deshabilita con motivo y el POST devuelve 503 `RAG_NO_CONFIGURADO`; `--dry-run` prepara 259 fragmentos. |
| Autenticación y seguridad | Login real con correo y contraseña; registro público configurable (`permitir_registro`) y recuperación de contraseña con token de un solo uso de 30 min (migración 003); la interfaz ya no muestra cuentas demo ni franja de prototipo (los endpoints de demo quedan sólo para QA con `DEMO_MODE`); JWT con `token_version` (revocación), cookie HttpOnly con duración configurable, límite de intentos persistente (429), validación de `Origin` con lista, CORS por lista y guardas en scripts destructivos. |
| API/UX | `GET /api/contexto`, periodo activo y catálogos desde backend, paginación con totales, manejo 401/403/404/429/503, `ErrorBoundary`, enums traducidos, estados nuevos visibles, cierre de acciones y nota de prototipo discreta al pie (sin franja de alerta). |
| Operación y docs | CI GitHub Actions con servicio pgvector; `.env.example` completo; README y 4 documentos reescritos; resultados del corte en `docs/resultados_pruebas_2026-10-27.md`. |

### 8.2 Sigue pendiente

- **Ingesta real del corpus:** requiere `OPENROUTER_API_KEY` (tiene costo). Por decisión del usuario el RAG quedó listo pero apagado. Comando: `OPENROUTER_API_KEY=... npm run ingest`.
- **Modelo:** sólo 60 pares sintéticos; el árbol no supera la línea base. No presentarlo como validado hasta tener datos observados más amplios y una model card formal.
- **H2 operación:** SSO/MFA institucional; alta/baja administrable de usuarios y asignaciones; respaldos y PITR con restauración probada; RLS con policies y aislamiento multiplantel efectivo (hoy la autorización vive en la API); observabilidad completa (métricas/trazas/Sentry); colas para entrenamiento y alertas; tope de costo del proveedor; e2e Playwright automatizado; ejecución de los 63 casos del libro.
- **H3 institucional y legal:** aprobación documentada de reglas y fuentes; aviso de privacidad y DPIA (LGPDPPSO); retención y ARCO; DPA con Supabase/OpenRouter; accesibilidad WCAG auditada; multiplantel probado; diccionario de datos completo; runbook y política de incidentes.
- **Integraciones reales:** importación desde SASS/AMBAR/Servicios Escolares; hoy sólo dataset sintético.
- **Correo y cuentas:** integrar proveedor de correo para la recuperación (hoy el enlace sólo se entrega en demo/desarrollo); en producción, verificar correo o aprobar cuentas desde coordinación (`permitir_registro=false`).
- **Vista Técnica:** muestra modelo, corpus y bitácora; las reglas y el recálculo ya están en la API (panel de UI opcional).
- **Pruebas:** 27 unitarias; CI corre migrate+seed como humo, pero aún no hay suite de integración ni e2e en el pipeline.

### 8.3 Criterios actualizados de "se ve real"

- [x] Cambiar periodo, institución, carrera o regla no requiere editar código (tablas + semilla).
- [x] Un administrador puede recalcular el semáforo y consultar el catálogo de reglas sin tocar código.
- [x] Toda decisión de color muestra RA-xx, versión y reglas activadas; los estados de datos son visibles.
- [x] Los casos con dato faltante o contradictorio se muestran como información insuficiente o inconsistencia, nunca como verde/rojo.
- [x] El modelo reporta métricas fuera de muestra, línea base y advertencia; no decide.
- [ ] El RAG responde con cita verificada (requiere la ingesta con clave).
- [x] Ningún error técnico, enum crudo ni credencial demo aparece al usuario final.
- [ ] CI verde con integración + e2e; respaldo restaurado en simulacro; aviso de privacidad publicado.
- [ ] 63/63 escenarios de aceptación con evidencia.

