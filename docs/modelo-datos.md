# Modelo de datos

Todo identificador de tutorado es `EST_001` … `EST_150`. No hay nombres, matrículas ni datos sensibles. `fuente_sintetica` marca cada fila como generada.

| Tabla | Guarda |
| --- | --- |
| `usuario` | Cuentas de prueba y rol: tutor, coordinación, asesoría, administración técnica |
| `estudiante` | Carrera, semestre, grupo y tutor asignado |
| `trayectoria_periodo` | Indicadores, puntos, color, etiqueta de entrenamiento y señales |
| `asignatura_resultado` | Cuatro materias del periodo |
| `sesion_tutorial` | Acuerdos cumplidos, pendientes o vencidos |
| `accion_tutorial` | Compromiso registrado por el tutor |
| `revision_ficha` | Validación de asesoría |
| `alerta` | Rojo sin revisión, o acción por vencer |
| `intervencion_apoyo` | Taller u orientación de prueba |
| `documento_rag` / `fragmento_rag` | Programa de Tutorías y su vector |
| `consulta_rag` | Pregunta, respuesta y si hubo abstención |
| `bitacora` | Ingreso, acciones, revisiones, consultas y entrenamientos |
| `modelo_riesgo` | Árbol guardado y métricas de los tres algoritmos |

Las tablas tienen RLS activo y no conceden privilegios a `anon` ni `authenticated`. La API entra con el rol dueño de Supabase, que omite RLS. El navegador no recibe la cadena de conexión: el filtro por tutor ocurre en la API.

Índices: cada llave foránea, el par periodo/nivel, las alertas pendientes y un índice HNSW de coseno sobre `fragmento_rag.embedding`.
