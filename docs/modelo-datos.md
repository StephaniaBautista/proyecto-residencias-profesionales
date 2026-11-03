# Modelo de datos

El esquema vive en `backend/migrations/` y se aplica con `npm run migrate`. Hay dos migraciones:

- `001_init.sql` — esquema base del prototipo (usuarios, estudiantes, trayectoria, tutoría, alertas, RAG, bitácora y modelo).
- `002_configuracion_institucional.sql` — configuración institucional, catálogos, reglas versionadas, calidad de datos, evaluaciones parciales, metadatos del RAG y operación.

Los datos de arranque (institución, periodos, catálogos, reglas y configuración) los carga `npm run seed` desde `backend/datos/*.json`; el dataset académico se genera con `backend/datos/extraer.py` y se documenta en `backend/datos/CONTRATO.md`.

> Todo el contenido es **sintético**: no hay nombres, matrículas, CURP ni otra información personal. El identificador público es anónimo (`EST-0001`…`EST-0030`).

## Qué es sintético y qué es derivado

| Origen | Qué incluye |
| --- | --- |
| **Sintético (generado)** | Estudiantes, identificadores anónimos, historial de 540 registros de asignatura (6 por estudiante y periodo), evaluaciones parciales del periodo activo, curso especial, sesiones/acciones de tutoría, revisiones, alertas iniciales, necesidades de apoyo, canalizaciones y solicitudes. Se generan de forma determinista desde el libro de casos `Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx`. |
| **Sintético (configuración)** | Institución, periodos, carreras, grupos, reglas RA-01…RA-08, parámetros de `configuracion` y directorio de asesorías. Se cargan desde JSON y son editables en base. |
| **Derivado (calculado)** | Promedio, créditos, avance curricular, materias reprobadas y cobertura de datos a partir de los 540 registros; etiqueta de riesgo observado del periodo siguiente; evaluación del semáforo (`evaluacion_riesgo` y columnas espejo en `trayectoria_periodo`); modelo entrenado (`modelo_riesgo`); alertas recalculadas. |
| **Documental (real, con vigencia por validar)** | PDFs del corpus RAG (Programa de Tutorías TecNM 2022 y Manual del Tutor SNIT 2013) y sus fragmentos/embeddings. Son documentos reales, pero su vigencia para ITTLA está pendiente de validación y así se registra. |

Columnas de trazabilidad en `estudiante`: `fuente_sintetica` (`generado_sinteticamente`), `version_dataset` (por ejemplo `v1.0`) y `fecha_generacion`. Las tablas de evaluación guardan `version_reglas`, `periodo_referencia` y `calculado_en`.

## Familias de tablas

### Configuración institucional

| Tabla | Guarda |
| --- | --- |
| `institucion` | Plantel: clave (`ITTLA`), nombre, nombre corto, `activa`. Base del aislamiento institucional. |
| `periodo` | Periodos por institución: `clave` (`2025-2`, `2026-1`, `2026-2`), nombre, fechas de inicio/fin, `activo` y `cerrado`. Un índice parcial garantiza **un solo periodo activo por institución**. |
| `catalogo_carrera` | Carreras activas de la institución (clave y nombre). Sustituye el `CHECK` de carreras en `estudiante`. |
| `catalogo_grupo` | Grupos activos de la institución (clave y nombre). Sustituye el `CHECK` de grupos. |
| `configuracion` | Parámetros clave-valor en `jsonb`: banner, versión de reglas, leyendas, top-k del RAG, tamaños de página y límites de listas, créditos del plan, `reglas_aprobadas`, `datos_aprobados`, etc. `visible_ui` decide qué se expone a la interfaz mediante `GET /api/contexto`. |

### Reglas y evaluación del semáforo

| Tabla | Guarda |
| --- | --- |
| `regla_semaforo` | Catálogo versionado de reglas RA-01…RA-08. Por fila: `codigo`, `version`, `prioridad`, `nivel` (`verde`, `amarillo`, `rojo`, `informacion_insuficiente`, `inconsistencia`), `titulo`, `descripcion`, `condicion` (`jsonb` declarativo), `accion`, `vigencia_desde`/`vigencia_hasta`, `activa`, `aprobada_por`, `aprobada_en`. Única por institución, código y versión. |
| `evaluacion_riesgo` | Resultado de evaluar el catálogo para un estudiante y periodo: `version_reglas`, `periodo_referencia`, `estado_datos` (`clasificado`, `informacion_insuficiente`, `inconsistencia`), `nivel`, `puntos`, `reglas_activadas` (`jsonb` con todas las reglas aplicadas), `cobertura_datos` (`jsonb`), `calculado_en`. Una fila por estudiante, periodo y versión. |

