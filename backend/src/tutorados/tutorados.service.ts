import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { catalogoCarreras, catalogoGrupos, valorConfiguracion } from '../comun/catalogos';
import { fechaCorta, numero } from '../comun/fechas';
import { institucionActiva, listaPeriodos, periodoActivo } from '../comun/periodo';
import type { UsuarioSesion } from '../comun/usuario';
import { ModeloService } from '../ml/modelo.service';
import type { ClaveRasgo } from '../ml/modelo';
import { recalcularAlertas } from '../alertas/recalcular';

export type FiltroTutorados = {
  periodo?: string;
  grupo?: string;
  nivel?: string;
  pagina?: number;
  porPagina?: number;
};

const NIVELES = [
  'verde',
  'amarillo',
  'rojo',
  'informacion_insuficiente',
  'inconsistencia',
] as const;

@Injectable()
export class TutoradosService {
  constructor(
    private readonly db: BaseDatos,
    private readonly modelo: ModeloService,
  ) {}

  async catalogos(usuario: UsuarioSesion) {
    return this.contexto(usuario);
  }

  async tablero(usuario: UsuarioSesion, filtro: FiltroTutorados) {
    const contexto = await this.contexto(usuario);
    const periodo = await this.resolverPeriodo(filtro.periodo);
    const limiteCasos = Number(await valorConfiguracion(this.db.sql, 'limite_tablero_casos', 12));
    const limiteProximas = Number(
      await valorConfiguracion(this.db.sql, 'limite_tablero_proximas', 8),
    );

    const conteosFilas = await this.db.sql<{ nivel_alerta: string; total: number }[]>`
      select t.nivel_alerta, count(*)::int as total
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where t.periodo = ${periodo}
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
      group by t.nivel_alerta
    `;
    const conteos: Record<string, number> = Object.fromEntries(NIVELES.map((nivel) => [nivel, 0]));
    for (const fila of conteosFilas) {
      if (NIVELES.includes(fila.nivel_alerta as (typeof NIVELES)[number])) {
        conteos[fila.nivel_alerta] = fila.total;
      }
    }

    const totalCasos = await this.db.sql<{ total: number }[]>`
      select count(*)::int as total
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where t.periodo = ${periodo}
        and t.nivel_alerta in ('amarillo', 'rojo', 'informacion_insuficiente', 'inconsistencia')
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
    `;

    const casos = await this.db.sql<
      Array<{
        id_anonimo: string;
        grupo: string;
        carrera: string;
        semestre: number;
        nivel_alerta: string;
        estado_datos: string;
        puntos_alerta: number;
        senales: string[];
        reglas_activadas: unknown;
      }>
    >`
      select e.id_anonimo, e.grupo, e.carrera, e.semestre, t.nivel_alerta, t.estado_datos,
             t.puntos_alerta, t.senales, t.reglas_activadas
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where t.periodo = ${periodo}
        and t.nivel_alerta in ('amarillo', 'rojo', 'informacion_insuficiente', 'inconsistencia')
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
      order by t.puntos_alerta desc, e.id_anonimo
      limit ${limiteCasos}
    `;

    const totalProximas = await this.db.sql<{ total: number }[]>`
      select count(*)::int as total
      from accion_tutorial a
      join estudiante e on e.id = a.estudiante_id
      where a.estatus = 'en_seguimiento'
        and a.fecha_compromiso <= current_date + 14
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
    `;

    const proximas = await this.db.sql<
      Array<{ id_anonimo: string; tipo: string; fecha_compromiso: Date; estatus: string }>
    >`
      select e.id_anonimo, a.tipo, a.fecha_compromiso, a.estatus
      from accion_tutorial a
      join estudiante e on e.id = a.estudiante_id
      where a.estatus = 'en_seguimiento'
        and a.fecha_compromiso <= current_date + 14
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
      order by a.fecha_compromiso
      limit ${limiteProximas}
    `;

    const alertas = await this.db.sql<{ total: number }[]>`
      select count(*)::int as total
      from alerta al
      join estudiante e on e.id = al.estudiante_id
      where al.estado = 'pendiente'
        and al.periodo = ${periodo}
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
    `;

    return {
      ...contexto,
      periodo,
      grupo: filtro.grupo ?? null,
      conteos,
      casos: casos.map((caso) => ({
        id_anonimo: caso.id_anonimo,
        grupo: caso.grupo,
        carrera: caso.carrera,
        semestre: caso.semestre,
        nivel_alerta: caso.nivel_alerta,
        estado_datos: caso.estado_datos,
        puntos: caso.puntos_alerta,
        senales: caso.senales,
        reglas_activadas: Array.isArray(caso.reglas_activadas) ? caso.reglas_activadas : [],
      })),
      casos_total: totalCasos[0]?.total ?? 0,
      casos_mostrados: casos.length,
      alertas_pendientes: alertas[0]?.total ?? 0,
      proximas_revisiones: proximas.map((fila) => ({
        id_anonimo: fila.id_anonimo,
        tipo: fila.tipo,
        fecha_compromiso: fechaCorta(fila.fecha_compromiso),
        estatus: fila.estatus,
      })),
      proximas_total: totalProximas[0]?.total ?? 0,
      proximas_mostradas: proximas.length,
    };
  }

