# Contrato del dataset sintético ITTLA

- **Identificador del contrato:** `dataset-sintetico-ittla-v1`
- **Versión:** `1.0`
- **Archivo generado:** `backend/datos/dataset.json` (~296 KiB, 30 estudiantes)
- **Generador:** `backend/datos/extraer.py` (Python + `openpyxl`)
- **Estado:** datos **exclusivamente ficticios** para el prototipo. No corresponden a
  personas, expedientes, calificaciones ni servicios reales de ITTLA ni del TecNM.

Este documento fija la procedencia, las reglas de derivación y de generación, los
supuestos, los límites y la forma de regenerar y verificar el dataset. Cualquier
cambio de contrato (campos, reglas o casos deliberados) exige subir la versión y
actualizar este archivo, el generador y `backend/datos/dataset.json` en el mismo
commit.

---

## 1. Procedencia

| Aspecto | Valor |
| --- | --- |
| Fuente primaria | `docs/materiales_hilda_2026-10-13/Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx` |
| Carácter | Datos ficticios (hoja `LEEME`: «Datos exclusivamente ficticios para prototipo ITTLA») |
| Hojas leídas y validadas | `Estudiantes` (30), `Historial` (540), `Inscripciones` (90), `Tutorias` (30), `Situaciones` (18), `Canalizaciones` (6), `Servicios_Asesoria` (3), `Solicitudes` (4), `Fuentes_RAG` (10), `Consultas_RAG` (10) |
| Hojas no consumidas | `LEEME`, `Casos_Prueba` y `Matriz_Trazabilidad` (son el catálogo de escenarios y su matriz; no son datos de registro) |
| Fuente no serializada | `Fuentes_RAG` y `Consultas_RAG` se leen y validan para detectar cambios en el libro, pero el contrato `dataset-sintetico-ittla-v1` no las incluye: el corpus RAG tiene su propio manifiesto (`backend/corpus/fuentes-rag.json`). |
| Fecha de corte del dataset | No se incrusta ninguna fecha de generación para no romper la determinación (ver §8). |

El libro no contiene nombres, matrículas, documentos ni diagnósticos: los
identificadores `EST-0001`…`EST-0030` ya son anónimos y se conservan tal cual en
`id_fuente` y en `id_anonimo`.

Los casos deliberados de calidad de datos (dato faltante y contradicción) se ubican
en **2026-1**, que es el **corte de referencia** con el que el semáforo evalúa el
periodo activo **2026-2**. Así el tablero del periodo en curso puede exponer
`informacion_insuficiente` e `inconsistencia` sin alterar el periodo que está
cursándose. Ver §6.

### Relación con el libro de casos (63 escenarios)

El dataset está pensado para que el prototipo pueda ejercitar los requisitos del
libro de casos. En particular:

- historia de 3 periodos y 6 asignaturas por estudiante-periodo (R01 trayectoria y
  confusión «faltante vs. reprobado»);
- parciales para el periodo activo (R01/RA-05);
- curso especial registrado (RA-06);
- sesiones de tutoría con acuerdo y responsable (R02);
- situaciones, canalizaciones, asesorías y solicitudes separadas del semáforo
  académico y sin diagnósticos (R03/R06, casos E-16 a E-26 y T-06/T-07);
- un caso deliberado de dato faltante y otro de contradicción para que el motor de
  reglas pueda emitir `informacion_insuficiente` e `inconsistencia` (RA-07).

---

## 2. Estructura del contrato

Claves de primer nivel y conteos esperados:

| Clave | Contenido | Conteo |
| --- | --- | --- |
| `contrato` | `"dataset-sintetico-ittla-v1"` | — |
| `version` | `"1.0"` | — |
| `procedencia` | fuente, carácter ficticio, generador y nota | 4 campos |
| `institucion` | clave, nombre, nombre corto | — |
| `periodos` | 2025-2, 2026-1, 2026-2 (activo 2026-2) | 3 |
| `carreras` | programas únicos del libro mapeados a clave corta | 3 |
| `grupos` | GRP-A, GRP-B, GRP-C | 3 |
| `usuarios` | cuentas por rol (`tutor`, `coordinacion`, `asesoria`, `admin_tecnico`) | 5 |
| `estudiantes` | expediente + trayectoria + asignaturas + parciales + curso especial | 30 |
| `sesiones_tutoriales` | hoja `Tutorias` normalizada | 30 |
| `situaciones` | hoja `Situaciones` normalizada | 18 |
| `canalizaciones` | hoja `Canalizaciones` normalizada | 6 |
| `asesorias` | hoja `Servicios_Asesoria` normalizada | 3 |
| `solicitudes` | hoja `Solicitudes` normalizada | 4 |
| `resumen` | conteos y `advertencias` (casos deliberados y campos generados) | — |

