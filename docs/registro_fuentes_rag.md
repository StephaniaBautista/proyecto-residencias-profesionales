# Registro de fuentes para el RAG

Corte de revisión: 13 de octubre de 2026. Una fuente habilitada en el índice sirve para recuperar texto; eso no significa que su vigencia normativa local esté confirmada.

| Fuente | Alcance identificado | Uso en el RAG | Estado |
| --- | --- | --- | --- |
| Programa de Tutorías del TecNM, enero de 2022 | Marco general del TecNM | Habilitado; se cita como documento TecNM | Vigencia aplicable al ITTLA por validar |
| Manual del Tutor del SNIT, febrero de 2013 | Referencia histórica sobre funciones y límites de tutoría | Habilitado como antecedente, con aviso de fecha en el título | Vigencia aplicable al ITTLA por validar |
| Actividades sugeridas por eje | Material proporcionado, autoría y alcance institucional no identificados | No indexado | Revisar antes de tratar como orientación institucional |
| PAT, Anexo 15, hoja de canalización y formatos SGI-AC-PO-11 | Los documentos examinados identifican al Instituto Tecnológico de San Juan del Río (ITSJR) | No indexados para ITTLA | Referencias de otro plantel; no adoptar como procedimiento ITTLA |
| Manual de Lineamientos Académico-Administrativos del TecNM, octubre de 2015 | Lineamientos generales publicados en 2015 | No indexado en este corpus | Versión antigua; validar normativa vigente antes de usar |
| Banco de proyectos de maestría y otros materiales sin relación directa | No aplicable al acompañamiento tutorial del prototipo | Excluidos | Fuera del alcance del corpus |

El programa de 2022 ya estaba en `backend/corpus/`. La lista de fuentes ahora también habilita el Manual del Tutor de 2013 como antecedente. Las fuentes nuevas no se han subido a la base porque la clave de OpenRouter está vacía; `npm run ingest -- --dry-run` permite comprobarlas localmente.

La página pública de servicios del ITTLA dirige “Servicio Social y Residencias Profesionales” a SASS. La pantalla pública de SASS solicita número de control y contraseña; por ello, los formatos de evaluación de residencia no se pudieron descargar desde la sesión pública. La guía institucional encontrada en búsqueda menciona los Anexos XXIX y XXX, pero no se presenta aquí como versión vigente.

## Consultas de prueba del Excel

El libro contiene diez preguntas de ejemplo. Se revisó qué información solicita cada una y qué límites debe respetar la respuesta. Son casos de prueba, no consultas reales del historial de usuarios; las diez siguen pendientes y no se ejecutaron contra el modelo.

1. **¿Qué fases tiene la tutoría?** Busca las cinco fases del Programa TecNM 2022; citar la fuente y señalar que su vigencia local requiere confirmación.
2. **¿Qué hace el tutor?** Busca funciones y límites; responder con cita del Manual SNIT 2013, marcado como antecedente.
3. **¿Cómo registro una calificación parcial?** Busca un formato para calificación por tema; el Excel apunta al Anexo 15 del ITSJR, que no debe presentarse como formato ITTLA.
4. **¿Qué pasa si no hay calificación?** Busca el tratamiento de un dato faltante; nunca inferir reprobación automáticamente.
5. **¿Pasa Pares está disponible?** Busca disponibilidad actual; el libro establece “no confirmado”, por lo que la respuesta debe abstenerse de afirmar que existe.
6. **¿Dónde solicito asesoría de Física?** Busca ubicación/horario de asesoría; el directorio está pendiente, así que solo se mostrarían datos confirmados.
7. **¿Tengo derecho a cambiar turno?** Busca una regla administrativa vigente; no prometer el cambio sin una norma ITTLA validada.
8. **¿Pueden diagnosticar ansiedad?** Busca un diagnóstico; el límite de diseño es no diagnosticar y orientar a apoyo humano.
9. **¿Cómo se documenta una canalización?** Busca el flujo y formato; la hoja aportada es del ITSJR y se conserva solo como referencia externa no adoptada.
10. **¿Qué actividades tutoriales sugieren?** Busca ideas por eje; las actividades sugeridas no se indexaron mientras su autoría y pertinencia institucional sigan sin confirmar.

Fuentes oficiales consultadas:

- Portal de servicios del ITTLA: <https://port.tlalnepantla.tecnm.mx/estudiantes>
- Inicio de sesión de SASS: <https://sass.ittla.gtyvittla.com.mx/servicioSocial/login.php>
- Guía de registro y operación de residencias profesionales: <https://www.tlalnepantla.tecnm.mx/archivo/residencias/Requisitos%20de%20registro%20y%20operaci%C3%B3n-2.pdf>