  async listar(usuario: UsuarioSesion, filtro: FiltroTutorados) {
    const contexto = await this.contexto(usuario);
    const periodo = await this.resolverPeriodo(filtro.periodo);
    const porPagina =
      filtro.porPagina ??
      Number(await valorConfiguracion(this.db.sql, 'tutorados_por_pagina', 25));
    const pagina = Math.max(1, filtro.pagina ?? 1);
    const desplazamiento = (pagina - 1) * porPagina;

    const total = await this.db.sql<{ total: number }[]>`
      select count(*)::int as total
      from estudiante e
      join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = ${periodo}
      where true
        ${this.grupo(filtro.grupo)}
        ${filtro.nivel ? this.db.sql`and t.nivel_alerta = ${filtro.nivel}` : this.db.sql``}
        ${this.alcance(usuario)}
    `;

    const filas = await this.db.sql<
      Array<{
        id_anonimo: string;
        grupo: string;
        carrera: string;
        semestre: number;
        nivel_alerta: string;
        estado_datos: string;
        puntos_alerta: number;
        promedio_periodo: number;
        porcentaje_asistencia: number;
        materias_reprobadas: number;
        avance_curricular: number;
        acuerdos_vencidos: number;
        reglas_activadas: unknown;
      }>
    >`
      select
        e.id_anonimo, e.grupo, e.carrera, e.semestre,
        t.nivel_alerta, t.estado_datos, t.puntos_alerta,
        t.promedio_periodo::float8 as promedio_periodo,
        t.porcentaje_asistencia::float8 as porcentaje_asistencia,
        t.materias_reprobadas,
        t.avance_curricular::float8 as avance_curricular,
        t.acuerdos_vencidos,
        t.reglas_activadas
      from estudiante e
      join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = ${periodo}
      where true
        ${this.grupo(filtro.grupo)}
        ${filtro.nivel ? this.db.sql`and t.nivel_alerta = ${filtro.nivel}` : this.db.sql``}
        ${this.alcance(usuario)}
      order by t.puntos_alerta desc, e.id_anonimo
      limit ${porPagina} offset ${desplazamiento}
    `;

    const totalFilas = total[0]?.total ?? 0;
    return {
      ...contexto,
      periodo,
      total: totalFilas,
      pagina,
      por_pagina: porPagina,
      paginas: Math.max(1, Math.ceil(totalFilas / porPagina)),
      tutorados: filas.map((fila) => ({
        ...fila,
        reglas_activadas: Array.isArray(fila.reglas_activadas) ? fila.reglas_activadas : [],
      })),
    };
  }