Totales derivados: **30 estudiantes**, **540 asignaturas** (6 por estudiante × 3
periodos × 30), **90 trayectorias** (30 × 3), **360 parciales** (2 por asignatura
de 2026-2 × 180), **3 periodos**.

No hay `NaN` ni `Infinity`: todo número es finito y redondeado a 2 decimales
(`porcentaje_asistencia` a 1 decimal). El JSON es UTF-8, legible (indentación de 2
espacios) y termina en salto de línea.

### Forma de `estudiantes[]`

```jsonc
{
  "id_anonimo": "EST-0001",
  "id_fuente": "EST-0001",
  "carrera": "ITIC",
  "semestre": 2,
  "generacion": "2026",
  "plan_estudios": "Plan ITIC 2010",
  "modalidad": "Escolarizada",
  "grupo": "GRP-A",
  "estatus_academico": "inscrito",
  "tutor_correo": "tutor@ittla.demo",
  "trayectoria": [ /* 3 filas, una por periodo, en orden cronológico */ ],
  "asignaturas": [ /* 18 filas: 6 por periodo × 3 periodos */ ],
  "parciales": [ /* 12 filas: 2 por asignatura de 2026-2; vacío en otros periodos */ ],
  "curso_especial": [ /* 0 filas, salvo EST-0027 con una fila */ ]
}
```

---

## 3. Derivación: catálogos y expediente

### 3.1 Periodos e institución

`institucion`, `periodos`, `grupos` y `usuarios` se toman del contrato del encargo,
no del libro. Las fechas de inicio/fin de los periodos son valores de referencia
del contrato y **no** están respaldadas por el libro de casos.

### 3.2 Carreras

Los programas de `Estudiantes` se mapean a claves cortas. Solo se exportan los
programas presentes en el libro (el generador aborta si aparece un programa sin
mapeo, para no inventar carreras):

| Programa del libro | Clave | Nombre canónico |
| --- | --- | --- |
| Ingeniería en Tecnologías de la Información y Comunicaciones | `ITIC` | Ingeniería en Tecnologías de la Información y Comunicaciones |
| Ingeniería Industrial | `IND` | Ingeniería Industrial |
| Ingeniería en Sistemas Computacionales | `ISC` | Ingeniería en Sistemas Computacionales |

### 3.3 Identificadores

- `id_fuente`: `id_estudiante` del libro (`EST-0001`…`EST-0030`).
- `id_anonimo`: mismo valor (el libro ya usa identificadores anónimos; se conserva
  para no romper la trazabilidad).
- Orden: estudiantes y registros se ordenan por identificador, periodo y clave de
  asignatura; no se depende del orden físico de las celdas.

### 3.4 Grupo y tutor

Asignación **por orden** de estudiante:

| Estudiantes | Grupo | Tutor |
| --- | --- | --- |
| EST-0001…EST-0010 | `GRP-A` | `tutor@ittla.demo` |
| EST-0011…EST-0020 | `GRP-B` | `tutor@ittla.demo` |
| EST-0021…EST-0030 | `GRP-C` | `tutor.c@ittla.demo` |

### 3.5 Generación

Dato derivado del semestre (el libro no trae generación). Con ciclos 2026-1
(enero–junio) y 2026-2 (agosto–diciembre), el año de ingreso implícito es
`2026 − floor((semestre − 1) / 2)`:

| Semestre en 2026-2 | 1–2 | 3–4 | 5–6 | 7–8 |
| --- | --- | --- | --- | --- |
| Generación | 2026 | 2025 | 2024 | 2023 |

### 3.6 Plan de estudios, modalidad y estatus

- `plan_estudios`: `Plan <CLAVE> 2010` (plan de referencia de ejemplo; el libro no
  lo trae).
- `modalidad`: `Escolarizada` para todo el dataset (el libro no varía la modalidad).
- `estatus_academico`: `inscrito` para todo el dataset (el libro no modela bajas ni
  egresados).

### 3.7 Asignaturas (`asignaturas[]`)

Cada fila de `Historial` se convierte 1:1 en una fila de `asignaturas`:

