# Registro de validación del prototipo (corte 27-oct-2026)

**Corte de implementación:** 27 de octubre de 2026
**Verificación final:** 28 de octubre de 2026
**Alcance:** prototipo local con datos sintéticos, PostgreSQL 17 + pgvector, dataset trazable al libro de casos, reglas RA-01…RA-08 configurables, modelo de riesgo con etiqueta observada y RAG con metadatos.
**Este documento sustituye como referencia al corte del 13-oct-2026** (que se conserva como registro histórico).

## Entorno verificado

| Componente | Versión / estado |
| --- | --- |
| Node.js | 26.8.1 |
| PostgreSQL local | 17.11 (Homebrew), base `apoyo_tutorial`, puerto 54330 |
| pgvector | 0.8.7 |
| Backend | NestJS 11, API en `http://127.0.0.1:3100` (3000 ocupado por otro proyecto del equipo) |
| Frontend | Vite + React 19, `http://127.0.0.1:5173` con proxy `/api` a 3100 |

## Datos cargados por la semilla

`npm run migrate && npm run seed -- --reemplazar` deja:

| Elemento | Valor |
| --- | --- |
| Estudiantes | 30 (EST-0001…EST-0030) |
| Asignaturas (Historial) | 540 (6 por estudiante y periodo) |
| Trayectorias | 90 (30 × 3 periodos) |
| Parciales | 360 |
| Evaluaciones de riesgo guardadas | 90 |
| Periodos | 2025-2, 2026-1 y 2026-2 (activo 2026-2) |
| Documentos RAG registrados | 2 (con metadatos, 0 fragmentos indexados) |

### Resultado del semáforo por periodo

| Periodo | Verde | Amarillo | Rojo | Información insuficiente | Inconsistencia |
| --- | --- | --- | --- | --- | --- |
| 2025-2 | 0 | 0 | 0 | 30 | 0 |
| 2026-1 | 4 | 18 | 6 | 2 | 0 |
| **2026-2 (activo)** | **7** | **14** | **6** | **2** | **1** |

- 2025-2 aparece como información insuficiente porque no tiene periodo de referencia anterior: es el comportamiento correcto de RA-07, no un fallo.
- Los casos deliberados del dataset están en 2026-1, que es el corte de referencia del periodo activo:
  - **EST-0028** → inconsistencia en 2026-2 (calificación 74 con resultado “reprobado”).
  - **EST-0029 y EST-0030** → información insuficiente en 2026-2 (resultado `sin_registro` en 2026-1).
- Reglas activadas en 2026-2: RA-01 (7), RA-02 (9), RA-03 (6), RA-04 (5), RA-05 (2), RA-06 (1), RA-07 (2), RA-08 (1), SIS-INC (1).
- Alertas pendientes en 2026-2: **9** (6 rojo sin revisión, 2 datos incompletos, 1 inconsistencia).

## Modelo de riesgo

| Métrica | Valor |
| --- | --- |
| Tipo | `predictivo` (etiqueta observada del periodo siguiente) |
| Entrenamiento / prueba | 30 / 30 pares, split temporal (2025-2→2026-1 entrena; 2026-1→2026-2 prueba) |
| Exactitud árbol | 0.50 |
| Exactitud bosque (comparación) | 0.633 |
| Línea base (clase mayoritaria “medio”) | 0.63 |
| Advertencia emitida por el sistema | “El árbol no supera la línea base…; el conjunto de prueba es pequeño. Debe tratarse como apoyo explicativo, no como predicción validada.” |

El modelo **no** se presenta como validado. La ficha y la vista técnica muestran el tipo, la etiqueta, los registros de entrenamiento/prueba y la advertencia.

## Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| Pruebas unitarias backend (`npm test`) | **27 aprobadas, 0 fallidas, 6 suites** (motor RA-01…RA-08, etiqueta/métricas/modelo, RAG de fuentes, abstención y contrato de respuesta) |
| Compilación backend (`npm run build`) | OK |
| Compilación frontend (`npm run build`, `tsc` estricto + Vite) | OK (61 módulos, bundle 329.7 kB) |
| Simulación de ingesta (`npm run ingest -- --dry-run`) | OK: 120 + 139 fragmentos (259), sin llamadas externas ni escritura |
| Simulación del job de CI sobre base limpia | OK: `migrate` + `seed` reproducen los 30/540/90/360; YAML validado |
| Smoke de API (37 comprobaciones automatizadas) | **37/37 OK** (ver abajo) |

### Smoke de API verificado

Contexto y sesión: `/api/contexto` (3 periodos, activo 2026-2, RAG apagado con motivo, `auth.registro` y `auth.recuperacion`), login real con correo y contraseña. Los endpoints de demo (`/api/auth/demo`, `/api/auth/ingreso-demo`) quedan sólo para QA con `DEMO_MODE=true` y ya no se usan en la interfaz.