  async ficha(usuario: UsuarioSesion, idAnonimo: string, periodoOpcional?: string) {
    const estudiante = await this.buscar(usuario, idAnonimo);
    const contexto = await this.contexto(usuario);
    const periodo = await this.resolverPeriodo(periodoOpcional);

    const trayectoria = await this.db.sql<
      Array<{
        periodo: string;
        creditos_aprobados: number;
        creditos_pendientes: number;
        promedio_periodo: number;
        materias_reprobadas: number;
        porcentaje_asistencia: number;
        avance_curricular: number;
        acuerdos_vencidos: number;
        puntos_alerta: number;
        nivel_alerta: string;
        estado_datos: string;
        senales: string[];
        reglas_activadas: unknown;
        cobertura_datos: unknown;
        version_reglas: string | null;
        periodo_referencia: string | null;
        accion_sugerida: string;
      }>
    >`
      select
        periodo,
        creditos_aprobados::float8 as creditos_aprobados,
        creditos_pendientes::float8 as creditos_pendientes,
        promedio_periodo::float8 as promedio_periodo,
        materias_reprobadas,
        porcentaje_asistencia::float8 as porcentaje_asistencia,
        avance_curricular::float8 as avance_curricular,
        acuerdos_vencidos,
        puntos_alerta,
        nivel_alerta,
        estado_datos,
        senales,
        reglas_activadas,
        cobertura_datos,
        version_reglas,
        periodo_referencia,
        accion_sugerida
      from trayectoria_periodo
      where estudiante_id = ${estudiante.id} and periodo = ${periodo}
    `;
    const actual = trayectoria[0];
    if (!actual) throw new NotFoundException('No hay trayectoria para ese periodo.');

    const [asignaturas, parciales, cursos, sesiones, acciones, intervenciones, revisiones] =
      await Promise.all([
        this.db.sql`
          select clave_asignatura, nombre_asignatura, creditos,
                 calificacion::float8 as calificacion, resultado, oportunidad
          from asignatura_resultado
          where estudiante_id = ${estudiante.id} and periodo = ${periodo}
          order by clave_asignatura
        `,
        this.db.sql`
          select clave_asignatura, numero, calificacion::float8 as calificacion,
                 exigible, acreditada, fuente
          from evaluacion_parcial
          where estudiante_id = ${estudiante.id} and periodo = ${periodo}
          order by clave_asignatura, numero
        `,
        this.db.sql`
          select clave_asignatura, nombre_asignatura, registrado, fuente
          from curso_especial
          where estudiante_id = ${estudiante.id} and periodo = ${periodo}
          order by clave_asignatura
        `,
        this.db.sql`
          select fecha_sesion, tipo_sesion, motivo, acuerdos, fecha_compromiso, estatus_acuerdo, observacion
          from sesion_tutorial
          where estudiante_id = ${estudiante.id}
          order by fecha_sesion desc
        `,
        this.db.sql`
          select id, tipo, fecha_compromiso, estatus, observacion, creado_en
          from accion_tutorial
          where estudiante_id = ${estudiante.id}
          order by creado_en desc
        `,
        this.db.sql`
          select tipo_apoyo, taller, area_responsable, fecha_inicio, fecha_cierre,
                 asistencia_apoyo::float8 as asistencia_apoyo, resultado
          from intervencion_apoyo
          where estudiante_id = ${estudiante.id}
          order by fecha_inicio desc
        `,
        this.db.sql`
          select estatus, comentario, creado_en
          from revision_ficha
          where estudiante_id = ${estudiante.id} and periodo = ${periodo}
          order by creado_en desc
        `,
      ]);

    const rasgos: Record<ClaveRasgo, number> = {
      porcentaje_asistencia: numero(actual.porcentaje_asistencia),
      promedio_periodo: numero(actual.promedio_periodo),
      materias_reprobadas: numero(actual.materias_reprobadas),
      creditos_aprobados: numero(actual.creditos_aprobados),
      avance_curricular: numero(actual.avance_curricular),
      acuerdos_vencidos: numero(actual.acuerdos_vencidos),
      semestre: numero(estudiante.semestre),
    };

    return {
      institucion: contexto.institucion,
      periodo_activo: contexto.periodo_activo,
      estudiante: {
        id_anonimo: estudiante.id_anonimo,
        carrera: estudiante.carrera,
        semestre: estudiante.semestre,
        generacion: estudiante.generacion,
        plan_estudios: estudiante.plan_estudios,
        modalidad: estudiante.modalidad,
        grupo: estudiante.grupo,
        estatus_academico: estudiante.estatus_academico,
        fuente_sintetica: estudiante.fuente_sintetica,
        tutor: estudiante.tutor,
      },
      trayectoria: {
        ...actual,
        reglas_activadas: Array.isArray(actual.reglas_activadas) ? actual.reglas_activadas : [],
        cobertura_datos: actual.cobertura_datos ?? {},
      },
      asignaturas,
      parciales,
      curso_especial: cursos,
      sesiones: sesiones.map((fila) =>
        this.fechasFila(fila as Record<string, unknown>, ['fecha_sesion', 'fecha_compromiso']),
      ),
      acciones: acciones.map((fila) =>
        this.fechasFila(fila as Record<string, unknown>, ['fecha_compromiso', 'creado_en']),
      ),
      intervenciones: intervenciones.map((fila) =>
        this.fechasFila(fila as Record<string, unknown>, ['fecha_inicio', 'fecha_cierre']),
      ),
      revisiones: revisiones.map((fila) =>
        this.fechasFila(fila as Record<string, unknown>, ['creado_en']),
      ),
      modelo: await this.modelo.predecir(rasgos),
      aviso:
        'Ficha de apoyo. No sustituye la decisión profesional ni autoriza el uso de datos personales.',
    };
  }