| Campo del libro | Campo del dataset | Regla |
| --- | --- | --- |
| `id_estudiante` / `periodo` / `id_asignatura` / `asignatura` / `creditos_ejemplo` / `calificacion` | `periodo`, `clave`, `nombre`, `creditos`, `calificacion` | copia directa |
| `resultado_simulado` | `resultado` | `Acreditada` → `aprobado`; `No acreditada` → `reprobado` |
| `oportunidad` | `oportunidad` | `Primera inscripción` → `1` (el libro usa texto) |
| — | `fuente` | `excel` (procedencia del registro) |

El umbral de acreditación usado es **70**, tomado del propio libro (`nota_umbral`:
«Simulado: 70 solo para ejemplo, validar norma»). **No es una norma institucional**;
solo se usa para mapear el resultado simulado del libro y para `acreditada` de los
parciales.

---

## 4. Derivación: `trayectoria[]`

Para cada estudiante y cada periodo se derivan las cifras a partir de sus
`asignaturas` del mismo periodo (y del acumulado de periodos anteriores para el
avance). Todas se redondean a 2 decimales:

| Campo | Fórmula |
| --- | --- |
| `creditos_aprobados` | Σ `creditos` de asignaturas con `resultado = "aprobado"` |
| `creditos_pendientes` | Σ `creditos` inscritos en el periodo − `creditos_aprobados` (incluye materias reprobadas y `sin_registro`) |
| `promedio_periodo` | media aritmética de las `calificacion` no nulas del periodo; `0.0` si no hay ninguna válida (no ocurre con los datos actuales) |
| `materias_reprobadas` | conteo de asignaturas con `resultado = "reprobado"`; `sin_registro` **no** cuenta como reprobada |
| `porcentaje_asistencia` | generado (ver §5.1) |
| `avance_curricular` | Σ `creditos_aprobados` acumulados hasta el periodo (inclusive) ÷ **210** × 100 |
| `acuerdos_vencidos` | generado (ver §5.2) |
| `origen` | `"derivado"` |

El campo `origen` se marca `"derivado"` porque la mayor parte de la fila proviene
del `Historial`; las dos cifras generadas se identifican explícitamente en
`resumen.advertencias` y en §5 para no confundirlas con datos del libro.

### 4.1 Caso especial: dato faltante

Las asignaturas deliberadamente sin registro (en el corte 2026-1, ver §6) tienen
`resultado = "sin_registro"` y `calificacion = null`; **no** suman a créditos
aprobados, **no** cuentan como reprobadas y **no** entran al promedio. Sus créditos
sí aumentan `creditos_pendientes`, porque el total inscrito del periodo no cambia.
Con esto se prueba que el sistema distingue «no hay dato» de «reprobó» (y de
«aprobó», porque uno de los faltantes era aprobado en el libro y el otro
reprobado). El periodo 2026-2 de esos estudiantes queda completo.

### 4.2 Caso especial: contradicción

La fila deliberada del corte 2026-1 (ver §6) tiene `calificacion ≥ 70` y
`resultado = "reprobado"`; se deriva con la misma regla que el resto: cuenta como
reprobada (créditos no aprobados, `materias_reprobadas + 1`), pero su calificación
**sí** entra al promedio del periodo, porque el promedio usa calificaciones
válidas. Esa combinación es precisamente la señal de inconsistencia que el motor de
reglas debe detectar al evaluar el periodo activo.

---

## 5. Campos generados (y por qué)

El libro no los contiene; se generan de forma **determinista** y documentada. La
generación no usa `random`: cuando se necesita variación se usa un entero derivado
de `sha256` de una llave estable (identificador, periodo, asignatura y campo). Así
el resultado no depende de la versión de Python ni del orden de ejecución.

### 5.1 `porcentaje_asistencia`

```
asistencia = limitar(100 − 1.2 × max(0, 95 − promedio_periodo) − 2.5 × materias_reprobadas, 55, 100)
```

- Rango garantizado: 55–100, un decimal.
- Correlación: a mayor promedio y menos reprobadas, mayor asistencia; los alumnos
  con reprobación múltiple caen al piso de 55.
- Motivo: el semáforo y la ficha necesitan una señal de asistencia plausible y
  no hay ninguna en el libro.

### 5.2 `acuerdos_vencidos`

