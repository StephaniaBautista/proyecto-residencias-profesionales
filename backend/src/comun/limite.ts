import type { Sql } from '../base-datos/conexion';

/**
 * Límite de acceso persistente. Sobre la tabla `limite_acceso`, por lo que
 * funciona entre reinicios y entre instancias (a diferencia del mapa en memoria).
 */
export async function permitirAcceso(
  sql: Sql,
  clave: string,
  maximo: number,
  ventanaMs: number,
): Promise<boolean> {
  const segundos = Math.max(1, Math.round(ventanaMs / 1000));
  const filas = await sql<{ total: number }[]>`
    select count(*)::int as total
    from limite_acceso
    where clave = ${clave}
      and marca >= now() - (${segundos} * interval '1 second')
  `;
  if ((filas[0]?.total ?? 0) >= maximo) return false;
  await sql`insert into limite_acceso (clave) values (${clave})`;
  return true;
}

export async function limpiarLimites(sql: Sql): Promise<void> {
  await sql`delete from limite_acceso where marca < now() - interval '1 day'`;
}