  async crearAccion(
    usuario: UsuarioSesion,
    idAnonimo: string,
    datos: { tipo: string; fecha_compromiso: string; observacion: string },
  ) {
    if (usuario.rol !== 'tutor') {
      throw new ForbiddenException('Solo el tutor registra acciones de seguimiento.');
    }
    const estudiante = await this.buscar(usuario, idAnonimo);
    const insertada = await this.db.sql<{ id: number }[]>`
      insert into accion_tutorial (estudiante_id, tutor_id, tipo, fecha_compromiso, estatus, observacion)
      values (${estudiante.id}, ${usuario.id}, ${datos.tipo}, ${datos.fecha_compromiso}, 'en_seguimiento', ${datos.observacion})
      returning id
    `;
    const periodo = await periodoActivo(this.db.sql);
    await recalcularAlertas(this.db.sql, periodo);
    await registrarBitacora(this.db.sql, usuario.id, 'crear_accion', 'accion_tutorial', insertada[0]?.id ?? null, {
      id_anonimo: idAnonimo,
      tipo: datos.tipo,
      periodo,
    });
    return { id: insertada[0]?.id, ok: true };
  }

  async cerrarAccion(
    usuario: UsuarioSesion,
    idAnonimo: string,
    accionId: number,
    datos: { estatus: 'cumplida' | 'vencida' | 'cancelada'; observacion: string },
  ) {
    if (usuario.rol !== 'tutor') {
      throw new ForbiddenException('Solo el tutor cierra acciones de seguimiento.');
    }
    const estudiante = await this.buscar(usuario, idAnonimo);
    const filas = await this.db.sql<{ id: number; observacion: string }[]>`
      select id, observacion
      from accion_tutorial
      where id = ${accionId}
        and estudiante_id = ${estudiante.id}
        and tutor_id = ${usuario.id}
    `;
    if (!filas[0]) throw new NotFoundException('No se encontró la acción del tutorado.');
    const observacion = datos.observacion
      ? `${filas[0].observacion} ${datos.observacion}`.trim().slice(0, 500)
      : filas[0].observacion;
    await this.db.sql`
      update accion_tutorial
      set estatus = ${datos.estatus}, observacion = ${observacion}
      where id = ${accionId}
    `;
    const periodo = await periodoActivo(this.db.sql);
    await recalcularAlertas(this.db.sql, periodo);
    await registrarBitacora(this.db.sql, usuario.id, 'cerrar_accion', 'accion_tutorial', accionId, {
      id_anonimo: idAnonimo,
      estatus: datos.estatus,
    });
    return { ok: true };
  }