```
puntaje = promedio_periodo − 5 × materias_reprobadas
acuerdos_vencidos = 2 si puntaje < 70 · 1 si 70 ≤ puntaje < 85 · 0 si puntaje ≥ 85
```

- Rango garantizado: 0–2, entero, correlacionado inversamente con el desempeño.
- Motivo: los acuerdos de tutoría y su vencimiento son señales del tablero; el
  libro solo aporta una sesión por estudiante y sin fechas.

### 5.3 `parciales[]` (solo periodo activo 2026-2)

Se generan **2 parciales por asignatura** del periodo activo: 30 × 6 × 2 = **360
filas**. Son deterministas y se calculan con la calificación final simulada del
`Historial` para que sean coherentes con la trayectoria:

Sea `h` el entero derivado de `sha256("<id>|2026-2|<clave_asignatura>|parcial|<n>")`
(primeros 12 dígitos hexadecimales). Reglas en orden de precedencia:

1. **Asignaturas del caso RA-05 deliberado** (ver §6): valores fijos y ambos
   parciales `exigible = true`.
2. **Salvaguarda para `sin_registro`**: hoy los faltantes deliberados están en el
   corte 2026-1, así que ninguna asignatura de 2026-2 cae en este caso; si alguna
   llegara a quedar sin resultado final, sus dos parciales se generarían con
   `60 + h % 21` y `exigible = false` (no se presume nada con datos incompletos).
3. **Resultado final aprobado**:
   - parcial 1: `limitar(final + (h % 13) − 7, 70, 100)` → siempre acredita;
   - parcial 2: `limitar(final + (h % 21) − 11, 45, 100)` → puede no acreditar
     (un solo parcial reprobado no constituye RA-05);
   - `exigible`: parcial 1 `true`, parcial 2 `false`.
4. **Resultado final reprobado**:
   - parcial 1: `limitar(final + (h % 11) − 13, 20, 69)`;
   - parcial 2: `limitar(final + (h % 13) − 10, 20, 69)`;
   - ambos por debajo de 70 y correlacionados con la calificación final;
   - `exigible`: parcial 1 `true`, parcial 2 `false`.

`acreditada = calificacion ≥ 70` en todos los casos y `fuente = "generado_sintetico"`.

**Semántica de `exigible`:** un parcial exigible ya promedia o se exige para la
evaluación. En el corte del periodo activo, por defecto el parcial 1 ya promedia y
el parcial 2 aún no. En los casos RA-05 deliberados ambos parciales ya promedian,
de modo que la regla RA-05 (dos o más parciales **exigibles** no acreditados en la
misma asignatura) se pueda disparar. Los parciales de asignaturas sin registro no
son exigibles.

Motivo: la especificación exige registro por parcial con corte y la regla RA-05 no
se puede probar con un solo resultado final por asignatura.

### 5.4 `curso_especial[]`

El libro no trae cursos especiales como fila de datos. Se genera uno:

```json
{"periodo": "2026-2", "clave_asignatura": "ASG-06", "registrado": true, "fuente": "generado_sintetico"}
```

- Estudiante: **EST-0027**; asignatura: **ASG-06** (Fundamentos de Investigación,
  reprobada en el Historial del periodo, coherente con un curso de recuperación).
- Motivo: probar la regla RA-06 (curso especial registrado → revisión provisional).

---

## 6. Casos deliberados

Estos casos **rompen a propósito** la consistencia del libro. Están registrados en
`resumen.advertencias` y cualquier consumidor debe tratarlos como escenarios de
prueba, no como errores de captura:

| # | Tipo | Clave (estudiante/periodo/asignatura) | Efecto esperado |
| --- | --- | --- | --- |
| 1 | Dato faltante | `EST-0029` / `2026-1` / `ASG-02`: `resultado = "sin_registro"`, `calificacion = null` | Estado `informacion_insuficiente` (RA-07) en el corte del periodo activo; no cuenta como reprobada |
| 2 | Dato faltante | `EST-0030` / `2026-1` / `ASG-01`: `resultado = "sin_registro"`, `calificacion = null` | Igual que el anterior; en el libro esta fila era aprobada (71), así que tampoco debe interpretarse como aprobada |
| 3 | Contradicción | `EST-0028` / `2026-1` / `ASG-01`: `calificacion = 74` y `resultado = "reprobado"` | Estado `inconsistencia` en el corte del periodo activo; además el agregado de `Inscripciones` de 2026-1 (5 aprobadas) deja de cuadrar con el Historial derivado (4 aprobadas) |
| 4 | RA-05 | `EST-0019` / `2026-2` / `ASG-01`: parciales exigibles 58 y 61 (no acreditados), resultado final del periodo aprobado (82) | Dispara RA-05 (dos parciales exigibles no acreditados) sin contradecir el resultado final |
| 5 | RA-05 | `EST-0026` / `2026-2` / `ASG-06`: parciales exigibles 55 y 60 (no acreditados), resultado final del periodo aprobado (96) | Igual que el anterior |
| 6 | Curso especial | `EST-0027` / `2026-2` / `ASG-06` | Dispara RA-06 |

