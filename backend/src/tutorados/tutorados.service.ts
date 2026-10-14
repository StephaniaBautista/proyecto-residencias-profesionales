import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { fechaCorta, numero } from '../comun/fechas';
import type { UsuarioSesion } from '../comun/usuario';
import { ModeloService } from '../ml/modelo.service';
import type { ClaveRasgo } from '../ml/modelo';
import { recalcularAlertas } from '../alertas/recalcular';

const PERIODO_BASE = '2026-1';

type Filtro = { periodo: string; grupo?: string; nivel?: string };

@Injectable()
export class TutoradosService {
  constructor(
    private readonly db: BaseDatos,
    private readonly modelo: ModeloService,
  ) {}

  async catalogos(usuario: UsuarioSesion) {
    const periodos = await this.db.sql<{ periodo: string }[]>`
      select distinct t.periodo
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where true ${this.alcance(usuario)}
      order by t.periodo
    `;
    const grupos = await this.db.sql<{ grupo: string }[]>`
      select distinct e.grupo
      from estudiante e
      where true ${this.alcance(usuario)}
      order by e.grupo
    `;
    return {
      periodos: periodos.map((fila) => fila.periodo),
      grupos: grupos.map((fila) => fila.grupo),
    };
  }

  async tablero(usuario: UsuarioSesion, filtro: Filtro) {
    const catalogo = await this.catalogos(usuario);
    const conteosFilas = await this.db.sql<{ nivel_alerta: string; total: number }[]>`
      select t.nivel_alerta, count(*)::int as total
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where t.periodo = ${filtro.periodo}
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
      group by t.nivel_alerta
    `;
    const conteos = { verde: 0, amarillo: 0, rojo: 0 };
    for (const fila of conteosFilas) {
      if (fila.nivel_alerta === 'verde' || fila.nivel_alerta === 'amarillo' || fila.nivel_alerta === 'rojo') {
        conteos[fila.nivel_alerta] = fila.total;
      }
    }
    const casos = await this.db.sql<
      Array<{
        id_anonimo: string;
        grupo: string;
        carrera: string;
        semestre: number;
        nivel_alerta: 'verde' | 'amarillo' | 'rojo';
        puntos_alerta: number;
        senales: string[];
      }>
    >`
      select e.id_anonimo, e.grupo, e.carrera, e.semestre, t.nivel_alerta, t.puntos_alerta, t.senales
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
      where t.periodo = ${filtro.periodo}
        and t.nivel_alerta in ('amarillo', 'rojo')
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
      order by t.puntos_alerta desc, e.id_anonimo
      limit 12
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
      limit 8
    `;
    const alertas = await this.db.sql<{ total: number }[]>`
      select count(*)::int as total
      from alerta al
      join estudiante e on e.id = al.estudiante_id
      where al.estado = 'pendiente'
        and al.periodo = ${filtro.periodo}
        ${this.grupo(filtro.grupo)}
        ${this.alcance(usuario)}
    `;
    return {
      periodo: filtro.periodo,
      grupo: filtro.grupo ?? null,
      ...catalogo,
      conteos,
      casos: casos.map((caso) => ({
        id_anonimo: caso.id_anonimo,
        grupo: caso.grupo,
        carrera: caso.carrera,
        semestre: caso.semestre,
        nivel_alerta: caso.nivel_alerta,
        puntos: caso.puntos_alerta,
        senales: caso.senales,
      })),
      alertas_pendientes: alertas[0]?.total ?? 0,
      proximas_revisiones: proximas.map((fila) => ({
        id_anonimo: fila.id_anonimo,
        tipo: fila.tipo,
        fecha_compromiso: fechaCorta(fila.fecha_compromiso),
        estatus: fila.estatus,
      })),
      leyenda: 'El color sale de las reglas documentadas. El modelo de riesgo solo sugiere y no cambia el semáforo.',
    };
  }