### Registro académico

| Tabla | Guarda |
| --- | --- |
| `estudiante` | Tutorado anónimo: `id_anonimo` (`EST-0001`…), `institucion_id`, carrera, semestre, generación, plan de estudios, modalidad, grupo, estatus académico, tutor asignado y trazabilidad del dataset. |
| `trayectoria_periodo` | Un corte por estudiante y periodo: créditos, promedio, materias reprobadas, asistencia, avance curricular, acuerdos vencidos, `puntos_alerta`, `nivel_alerta`, `senales`, `accion_sugerida`. Desde la 002: `version_reglas`, `periodo_referencia`, `estado_datos`, `reglas_activadas`, `cobertura_datos` y `riesgo_observado` (etiqueta del siguiente periodo). |
| `asignatura_resultado` | Resultado final por estudiante, periodo y asignatura: clave, nombre, créditos, calificación (puede ser nula), `resultado` (`aprobado`, `reprobado`, `sin_registro`) y oportunidad. 540 filas en el dataset. |
| `evaluacion_parcial` | Evaluaciones parciales del periodo actual: asignatura, `numero`, calificación (nula si no hay registro), `exigible`, `acreditada` y `fuente`. Permite distinguir dato faltante, dato no exigible y contradicción (RA-05, RA-07). |
| `curso_especial` | Cursos especiales registrados por estudiante y periodo (RA-06): clave, nombre, `registrado`, `fuente`. |

### Acompañamiento tutorial

| Tabla | Guarda |
| --- | --- |
| `sesion_tutorial` | Sesión con fecha, tipo, motivo, acuerdos, fecha de compromiso y estatus del acuerdo (`pendiente`, `cumplido`, `vencido`). |
| `accion_tutorial` | Compromiso registrado por tutoría: tipo, fecha de compromiso, estatus (`en_seguimiento`, `cumplida`, `vencida`, `cancelada`), observación y autor. |
| `revision_ficha` | Revisión de asesoría: `aprobada`, `requiere_ajuste` o `informacion_insuficiente`, comentario, revisor y fecha. |
| `alerta` | Alertas operativas: tipo (`rojo_sin_revision`, `accion_por_vencer`, `datos_incompletos`, `inconsistencia_datos`), mensaje, prioridad, estado (`pendiente`/`atendida`) y referencia. Índices parciales evitan duplicados pendientes. |
| `intervencion_apoyo` | Intervención de prueba: tipo de apoyo, taller, área responsable, fechas, asistencia y resultado. |

### Necesidades, canalización y asesorías

| Tabla | Guarda |
| --- | --- |
| `servicio_asesoria` | Directorio de asesorías: área, asignatura, modalidad, día, horario, vigencia, estado de validación, fuente y fecha de validación. Los horarios del dataset son ficticios y están marcados como «por validar». |
| `necesidad_apoyo` | Necesidad manifestada por el estudiante: categoría, descripción, origen, estado. **Sin diagnósticos** y sin certificados médicos; se mantiene separada del semáforo académico. |
| `canalizacion` | Orientación a un área u organismo: categoría, área sugerida, institución destino, estatus, fecha de confirmación y nota. No presume atención efectiva. |
| `solicitud` | Solicitudes administrativas o de acompañamiento: tipo, estado, área y nota. |

### RAG documental

| Tabla | Guarda |
| --- | --- |
| `documento_rag` | Documento fuente: título, emisor, archivo, `version`, `fecha_documento`, `institucion_aplicable`, `vigencia_verificada`, `permisos`, `paginas`, `url`, `aprobada_por`/`aprobada_en`, `fragmentos` e `ingestado_en`. |
| `fragmento_rag` | Fragmentos con `pagina`, texto, `embedding` (`vector(1536)`) y numeración por documento; índice HNSW por similitud de coseno. |
| `consulta_rag` | Pregunta, respuesta (`jsonb`, con fuentes y avisos de vigencia), indicador de abstención, usuario y estudiante opcional. |

### Seguridad, auditoría y modelo