Las filas 1 y 2 **cuentan dentro de las 540 asignaturas** (no se eliminan filas del
libro) y solo cambian de periodo respecto del libro según la regla de corte descrita
en §1: 2026-2 queda completo para EST-0029 y EST-0030. La fila 3 conserva la
calificación del libro de 2026-1 (74, ≥ 70) y solo cambia el resultado (`fuente`
sigue siendo `excel` porque el registro proviene del libro; la modificación
deliberada se documenta aquí y en `advertencias`). **2025-2 queda coherente.**

### Efecto en los agregados

- `EST-0028` en 2026-1: `Inscripciones` del libro dice 5 aprobadas / 1 no
  acreditada; la trayectoria derivada tras la contradicción reporta 4 aprobadas /
  2 reprobadas. Es intencional: representa la señal de inconsistencia en el corte
  del periodo activo. En 2025-2 el agregado vuelve a cuadrar (2 aprobadas / 4 no
  acreditadas).
- `EST-0029` y `EST-0030` en 2026-1: `materias_reprobadas` no incluye la asignatura
  sin registro; `créditos_pendientes` sí incluye sus créditos. Su 2026-2 (periodo
  activo) no tiene datos faltantes.

---

## 7. Hojas de acompañamiento (normalización)

Se copian «tal como vienen» del libro, sin inventar hechos: no se añaden
diagnósticos, fechas, folios ni garantías de servicio. Solo se normalizan los
**estados** a claves `snake_case` y se añade `id_fuente`:

| Hoja | Estructura | Normalización aplicada |
| --- | --- | --- |
| `Tutorias` → `sesiones_tutoriales` | `id_fuente`, `id_anonimo`, `periodo`, `tipo`, `tema`, `acuerdo`, `estado`, `responsable` | `Pendiente` → `pendiente` |
| `Situaciones` → `situaciones` | `id_fuente`, `id_anonimo`, `categoria`, `necesidad`, `origen`, `documento`, `canalizacion`, `estado` | `Pendiente de validación` → `pendiente_validacion`; `Sin atender` → `sin_atender` |
| `Canalizaciones` → `canalizaciones` | `id_fuente`, `id_anonimo`, `categoria`, `area_sugerida`, `institucion`, `estatus`, `fecha_confirmacion`, `nota` | `Pendiente` → `pendiente`; `fecha_confirmacion` se conserva `null` |
| `Servicios_Asesoria` → `asesorias` | `id_fuente`, `instituto`, `area`, `asignatura`, `modalidad`, `dia`, `horario`, `vigencia`, `estado`, `responsable` | `NO CONFIRMADO` → `no_confirmado`; `PENDIENTE DE CONFIRMACIÓN` → `pendiente_confirmacion`; `dia`/`horario` nulos se conservan |
| `Solicitudes` → `solicitudes` | `id_fuente`, `id_anonimo`, `tipo`, `estado`, `area`, `nota` | `Pendiente` → `pendiente` |

Los textos restantes (`vigencia = "Simulada"`/`"Histórico"`, `categoria`, `area`,
`institucion = "Por verificar"`, `nota = "No se garantiza servicio"`, etc.) se
conservan textualmente porque son advertencias del propio libro y perderlas
alteraría el significado. Ningún campo nuevo implica atención prestada,
diagnóstico ni autorización.

---

## 8. Determinismo y verificación

`extraer.py` es determinista:

- no usa `random`, ni la fecha del sistema, ni variables de entorno;
- el orden de los arreglos depende solo del contenido (identificadores, periodos y
  claves de asignatura ordenados);
- los valores sintéticos usan `sha256` de llaves estables y un número fijo de
  decimales;
- serializa con `json.dumps(..., ensure_ascii=False, indent=2, allow_nan=False)` y
  salto de línea final.

