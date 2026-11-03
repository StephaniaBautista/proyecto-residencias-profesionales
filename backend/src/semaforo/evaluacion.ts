import type { Sql } from '../base-datos/conexion';
import { valorConfiguracion } from '../comun/catalogos';
import { periodoAnterior } from '../comun/periodo';
import { etiquetaObservada } from '../ml/etiqueta';
import {
  evaluarReglas,
  type AsignaturaHecho,
  type CondicionRegla,
  type CursoEspecialHecho,
  type HechosSemaforo,
  type ParcialHecho,
  type ReglaSemaforo,
  type ResultadoEvaluacion,
} from './reglas';

export type OpcionesRecalculo = {
  institucionId: number;
  periodo: string;
  version: string;
  /** Número de asignaturas que se espera por estudiante y periodo (6 en el dataset de prueba). */
  asignaturasEsperadas?: number;
};

export type ResumenRecalculo = {
  periodo: string;
  version: string;
  evaluados: number;
  clasificados: number;
  informacion_insuficiente: number;
  inconsistencias: number;
  sin_trayectoria: number;
};

type FilaAsignatura = {
  estudiante_id: number;
  periodo: string;
  clave_asignatura: string;
  calificacion: number | null;
  resultado: 'aprobado' | 'reprobado' | 'sin_registro';
};

type FilaParcial = {
  estudiante_id: number;
  periodo: string;
  clave_asignatura: string;
  numero: number;
  calificacion: number | null;
  exigible: boolean;
  acreditada: boolean | null;
};

type FilaCurso = {
  estudiante_id: number;
  periodo: string;
  clave_asignatura: string;
  registrado: boolean;
};

export async function cargarReglas(
  sql: Sql,
  institucionId: number,
  version: string,
): Promise<ReglaSemaforo[]> {
  const filas = await sql<
    Array<{
      codigo: string;
      version: string;
      prioridad: number;
      nivel: ReglaSemaforo['nivel'];
      titulo: string;
      descripcion: string;
      condicion: unknown;
      accion: string;
      activa: boolean;
    }>
  >`
    select codigo, version, prioridad, nivel, titulo, descripcion, condicion, accion, activa
    from regla_semaforo
    where institucion_id = ${institucionId}
      and version = ${version}
      and vigencia_desde <= current_date
      and (vigencia_hasta is null or vigencia_hasta >= current_date)
    order by prioridad desc
  `;
  return filas.map((fila) => ({
    codigo: fila.codigo,
    version: fila.version,
    prioridad: fila.prioridad,
    nivel: fila.nivel,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    condicion: fila.condicion as CondicionRegla,
    accion: fila.accion,
    activa: fila.activa,
  }));
}

export async function versionReglasVigente(sql: Sql): Promise<string> {
  return valorConfiguracion(sql, 'version_reglas', 'RA-2026.2-v1');
}