  async crearRevision(
    usuario: UsuarioSesion,
    idAnonimo: string,
    datos: { estatus: string; comentario: string },
    periodoOpcional?: string,
  ) {
    const estudiante = await this.buscar(usuario, idAnonimo);
    const periodo = await this.resolverPeriodo(periodoOpcional);
    const insertada = await this.db.sql<{ id: number }[]>`
      insert into revision_ficha (estudiante_id, periodo, revisor_id, estatus, comentario)
      values (${estudiante.id}, ${periodo}, ${usuario.id}, ${datos.estatus}, ${datos.comentario})
      returning id
    `;
    await recalcularAlertas(this.db.sql, periodo);
    await registrarBitacora(this.db.sql, usuario.id, 'revisar_ficha', 'revision_ficha', insertada[0]?.id ?? null, {
      id_anonimo: idAnonimo,
      estatus: datos.estatus,
      periodo,
    });
    return { id: insertada[0]?.id, ok: true };
  }

  private async contexto(usuario: UsuarioSesion) {
    const institucion = await institucionActiva(this.db.sql);
    const [periodos, carreras, grupos] = await Promise.all([
      listaPeriodos(this.db.sql, institucion.id),
      catalogoCarreras(this.db.sql, institucion.id),
      this.gruposDelUsuario(usuario, institucion.id),
    ]);
    return {
      institucion: {
        clave: institucion.clave,
        nombre: institucion.nombre,
        nombre_corto: institucion.nombre_corto,
      },
      periodo_activo:
        periodos.find((periodo) => periodo.activo)?.clave ?? periodos.at(-1)?.clave ?? null,
      periodos,
      carreras,
      grupos,
    };
  }

  private async gruposDelUsuario(usuario: UsuarioSesion, institucionId: number) {
    if (usuario.rol === 'tutor') {
      return this.db.sql<Array<{ clave: string; nombre: string }>>`
        select distinct g.clave, g.nombre
        from catalogo_grupo g
        join estudiante e on e.grupo = g.clave and e.institucion_id = g.institucion_id
        where g.institucion_id = ${institucionId}
          and e.tutor_id = ${usuario.id}
        order by g.clave
      `;
    }
    return catalogoGrupos(this.db.sql, institucionId);
  }

  private async resolverPeriodo(periodo?: string): Promise<string> {
    if (!periodo) return periodoActivo(this.db.sql);
    const periodos = await listaPeriodos(this.db.sql);
    if (!periodos.some((fila) => fila.clave === periodo)) {
      throw new BadRequestException('El periodo no existe en el catálogo.');
    }
    return periodo;
  }

  private alcance(usuario: UsuarioSesion) {
    if (usuario.rol === 'tutor') return this.db.sql`and e.tutor_id = ${usuario.id}`;
    return this.db.sql``;
  }

  private grupo(grupo: string | undefined) {
    if (!grupo) return this.db.sql``;
    return this.db.sql`and e.grupo = ${grupo}`;
  }

  private async buscar(usuario: UsuarioSesion, idAnonimo: string) {
    const filas = await this.db.sql<
      Array<{
        id: number;
        id_anonimo: string;
        carrera: string;
        semestre: number;
        generacion: string;
        plan_estudios: string;
        modalidad: string;
        grupo: string;
        estatus_academico: string;
        fuente_sintetica: string;
        tutor_id: number;
        tutor: string | null;
      }>
    >`
      select e.id, e.id_anonimo, e.carrera, e.semestre, e.generacion, e.plan_estudios,
             e.modalidad, e.grupo, e.estatus_academico, e.fuente_sintetica, e.tutor_id,
             u.nombre as tutor
      from estudiante e
      left join usuario u on u.id = e.tutor_id
      where e.id_anonimo = ${idAnonimo}
        ${this.alcance(usuario)}
    `;
    const estudiante = filas[0];
    if (!estudiante) throw new NotFoundException('No se encontró el tutorado.');
    return estudiante;
  }

  private fechasFila(fila: Record<string, unknown>, campos: string[]) {
    const copia: Record<string, unknown> = { ...fila };
    for (const campo of campos) {
      const valor = copia[campo];
      if (valor instanceof Date) {
        copia[campo] = valor.toISOString().slice(0, campo === 'creado_en' ? 19 : 10);
      }
    }
    return copia;
  }
}
