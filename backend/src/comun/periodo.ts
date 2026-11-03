import type { Sql } from '../base-datos/conexion';

export type PeriodoAcademico = {
  clave: string;
  nombre: string;
  activo: boolean;
  cerrado: boolean;
};

export type Institucion = {
  id: number;
  clave: string;
  nombre: string;
  nombre_corto: string;
};

/**
 * La institución activa se resuelve desde la base de datos. El respaldo
 * (semilla de la primera institución) solo se usa antes de correr `seed`.
 */
export async function institucionActiva(sql: Sql): Promise<Institucion> {
  const filas = await sql<Institucion[]>`
    select id, clave, nombre, nombre_corto
    from institucion
    where activa
    order by id
    limit 1
  `;
  if (filas[0]) return filas[0];
  return {
    id: 1,
    clave: 'ITTLA',
    nombre: 'Instituto Tecnológico de Tlalnepantla',
    nombre_corto: 'IT Tlalnepantla',
  };
}

/**
 * Periodo activo según la configuración de la base. Si todavía no hay
 * periodos (antes de `seed`), se deduce la clave a partir de la fecha para
 * no incrustar un ciclo académico fijo en el código.
 */
export async function periodoActivo(sql: Sql, institucionId?: number): Promise<string> {
  const institucion = institucionId ?? (await institucionActiva(sql)).id;
  const filas = await sql<{ clave: string }[]>`
    select clave
    from periodo
    where institucion_id = ${institucion}
    order by activo desc, clave desc
    limit 1
  `;
  if (filas[0]?.clave) return filas[0].clave;
  return periodoPorFecha(new Date());
}

export async function listaPeriodos(sql: Sql, institucionId?: number): Promise<PeriodoAcademico[]> {
  const institucion = institucionId ?? (await institucionActiva(sql)).id;
  return sql<PeriodoAcademico[]>`
    select clave, nombre, activo, cerrado
    from periodo
    where institucion_id = ${institucion}
    order by clave
  `;
}

/** Periodo inmediatamente anterior dentro del catálogo, o null si no existe. */
export async function periodoAnterior(sql: Sql, clave: string, institucionId?: number): Promise<string | null> {
  const institucion = institucionId ?? (await institucionActiva(sql)).id;
  const filas = await sql<{ clave: string }[]>`
    select clave
    from periodo
    where institucion_id = ${institucion}
      and clave < ${clave}
    order by clave desc
    limit 1
  `;
  return filas[0]?.clave ?? null;
}

/**
 * Clave de periodo académico convencional (enero–junio = 1, agosto–diciembre = 2)
 * calculada de la fecha. Solo es respaldo para entornos sin catálogo cargado.
 */
export function periodoPorFecha(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  return `${anio}-${mes >= 8 || mes <= 1 ? 2 : 1}`;
}