Ejecución de referencia de este contrato:

```
sha256 = f5662bbba999e61207637ac9589553400d52421226b21d0bfc626c9346c51980
bytes  = 303094
```

> El hash y el tamaño cambian si se modifica el libro de casos, el generador o este
> contrato. Al regenerar, actualiza estas dos líneas en el mismo commit.

Para verificar que dos corridas producen bytes idénticos:

```bash
cd <raíz-del-repositorio>
PYTHON=/Users/ivaralexander/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3

"$PYTHON" backend/datos/extraer.py >/dev/null          # corrida 1
shasum -a 256 backend/datos/dataset.json               # guarda el hash
"$PYTHON" backend/datos/extraer.py >/dev/null          # corrida 2
shasum -a 256 backend/datos/dataset.json               # debe coincidir
```

El script imprime al final un resumen con conteos, ruta, bytes y sha256, y sale con
código 0. Si algo falla, imprime `ERROR: ...` en stderr, **no escribe** el archivo
y sale con código 1.

### Validaciones que abortan la generación

1. Cabeceras exactas de las hojas; aborta si el libro cambia de estructura.
2. Conteos por hoja: 30/540/90/30/18/6/3/4/10/10.
3. `Estudiantes`: IDs `EST-0001`…`EST-0030` únicos y consecutivos, programas
   mapeados, periodo actual 2026-2, semestres 1–12.
4. `Historial`: 90 pares estudiante-periodo con exactamente 6 asignaturas, sin
   duplicados, calificaciones 0–100, resultados y oportunidades reconocidos,
   créditos positivos.
5. `Inscripciones` cuadra con `Historial` en inscritas/aprobadas/no acreditadas
   **antes** de aplicar los casos deliberados.
6. Integridad referencial de `Tutorias`, `Situaciones`, `Canalizaciones` y
   `Solicitudes` contra los 30 estudiantes.
7. Dataset: 30 estudiantes únicos, 540 asignaturas, 90 trayectorias, 360 parciales,
   3 periodos, 6 asignaturas por estudiante-periodo, exactamente 2 parciales
   (números 1 y 2) por asignatura de 2026-2, un solo periodo activo.
8. Trayectoria recalculada de forma independiente y comparada campo a campo
   (créditos, promedio, reprobadas, avance), rangos de asistencia 55–100 y
   acuerdos 0–2.
9. Casos deliberados exactos: 2 `sin_registro`, 1 contradicción, al menos 2
   estudiantes con RA-05, 1 curso especial; además, al menos un estudiante con
   parciales no acreditados que también reprueba el periodo.
10. Sin `NaN` ni `Infinity`; JSON serializable con `allow_nan=False`.

---

## 9. Supuestos

1. **210 créditos** de plan de estudios para `avance_curricular`; coincide con
   `creditos_plan_estudios` de `backend/datos/configuracion.json`.
2. **Umbral 70** de acreditación tomado del campo `nota_umbral` del libro, que lo
   marca como simulado de ejemplo. No es norma institucional.
3. **Fechas de periodo** y periodo activo 2026-2 provienen del contrato del
   encargo; no del libro.
4. **Plan 2010**, modalidad `Escolarizada` y estatus `inscrito` son valores de
   ejemplo para el prototipo (el libro no los modela).
5. **Generación** se deriva del semestre (ver §3.5); el libro no la trae.
6. **Grupo y tutor** se asignan por orden de 10 en 10 (ver §3.4); el libro no los
   trae.
7. `id_anonimo` = `id_fuente` porque el libro ya usa identificadores anónimos.
8. La **asistencia** y los **acuerdos vencidos** son generados con las fórmulas de
   §5.1 y §5.2; son señales plausibles, no mediciones.
9. Los **parciales** y el **curso especial** son generados con las reglas de §5.3 y
   §5.4; no provienen del libro.

---

## 10. Límites conocidos

1. **Cobertura de historia:** solo hay 3 periodos (2025-2 a 2026-2). El libro asigna
   semestres 1–8 pero el historial es uniforme, por lo que un alumno de semestre
   alto no tiene historia previa completa y el `avance_curricular` derivado es una
   **cota inferior** del avance real (máximo observado ≈ 18 %). No se debe usar
   como porcentaje oficial de avance.
2. **Semestre vs. historia:** la combinación «semestre 1–2 con tres periodos de
   historia» es incoherente por construcción del libro sintético; no se corrige
   porque la fuente es la que manda.
