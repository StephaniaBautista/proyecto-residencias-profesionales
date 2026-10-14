import type { Sql } from '../base-datos/conexion';

export async function recalcularAlertas(sql: Sql, periodo: string): Promise<void> {
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
