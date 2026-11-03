import type { Sql } from '../base-datos/conexion';
import type { Institucion } from './periodo';

export type Carrera = { clave: string; nombre: string };
export type Grupo = { clave: string; nombre: string };

export async function catalogoCarreras(sql: Sql, institucionId: number): Promise<Carrera[]> {
  return sql<Carrera[]>`
    select clave, nombre
    from catalogo_carrera
    where institucion_id = ${institucionId} and activo
    order by clave
  `;
}

export async function catalogoGrupos(sql: Sql, institucionId: number): Promise<Grupo[]> {
  return sql<Grupo[]>`
    select clave, nombre
    from catalogo_grupo
    where institucion_id = ${institucionId} and activo
    order by clave
  `;
}

export async function existeCarrera(sql: Sql, institucionId: number, clave: string): Promise<boolean> {
  const filas = await sql<{ existe: boolean }[]>`
    select true as existe
    from catalogo_carrera
    where institucion_id = ${institucionId} and clave = ${clave} and activo
    limit 1
  `;
  return Boolean(filas[0]);
}

export async function existeGrupo(sql: Sql, institucionId: number, clave: string): Promise<boolean> {
  const filas = await sql<{ existe: boolean }[]>`
    select true as existe
    from catalogo_grupo
    where institucion_id = ${institucionId} and clave = ${clave} and activo
    limit 1
  `;
  return Boolean(filas[0]);
}

/** Configuración editable desde la base; el valor por omisión vive en quien llama. */
export async function valorConfiguracion<T>(
  sql: Sql,
  clave: string,
  porDefecto: T,
): Promise<T> {
  const filas = await sql<{ valor: unknown }[]>`
    select valor from configuracion where clave = ${clave} limit 1
  `;
  if (!filas[0]) return porDefecto;
  return filas[0].valor as T;
}

export async function configuracionVisible(sql: Sql): Promise<Record<string, unknown>> {
  const filas = await sql<{ clave: string; valor: unknown }[]>`
    select clave, valor from configuracion where visible_ui order by clave
  `;
  const salida: Record<string, unknown> = {};
  for (const fila of filas) salida[fila.clave] = fila.valor;
  return salida;
}

export async function institucionPorId(sql: Sql, id: number): Promise<Institucion | null> {
  const filas = await sql<Institucion[]>`
    select id, clave, nombre, nombre_corto from institucion where id = ${id} limit 1
  `;
  return filas[0] ?? null;
}