export async function recalcularPeriodo(
  sql: Sql,
  opciones: OpcionesRecalculo,
): Promise<ResumenRecalculo> {
  const { institucionId, periodo, version } = opciones;
  const asignaturasEsperadas =
    opciones.asignaturasEsperadas ??
    Number(await valorConfiguracion(sql, 'asignaturas_esperadas_periodo', 6));

  const reglas = await cargarReglas(sql, institucionId, version);
  if (reglas.length === 0) {
    throw new Error(`No hay reglas activas para la versión ${version}.`);
  }

  const referencia = await periodoAnterior(sql, periodo, institucionId);
  const estudiantes = await sql<Array<{ id: number; semestre: number }>>`
    select id, semestre
    from estudiante
    where institucion_id = ${institucionId} or institucion_id is null
    order by id
  `;

  const filasAsignaturas = await sql<FilaAsignatura[]>`
    select a.estudiante_id, a.periodo, a.clave_asignatura,
           a.calificacion::float8 as calificacion, a.resultado
    from asignatura_resultado a
    join estudiante e on e.id = a.estudiante_id
    where (e.institucion_id = ${institucionId} or e.institucion_id is null)
      and a.periodo in (${periodo}, ${referencia ?? periodo})
    order by a.estudiante_id, a.periodo, a.clave_asignatura
  `;

  const filasParciales = await sql<FilaParcial[]>`
    select p.estudiante_id, p.periodo, p.clave_asignatura, p.numero,
           p.calificacion::float8 as calificacion, p.exigible, p.acreditada
    from evaluacion_parcial p
    join estudiante e on e.id = p.estudiante_id
    where (e.institucion_id = ${institucionId} or e.institucion_id is null)
      and p.periodo = ${periodo}
    order by p.estudiante_id, p.clave_asignatura, p.numero
  `;

  const filasCursos = await sql<FilaCurso[]>`
    select c.estudiante_id, c.periodo, c.clave_asignatura, c.registrado
    from curso_especial c
    join estudiante e on e.id = c.estudiante_id
    where (e.institucion_id = ${institucionId} or e.institucion_id is null)
      and c.periodo = ${periodo}
  `;

  const antecedentes = new Set<number>();
  if (referencia) {
    const filasAntecedente = await sql<Array<{ estudiante_id: number; materias_reprobadas: number }>>`
      select t.estudiante_id, max(t.materias_reprobadas)::int as materias_reprobadas
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where (e.institucion_id = ${institucionId} or e.institucion_id is null)
        and t.periodo < ${referencia}
      group by t.estudiante_id
    `;
    for (const fila of filasAntecedente) {
      if (fila.materias_reprobadas > 0) antecedentes.add(fila.estudiante_id);
    }
  }

  const porEstudianteAsignaturas = agrupar(filasAsignaturas, (fila) => fila.estudiante_id);
  const porEstudianteParciales = agrupar(filasParciales, (fila) => fila.estudiante_id);
  const porEstudianteCursos = agrupar(filasCursos, (fila) => fila.estudiante_id);

  const resumen: ResumenRecalculo = {
    periodo,
    version,
    evaluados: 0,
    clasificados: 0,
    informacion_insuficiente: 0,
    inconsistencias: 0,
    sin_trayectoria: 0,
  };

  for (const estudiante of estudiantes) {
    const asignaturas = porEstudianteAsignaturas.get(estudiante.id) ?? [];
    const referenciaHechos = asignaturas
      .filter((fila) => fila.periodo === referencia)
      .map((fila) => ({
        clave: fila.clave_asignatura,
        calificacion: fila.calificacion,
        resultado: fila.resultado,
      })) satisfies AsignaturaHecho[];
    const actuales = asignaturas
      .filter((fila) => fila.periodo === periodo)
      .map((fila) => ({
        clave: fila.clave_asignatura,
        calificacion: fila.calificacion,
        resultado: fila.resultado,
      })) satisfies AsignaturaHecho[];
    const parciales = (porEstudianteParciales.get(estudiante.id) ?? []).map((fila) => ({
      clave: fila.clave_asignatura,
      numero: fila.numero,
      calificacion: fila.calificacion,
      exigible: fila.exigible,
      acreditada: fila.acreditada,
    })) satisfies ParcialHecho[];
    const cursos = (porEstudianteCursos.get(estudiante.id) ?? []).map((fila) => ({
      clave: fila.clave_asignatura,
      registrado: fila.registrado,
    })) satisfies CursoEspecialHecho[];

    const hechos: HechosSemaforo = {
      periodo,
      periodoReferencia: referencia,
      asignaturasReferencia: referenciaHechos,
      asignaturasActuales: actuales,
      parcialesActuales: parciales,
      cursoEspecial: cursos,
      antecedenteReprobacion: antecedentes.has(estudiante.id),
      asignaturasEsperadasPeriodo: asignaturasEsperadas,
    };

    const resultado = evaluarReglas(hechos, reglas, version);
    const actualizado = await guardarEvaluacion(
      sql,
      institucionId,
      estudiante.id,
      periodo,
      referencia,
      resultado,
    );
    resumen.evaluados += 1;
    if (!actualizado) {
      resumen.sin_trayectoria += 1;
      continue;
    }
    if (resultado.estado_datos === 'clasificado') resumen.clasificados += 1;
    else if (resultado.estado_datos === 'inconsistencia') resumen.inconsistencias += 1;
    else resumen.informacion_insuficiente += 1;
  }

  return resumen;
}