Datos: tablero con 30 casos y los 5 estados; paginación (`total=30`, `paginas=6`), filtro por grupo (GRP-A = 10), ficha de EST-0028 (inconsistencia, SIS-INC), ficha de EST-0029 (información insuficiente, RA-07), ficha inexistente 404.

Ciclo tutorial: alertas con total y tipo `rojo_sin_revision`; crear acción y cerrarla; sin sesión 401.

Administración: modelo con advertencia y línea base; 8 reglas RA no aprobadas; 2 documentos RAG con metadatos y vigencia sin verificar; bitácora con total; `POST /api/admin/semaforo/recalcular` (30 evaluados, 27 clasificados, 2 insuficientes, 1 inconsistencia); tutor recibe 403 en endpoints de administración.

RAG y robustez: historial de consultas con total; `POST /api/consultas` devuelve 503 con `codigo=RAG_NO_CONFIGURADO` sin clave; origen ajeno 403; periodo inválido 400; límite de intentos devuelve 429.

Seguridad adicional verificada: `Origin` de `localhost:5173` y `127.0.0.1:5173` aceptados, origen externo rechazado; JWT con revocación por `token_version`; cookies HttpOnly; sin credenciales demo ni `OPENROUTER_API_KEY` en el bundle.

### Autenticación real (verificada el 28-oct)

- La interfaz ya no muestra cuentas demo ni la franja de alerta superior: login normal con correo y contraseña, nota de prototipo discreta al pie.
- `POST /api/auth/registro` (201) crea una cuenta con rol `tutor` y abre sesión; correo duplicado 409; contraseña débil 400. Una cuenta nueva ve el empty state de "sin tutorados asignados".
- `POST /api/auth/recuperar` responde siempre un mensaje genérico; en demo/desarrollo devuelve además un token de un solo uso (30 min) para poder completar el flujo sin proveedor de correo.
- `POST /api/auth/restablecer` (200) valida token vigente y no usado, actualiza la contraseña y revoca las sesiones previas (`token_version`). Token reutilizado o inválido → 400. Login con la contraseña nueva funciona y con la anterior devuelve 401.
- Migración `003_recuperacion_password.sql` aplicada; tokens guardados sólo como SHA-256, con expiración, estado de uso e IP.
- Navegador (headless, 1440×960 y móvil 390×844): `/ingreso`, `/registro`, `/recuperar` y `/restablecer` renderizan y validan correctamente; 0 excepciones JS.

## Qué no se pudo validar todavía

1. **Ingesta real del RAG:** no se ejecutó por decisión del equipo (no hay `OPENROUTER_API_KEY` disponible). La semilla deja 2 documentos registrados con 0 fragmentos y la aplicación se abstiene/deshabilita con motivo. Comando pendiente: `OPENROUTER_API_KEY=... npm run ingest` (tiene costo y el corpus sigue con vigencia ITTLA por validar).
2. **Casos de aceptación del libro:** 0 de 63 ejecutados de extremo a extremo con evidencia; el smoke anterior no sustituye ese registro.
3. **Modelo:** sólo 60 pares sintéticos; no supera la línea base. No debe presentarse como modelo predictivo validado ni usarse con expedientes reales.
4. **Operación e institucional:** siguen pendientes SSO/MFA, respaldos con restauración probada, RLS con políticas y aislamiento multiplantel, aviso de privacidad/DPIA (LGPDPPSO), aprobación documentada de reglas y fuentes, accesibilidad auditada y e2e en CI.
5. **Correo real para recuperación de contraseña:** el flujo completo está probado en demo/dev con token; en producción falta integrar un proveedor de correo para enviar el enlace y deshabilitar el token en la respuesta.
6. **Verificación de correo y aprobación de cuentas:** el registro público crea cuentas activas de tutor; en un despliegue institucional conviene verificar el correo o aprobar la cuenta desde coordinación (`permitir_registro=false`).

## Cómo reproducir

```bash
cd backend
npm run db:local                 # PostgreSQL local + pgvector en 54330
npm run migrate
npm run seed -- --reemplazar     # 30 estudiantes / 3 periodos / 540 registros
npm test
npm run build
# En otra terminal, para el demo (3000 ocupado por otro proyecto):
PORT=3100 npm run start:dev

cd ../frontend
VITE_API_PORT=3100 npm run dev -- --host 127.0.0.1
```

Abrir `http://127.0.0.1:5173` o `http://localhost:5173`. El acceso demo aparece sólo con `DEMO_MODE=true` y no requiere contraseña publicada; la contraseña aleatoria de la semilla se imprime una sola vez en la consola del `seed`.
