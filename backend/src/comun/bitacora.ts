import type { Sql } from '../base-datos/conexion';

export async function registrarBitacora(
  sql: Sql,
  usuarioId: number | null,
  operacion: string,
  entidad: string,
  entidadId: number | null,
  detalle: Record<string, unknown>,
): Promise<void> {
  await sql`
    insert into bitacora (usuario_id, operacion, entidad, entidad_id, detalle)
    values (${usuarioId}, ${operacion}, ${entidad}, ${entidadId}, ${sql.json(JSON.parse(JSON.stringify(detalle)))})
  `;
}