| Tabla | Guarda |
| --- | --- |
| `usuario` | Cuenta y rol (`tutor`, `coordinacion`, `asesoria`, `admin_tecnico`), `institucion_id`, hash de contraseña, `activo` y `token_version` (permite revocar sesiones). |
| `bitacora` | Auditoría de ingresos, acciones, revisiones, consultas, recálculos y entrenamientos. |
| `limite_acceso` | Contador persistente de intentos/consultas por clave y ventana; reemplaza el mapa en memoria. |
| `recuperacion_password` | Solicitudes de restablecimiento: `usuario_id`, hash SHA-256 del token de un solo uso, `expira_en`, `usado`, IP y fecha. El token original nunca se guarda. |
| `modelo_riesgo` | Versión entrenada: algoritmo, `tipo` (`predictivo`/`explicador`), `motivo`, `metricas` (`jsonb`), `modelo` (`jsonb`), definición de etiqueta, registros de entrenamiento y prueba, advertencia y fecha. |
| `schema_migrations` | Migraciones aplicadas (id y fecha). |

## RLS, roles y privilegios

- **Row Level Security activo** en todas las tablas de datos, incluidas las nuevas de la 002 (`institucion`, `periodo`, catálogos, `configuracion`, `regla_semaforo`, `evaluacion_parcial`, `curso_especial`, `evaluacion_riesgo`, `servicio_asesoria`, `necesidad_apoyo`, `canalizacion`, `solicitud`, `limite_acceso`) y de la 003 (`recuperacion_password`).
- **Sin políticas para `anon` ni `authenticated`**: la API de datos de Supabase no puede leer ni escribir estas tablas; los privilegios se revocan explícitamente y se ajustan los privilegios por defecto del esquema `public` cuando esos roles existen.
- **La API entra con el rol dueño** (el usuario de `DATABASE_URL`), que omite RLS. La autorización real la aplica la API: `AuthGuard` valida la cookie de sesión y `RolesGuard` restringe rutas por rol; el filtro por tutor se aplica en las consultas, no en el navegador.
- **Aislamiento por institución:** las tablas configurables llevan `institucion_id`; las consultas resuelven la institución activa desde la base. Las políticas RLS `FORCE` y el aislamiento multiplantel completo son trabajo futuro (el prototipo opera una sola institución).
- **Producción:** `npm run seed` se bloquea con `NODE_ENV=production`, y `DEMO_MODE=false` deshabilita las cuentas demo.

## Índices

| Índice | Para qué |
| --- | --- |
| `estudiante_tutor_id_idx`, `estudiante_grupo_idx`, `estudiante_institucion_idx` | Filtros por tutor, grupo e institución |
| `trayectoria_periodo_periodo_nivel_idx` | Conteos del tablero por periodo y nivel |
| `asignatura_resultado_estudiante_id_idx` | Historial por estudiante |
| `evaluacion_parcial_estudiante_idx` | Parciales por estudiante y periodo |
| `curso_especial_estudiante_idx` | Cursos especiales por estudiante y periodo |
| `evaluacion_riesgo_periodo_idx` | Evaluaciones por periodo, estado de datos y nivel |
| `periodo_activo_unico_idx` (parcial) | Garantiza un solo periodo activo por institución |
| `regla_semaforo_vigente_idx` | Reglas activas por institución y versión |
| `alerta_estado_periodo_idx`, índices parciales únicos | Alertas pendientes sin duplicados |
| `accion_tutorial_estatus_fecha_idx` | Próximas revisiones y acciones por vencer |
| `limite_acceso_clave_marca_idx` | Ventana de rate limit |
| `bitacora_creado_en_idx` | Bitácora reciente |
| `fragmento_rag_documento_id_idx` | Fragmentos por documento |
| `fragmento_rag_embedding_hnsw` | Búsqueda vectorial por coseno |

## Cómo agregar una migración

1. Crea `backend/migrations/003_descripcion.sql` con los cambios y, si aplica, sus índices.
2. Usa `create extension if not exists vector with schema extensions;` solo en la primera migración; las siguientes asumen pgvector instalado.
3. Ejecuta `npm run migrate`: cada archivo se aplica una sola vez dentro de una transacción y se registra en `schema_migrations`.
4. Si cambias la dimensión de embeddings, actualiza `EMBEDDING_DIMENSIONES`, la columna `vector(n)` y vuelve a ejecutar `npm run ingest`.
5. Mantén `normal` el nombre y el orden; `migrate` ordena alfabéticamente los archivos.
