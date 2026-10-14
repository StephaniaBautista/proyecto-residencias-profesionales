# Registro de validación del prototipo

**Corte:** 13 de octubre de 2026  
**Alcance:** prototipo local con datos sintéticos, especificación técnica y libro de casos de prueba aportados.

## Validaciones ejecutadas

- **Pruebas unitarias del backend:** 17 aprobadas, 0 fallidas. Cubren reglas del semáforo, métricas del modelo, manifiesto y seguridad de rutas para fuentes RAG, recuperación/abstención y formato de respuesta.
- **Compilación del backend:** aprobada (`npm run build`).
- **Compilación del frontend:** aprobada (`npm run build`).
- **Simulación de ingesta RAG:** aprobada con `--dry-run`. Se prepararon 120 fragmentos del Programa de Tutorías TecNM (2022) y 139 del Manual del Tutor SNIT (2013), para 259 en total. La simulación no llamó servicios externos ni escribió en la base de datos. El analizador PDF mostró una advertencia `TT: undefined function: 32`; aun así extrajo ambos documentos y completó la simulación.
- **Integridad del Excel:** 30 estudiantes ficticios y 540 registros académicos; claves estudiante–periodo–asignatura únicas; tres periodos con 180 registros cada uno; relaciones verificadas sin identificadores huérfanos. Los 63 escenarios están marcados como pendientes en el archivo fuente.

## Estado de los casos de aceptación

El libro distribuye los 63 escenarios en estudiante (26), entorno docente (15), asesorías (10) y tutoría/gobernanza (12). **0 de 63 se ejecutaron de extremo a extremo** contra la aplicación. Las pruebas unitarias anteriores no sustituyen esos casos. El registro fuente se conserva sin cambios para que Hilda y el equipo documenten resultado, evidencia, responsable, fecha y estado durante su ejecución.

La cobertura funcional actual no acredita todavía las condiciones de aceptación del plan técnico, en particular:

- evaluación separada de calificaciones parciales/finales, dato ausente y dato contradictorio;
- reglas propuestas RA-01 a RA-08, prioridad explicable y bloqueo cuando falte información indispensable;
- disponibilidad real de asesorías y Pasa Pares, protocolos vigentes de canalización y accesibilidad probada;
- aislamiento multiinstitucional validado, integración con AMBAR y uso con expedientes reales.

Los umbrales actuales del semáforo son reglas experimentales del prototipo. No están aprobados por ITTLA ni deben describirse como criterios oficiales de TecNM.

## RAG, historial y fuentes

El manifiesto local habilita solo el Programa de Tutorías TecNM (2022) y el Manual del Tutor SNIT (2013), ambos con vigencia para ITTLA pendiente de confirmación; el segundo se etiqueta como antecedente histórico. Los formatos ITSJR se catalogaron como ejemplos externos y no se cargan como procedimientos de ITTLA. El archivo de actividades sugeridas no tiene autor/procedencia confirmados y quedó excluido.

La interfaz permite revisar, en la cuenta propia, hasta las últimas 12 consultas con respuesta y evidencia recuperada. No existe una vista agregada para que coordinación lea consultas de otras personas. La carga real de embeddings y las respuestas del modelo no se probaron: `OPENROUTER_API_KEY` está vacío en el entorno local. Por lo tanto, los 259 fragmentos representan una simulación de preparación, no documentos ya indexados ni respuestas RAG verificadas.

## Formularios oficiales de ITTLA

El portal público de estudiantes deriva el trámite de residencias al sistema SASS, cuyo acceso requiere cuenta. Durante esta revisión no se pudo obtener ni validar una versión vigente de los formatos de evaluación. La guía pública archivada de requisitos no basta para afirmar que los anexos sean los actuales. Antes de adjuntarlos al informe, hay que descargarlos desde una sesión institucional autorizada y confirmar su periodo/vigencia.

- [Portal oficial de estudiantes del ITTLA](https://port.tlalnepantla.tecnm.mx/estudiantes)
- [Acceso SASS](https://sass.ittla.gtyvittla.com.mx/servicioSocial/login.php)

## Próximas acciones

1. Solicitar o usar acceso institucional autorizado a SASS para obtener los formatos vigentes de primera evaluación.
2. Confirmar con Desarrollo Académico qué fuentes y reglas se pueden considerar vigentes para ITTLA; documentar esa aprobación.
3. Habilitar la clave RAG en un entorno autorizado y ejecutar ingesta/consultas con evidencia, o mantener explícita la limitación si no hay autorización.
4. Ejecutar los 63 escenarios del Excel en una sesión controlada con datos sintéticos; registrar fallos y corregir primero los casos críticos de privacidad, consistencia y no diagnóstico.
5. Completar datos personales, horas efectivamente trabajadas, evidencias institucionales y revisión del asesor antes de convertir este borrador en informe entregable.
