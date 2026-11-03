import type { Sql } from '../base-datos/conexion';

/**
 * Recalcula las alertas de un periodo con base en el estado actual de las
 * trayectorias y de las acciones tutoriales. Es idempotente.
 */
export async function recalcularAlertas(sql: Sql, periodo: string): Promise<void> {
  // 1. Rojo sin revisión: se cierra si ya hay revisión de asesoría en el periodo.
  await sql`
    update alerta a
    set estado = 'atendida', atendida_en = now()
    where a.estado = 'pendiente'
      and a.tipo = 'rojo_sin_revision'
      and a.periodo = ${periodo}
      and exists (
        select 1 from revision_ficha r
        where r.estudiante_id = a.estudiante_id
          and r.periodo = a.periodo
      )
  `;

  // 2. Rojo sin revisión: se cierra si el estudiante dejó de estar en rojo.
  await sql`
    update alerta a
    set estado = 'atendida', atendida_en = now()
    where a.estado = 'pendiente'
      and a.tipo = 'rojo_sin_revision'
      and a.periodo = ${periodo}
      and not exists (
        select 1 from trayectoria_periodo t
        where t.estudiante_id = a.estudiante_id
          and t.periodo = a.periodo
          and t.nivel_alerta = 'rojo'
      )
  `;

  // 3. Nueva alerta de rojo sin revisión.
  await sql`
    insert into alerta (estudiante_id, periodo, tipo, mensaje, prioridad, estado)
    select
      e.id,
      t.periodo,
      'rojo_sin_revision',
      e.id_anonimo || ' está en rojo y no tiene revisión de asesoría en ' || t.periodo || '.',
      'alta',
      'pendiente'
    from estudiante e
    join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = ${periodo}
    where t.nivel_alerta = 'rojo'
      and not exists (
        select 1 from revision_ficha r
        where r.estudiante_id = e.id and r.periodo = t.periodo
      )
      and not exists (
        select 1 from alerta a
        where a.estudiante_id = e.id
          and a.periodo = t.periodo
          and a.tipo = 'rojo_sin_revision'
          and a.estado = 'pendiente'
      )
  `;

  // 4. Alertas de calidad de datos: se cierran si el estado ya cambió.
  await sql`
    update alerta a
    set estado = 'atendida', atendida_en = now()
    where a.estado = 'pendiente'
      and a.tipo = 'datos_incompletos'
      and a.periodo = ${periodo}
      and not exists (
        select 1 from trayectoria_periodo t
        where t.estudiante_id = a.estudiante_id
          and t.periodo = a.periodo
          and t.estado_datos = 'informacion_insuficiente'
      )
  `;

  await sql`
    update alerta a
    set estado = 'atendida', atendida_en = now()
    where a.estado = 'pendiente'
      and a.tipo = 'inconsistencia_datos'
      and a.periodo = ${periodo}
      and not exists (
        select 1 from trayectoria_periodo t
        where t.estudiante_id = a.estudiante_id
          and t.periodo = a.periodo
          and t.estado_datos = 'inconsistencia'
      )
  `;

  // 5. Nuevas alertas de información insuficiente.
  await sql`
    insert into alerta (estudiante_id, periodo, tipo, mensaje, prioridad, estado)
    select
      e.id,
      t.periodo,
      'datos_incompletos',
      e.id_anonimo || ' tiene datos indispensables incompletos para clasificar el periodo ' || t.periodo || '.',
      'alta',
      'pendiente'
    from estudiante e
    join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = ${periodo}
    where t.estado_datos = 'informacion_insuficiente'
      and not exists (
        select 1 from alerta a
        where a.estudiante_id = e.id
          and a.periodo = t.periodo
          and a.tipo = 'datos_incompletos'
          and a.estado = 'pendiente'
      )
  `;

  // 6. Nuevas alertas de inconsistencia.
  await sql`
    insert into alerta (estudiante_id, periodo, tipo, mensaje, prioridad, estado)
    select
      e.id,
      t.periodo,
      'inconsistencia_datos',
      e.id_anonimo || ' presenta datos contradictorios en el periodo ' || t.periodo || '; requiere validación.',
      'alta',
      'pendiente'
    from estudiante e
    join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = ${periodo}
    where t.estado_datos = 'inconsistencia'
      and not exists (
        select 1 from alerta a
        where a.estudiante_id = e.id
          and a.periodo = t.periodo
          and a.tipo = 'inconsistencia_datos'
          and a.estado = 'pendiente'
      )
  `;

  // 7. Acción por vencer: se cierra si la acción ya no está en seguimiento
  //    o si su fecha se movió fuera de la ventana de 7 días.
  await sql`
    update alerta a
    set estado = 'atendida', atendida_en = now()
    where a.estado = 'pendiente'
      and a.tipo = 'accion_por_vencer'
      and not exists (
        select 1 from accion_tutorial acc
        where acc.id = a.referencia_id
          and acc.estatus = 'en_seguimiento'
          and acc.fecha_compromiso <= current_date + 7
      )
  `;

  // 8. Nueva alerta de acción por vencer.
  await sql`
    insert into alerta (estudiante_id, periodo, tipo, mensaje, prioridad, estado, referencia_id)
    select
      acc.estudiante_id,
      ${periodo},
      'accion_por_vencer',
      e.id_anonimo || ' tiene la acción ' || acc.tipo || ' con compromiso ' || to_char(acc.fecha_compromiso, 'YYYY-MM-DD') || '.',
      case when acc.fecha_compromiso < current_date then 'alta' else 'media' end,
      'pendiente',
      acc.id
    from accion_tutorial acc
    join estudiante e on e.id = acc.estudiante_id
    where acc.estatus = 'en_seguimiento'
      and acc.fecha_compromiso <= current_date + 7
      and not exists (
        select 1 from alerta a
        where a.referencia_id = acc.id
          and a.tipo = 'accion_por_vencer'
          and a.estado = 'pendiente'
      )
  `;
}