/**
 * Calcula y guarda la etiqueta observada del periodo siguiente. Sin esta
 * etiqueta el modelo no puede entrenarse de forma honesta.
 */
export async function marcarRiesgoObservado(sql: Sql, institucionId: number): Promise<number> {
  const filas = await sql<
    Array<{
      estudiante_id: number;
      periodo: string;
      materias_reprobadas: number;
      promedio_periodo: number;
    }>
  >`
    select t.estudiante_id, t.periodo, t.materias_reprobadas, t.promedio_periodo::float8 as promedio_periodo
    from trayectoria_periodo t
    join estudiante e on e.id = t.estudiante_id
    where (e.institucion_id = ${institucionId} or e.institucion_id is null)
    order by t.estudiante_id, t.periodo
  `;

  const porEstudiante = agrupar(filas, (fila) => fila.estudiante_id);
  let actualizados = 0;
  for (const periodoActual of porEstudiante.values()) {
    for (let indice = 0; indice < periodoActual.length - 1; indice += 1) {
      const actual = periodoActual[indice];
      const siguiente = periodoActual[indice + 1];
      const etiqueta = etiquetaObservada({
        materias_reprobadas: Number(siguiente.materias_reprobadas),
        promedio_periodo: Number(siguiente.promedio_periodo),
      });
      await sql`
        update trayectoria_periodo
        set riesgo_observado = ${etiqueta}
        where estudiante_id = ${actual.estudiante_id} and periodo = ${actual.periodo}
      `;
      actualizados += 1;
    }
  }
  return actualizados;
}

async function guardarEvaluacion(
  sql: Sql,
  institucionId: number,
  estudianteId: number,
  periodo: string,
  periodoReferencia: string | null,
  resultado: ResultadoEvaluacion,
): Promise<boolean> {
  const trayectorias = await sql<Array<{ id: number }>>`
    update trayectoria_periodo
    set nivel_alerta = ${resultado.nivel},
        puntos_alerta = ${resultado.puntos},
        senales = ${sql.array(resultado.senales)},
        accion_sugerida = ${resultado.accion_sugerida},
        version_reglas = ${resultado.version},
        periodo_referencia = ${periodoReferencia},
        estado_datos = ${resultado.estado_datos},
        reglas_activadas = ${sql.json(resultado.reglas_activadas)},
        cobertura_datos = ${sql.json(resultado.cobertura)},
        actualizado_en = now()
    where estudiante_id = ${estudianteId}
      and periodo = ${periodo}
    returning id
  `;
  if (!trayectorias[0]) return false;

  await sql`
    insert into evaluacion_riesgo (
      estudiante_id, institucion_id, periodo, periodo_referencia, version_reglas,
      estado_datos, nivel, puntos, reglas_activadas, cobertura_datos
    ) values (
      ${estudianteId}, ${institucionId}, ${periodo}, ${periodoReferencia}, ${resultado.version},
      ${resultado.estado_datos}, ${resultado.nivel}, ${resultado.puntos},
      ${sql.json(resultado.reglas_activadas)}, ${sql.json(resultado.cobertura)}
    )
    on conflict (estudiante_id, periodo, version_reglas) do update
    set estado_datos = excluded.estado_datos,
        nivel = excluded.nivel,
        puntos = excluded.puntos,
        reglas_activadas = excluded.reglas_activadas,
        cobertura_datos = excluded.cobertura_datos,
        calculado_en = now()
  `;

  return true;
}

function agrupar<T, K>(filas: T[], clave: (fila: T) => K): Map<K, T[]> {
  const mapa = new Map<K, T[]>();
  for (const fila of filas) {
    const valor = clave(fila);
    const lista = mapa.get(valor);
    if (lista) lista.push(fila);
    else mapa.set(valor, [fila]);
  }
  return mapa;
}