  async listar(usuario: UsuarioSesion, filtro: Filtro) {
    const catalogo = await this.catalogos(usuario);
    const filas = await this.db.sql<
      Array<{
        id_anonimo: string;
        grupo: string;
        carrera: string;
        semestre: number;
        nivel_alerta: 'verde' | 'amarillo' | 'rojo';
        puntos_alerta: number;
        promedio_periodo: number;
        porcentaje_asistencia: number;
        materias_reprobadas: number;
        avance_curricular: number;
        acuerdos_vencidos: number;
      }>
    >`
      select
        e.id_anonimo, e.grupo, e.carrera, e.semestre,
        t.nivel_alerta, t.puntos_alerta,
        t.promedio_periodo::float8 as promedio_periodo,
        t.porcentaje_asistencia::float8 as porcentaje_asistencia,
        t.materias_reprobadas,
        t.avance_curricular::float8 as avance_curricular,
        t.acuerdos_vencidos
      from estudiante e
      join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = ${filtro.periodo}
      where true
        ${this.grupo(filtro.grupo)}
        ${filtro.nivel ? this.db.sql`and t.nivel_alerta = ${filtro.nivel}` : this.db.sql``}
        ${this.alcance(usuario)}
      order by t.puntos_alerta desc, e.id_anonimo
      limit 200
    `;
    return { periodo: filtro.periodo, ...catalogo, tutorados: filas };
  }

  async ficha(usuario: UsuarioSesion, idAnonimo: string, periodo = PERIODO_BASE) {
    const estudiante = await this.buscar(usuario, idAnonimo);
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
        nivel_alerta: 'verde' | 'amarillo' | 'rojo';
        senales: string[];
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
        senales,
        accion_sugerida
      from trayectoria_periodo
      where estudiante_id = ${estudiante.id} and periodo = ${periodo}
    `;
    const actual = trayectoria[0];
    if (!actual) throw new NotFoundException('No hay trayectoria para ese periodo.');

    const [asignaturas, sesiones, acciones, intervenciones, revisiones] = await Promise.all([
      this.db.sql`
        select clave_asignatura, nombre_asignatura, creditos, calificacion::float8 as calificacion, resultado, oportunidad
        from asignatura_resultado
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
        select tipo_apoyo, taller, area_responsable, fecha_inicio, fecha_cierre, asistencia_apoyo::float8 as asistencia_apoyo, resultado
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
      },
      trayectoria: actual,
      asignaturas,
      sesiones: sesiones.map((fila) => this.fechasFila(fila as Record<string, unknown>, ['fecha_sesion', 'fecha_compromiso'])),
      acciones: acciones.map((fila) => this.fechasFila(fila as Record<string, unknown>, ['fecha_compromiso', 'creado_en'])),
      intervenciones: intervenciones.map((fila) => this.fechasFila(fila as Record<string, unknown>, ['fecha_inicio', 'fecha_cierre'])),
      revisiones: revisiones.map((fila) => this.fechasFila(fila as Record<string, unknown>, ['creado_en'])),
      modelo: await this.modelo.predecir(rasgos),
      aviso: 'Ficha de apoyo. No sustituye la decisión profesional ni autoriza el uso de datos personales.',
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
    await recalcularAlertas(this.db.sql, PERIODO_BASE);
    await registrarBitacora(this.db.sql, usuario.id, 'crear_accion', 'accion_tutorial', insertada[0]?.id ?? null, {
      id_anonimo: idAnonimo,
      tipo: datos.tipo,
    });
    return { id: insertada[0]?.id, ok: true };
  }

  async crearRevision(
    usuario: UsuarioSesion,
    idAnonimo: string,
    datos: { estatus: string; comentario: string },
    periodo = PERIODO_BASE,
  ) {
    const estudiante = await this.buscar(usuario, idAnonimo);
    const insertada = await this.db.sql<{ id: number }[]>`
      insert into revision_ficha (estudiante_id, periodo, revisor_id, estatus, comentario)
      values (${estudiante.id}, ${periodo}, ${usuario.id}, ${datos.estatus}, ${datos.comentario})
      returning id
    `;
    await recalcularAlertas(this.db.sql, periodo);
    await registrarBitacora(this.db.sql, usuario.id, 'revisar_ficha', 'revision_ficha', insertada[0]?.id ?? null, {
      id_anonimo: idAnonimo,
      estatus: datos.estatus,
    });
    return { id: insertada[0]?.id, ok: true };
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
      }>
    >`
      select id, id_anonimo, carrera, semestre, generacion, plan_estudios, modalidad, grupo,
             estatus_academico, fuente_sintetica, tutor_id
      from estudiante e
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
      if (valor instanceof Date) copia[campo] = valor.toISOString().slice(0, campo === 'creado_en' ? 19 : 10);
    }
    return copia;
  }
}