3. **Resultado del periodo activo:** el `Historial` ya trae el resultado final
   simulado de 2026-2 aunque el periodo esté activo. Sirve para derivar la
   trayectoria y los parciales, pero en un sistema real ese corte aún no existiría.
   El corte de referencia con el que se clasifica 2026-2 es 2026-1; por eso los
   casos de calidad de datos deliberados viven allí.
4. **Sesiones de tutoría sin fechas:** el libro no trae `fecha_sesion`,
   `fecha_compromiso` ni `fecha_cierre`; si el consumidor necesita esas columnas
   (por ejemplo `sesion_tutorial.fecha_sesion NOT NULL`), deberá derivarlas dentro
   del periodo de forma determinista o ajustar el esquema. El dataset no las
   inventa.
5. **Sin datos de SASS/AMBAR ni expedientes reales:** este contrato es solo el
   piloto sintético; no cubre integraciones, ni datos personales, ni diagnósticos.
6. **`Fuentes_RAG`/`Consultas_RAG` no serializadas:** quedan en el libro; el corpus
   RAG usa su propio manifiesto y su ingesta.
7. **Reglas del semáforo fuera de alcance:** el dataset no decide colores ni
   umbrales. Las reglas RA-01…RA-08 viven en `backend/datos/reglas-semaforo.json`
   (experimentales, no aprobadas) y el motor decide con ellas.
8. **Tamaño:** ~296 KiB versionados. Si se necesita reducir, la opción es dejar de
   repetir nombres de asignatura o usar indentación compacta (cambiaría el hash y
   requeriría actualizar este contrato); no se hace porque la legibilidad y la
   trazabilidad importan más.

---

## 11. Mapa hacia las tablas de la base de datos

Referencia para el consumidor (`npm run seed`); los nombres del JSON no tienen por
qué coincidir letra por letra con las columnas SQL:

| Bloque del dataset | Tabla destino (migraciones 001/002) |
| --- | --- |
| `institucion` | `institucion` |
| `periodos[]` | `periodo` (un activo: 2026-2) |
| `carreras[]` | `catalogo_carrera` |
| `grupos[]` | `catalogo_grupo` |
| `usuarios[]` | `usuario` (las contraseñas demo no vienen en el dataset) |
| `estudiantes[]` | `estudiante` (carrera, semestre, generación, plan, modalidad, grupo, estatus, tutor vía `tutor_correo`) |
| `estudiantes[].trayectoria[]` | `trayectoria_periodo` |
| `estudiantes[].asignaturas[]` | `asignatura_resultado` |
| `estudiantes[].parciales[]` | `evaluacion_parcial` |
| `estudiantes[].curso_especial[]` | `curso_especial` |
| `sesiones_tutoriales[]` | `sesion_tutorial` (fechas a derivar, ver §10.4) |
| `situaciones[]` | `necesidad_apoyo` (`necesidad` → `necesidad`, `documento` → `documento_presentado`) |
| `canalizaciones[]` | `canalizacion` (`institucion` → `institucion_destino`) |
| `asesorias[]` | `servicio_asesoria` |
| `solicitudes[]` | `solicitud` |

`resumen.advertencias` es una lista de cadenas pensada para mostrarse o registrarse
en bitácora; incluye los casos deliberados y los campos generados. El dataset **no**
trae contraseñas, credenciales ni datos sensibles.

---

## 12. Cómo regenerar

Requisitos: Python ≥ 3.10 y `openpyxl` (probado con 3.1.5).

```bash
cd <raíz-del-repositorio>

# Runtime de Python con openpyxl ya disponible en este entorno:
PYTHON=/Users/ivaralexander/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3

"$PYTHON" backend/datos/extraer.py
# -> escribe backend/datos/dataset.json, imprime resumen y sha256, código 0

# Verificación de determinismo (debe dar el mismo sha256 dos veces):
shasum -a 256 backend/datos/dataset.json
"$PYTHON" backend/datos/extraer.py && shasum -a 256 backend/datos/dataset.json
```

El script no recibe argumentos: siempre lee la misma fuente (relativa a la raíz del
repositorio, calculada desde la ubicación del propio script) y siempre escribe el
mismo archivo. Se puede ejecutar desde cualquier directorio.

No se versionan ni `__pycache__` ni archivos temporales. El JSON sí se versiona:
es el dato canónico del prototipo y el diff entre versiones debe revisarse junto con
este contrato.
