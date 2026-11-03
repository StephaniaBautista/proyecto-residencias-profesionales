import { BadRequestException, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decoradores';
import { BaseDatos } from '../base-datos/base-datos.service';
import { enteroPositivo, textoOpcional } from '../comun/validar';
import { valorConfiguracion } from '../comun/catalogos';
import { institucionActiva, periodoActivo } from '../comun/periodo';
import { ModeloService } from '../ml/modelo.service';
import { recalcularAlertas } from '../alertas/recalcular';
import { recalcularPeriodo, versionReglasVigente } from '../semaforo/evaluacion';

@Controller('admin')
@Roles('admin_tecnico')
export class AdminController {
  constructor(
    private readonly modelo: ModeloService,
    private readonly db: BaseDatos,
  ) {}

  @Get('modelo')
  modeloVigente() {
    return this.modelo.resumen();
  }

  @Post('modelo/entrenar')
  entrenar(@Req() req: Request) {
    return this.modelo.entrenar(req.usuario!);
  }

  @Get('bitacora')
  async bitacora(
    @Query('pagina') pagina?: string,
    @Query('por_pagina') porPagina?: string,
  ) {
    const limite = porPagina
      ? enteroPositivo(porPagina, 40, 5, 200)
      : Number(await valorConfiguracion(this.db.sql, 'limite_bitacora', 40));
    const actual = enteroPositivo(pagina, 1, 1, 10_000);
    const total = await this.db.sql<{ total: number }[]>`select count(*)::int as total from bitacora`;
    const filas = await this.db.sql<
      Array<{
        id: number;
        operacion: string;
        entidad: string;
        detalle: unknown;
        creado_en: Date;
        correo: string | null;
        nombre: string | null;
      }>
    >`
      select b.id, b.operacion, b.entidad, b.detalle, b.creado_en, u.correo, u.nombre
      from bitacora b
      left join usuario u on u.id = b.usuario_id
      order by b.creado_en desc
      limit ${limite} offset ${(actual - 1) * limite}
    `;
    return {
      total: total[0]?.total ?? 0,
      pagina: actual,
      por_pagina: limite,
      registros: filas.map((fila) => ({
        id: fila.id,
        operacion: fila.operacion,
        entidad: fila.entidad,
        detalle: fila.detalle,
        correo: fila.correo,
        nombre: fila.nombre,
        creado_en: fila.creado_en.toISOString(),
      })),
    };
  }

  @Get('corpus')
  async corpus() {
    const filas = await this.db.sql<
      Array<{
        titulo: string;
        emisor: string;
        nombre_archivo: string;
        version: string | null;
        fecha_documento: Date | null;
        institucion_aplicable: string | null;
        vigencia_verificada: boolean;
        permisos: string;
        paginas: number | null;
        url: string | null;
        aprobada_por: string | null;
        fragmentos: number;
        ingestado_en: Date | null;
      }>
    >`
      select titulo, emisor, nombre_archivo, version, fecha_documento, institucion_aplicable,
             vigencia_verificada, permisos, paginas, url, aprobada_por, fragmentos, ingestado_en
      from documento_rag
      order by id
    `;
    return {
      total: filas.length,
      documentos: filas.map((fila) => ({
        ...fila,
        fecha_documento: fila.fecha_documento
          ? fila.fecha_documento.toISOString().slice(0, 10)
          : null,
        ingestado_en: fila.ingestado_en ? fila.ingestado_en.toISOString() : null,
      })),
    };
  }

  @Get('reglas')
  async reglas(@Query('version') version?: string) {
    const institucion = await institucionActiva(this.db.sql);
    const vigente = textoOpcional(version) ?? (await versionReglasVigente(this.db.sql));
    const filas = await this.db.sql<
      Array<{
        codigo: string;
        version: string;
        prioridad: number;
        nivel: string;
        titulo: string;
        descripcion: string;
        condicion: unknown;
        accion: string;
        vigencia_desde: Date;
        vigencia_hasta: Date | null;
        activa: boolean;
        aprobada_por: string | null;
        aprobada_en: Date | null;
      }>
    >`
      select codigo, version, prioridad, nivel, titulo, descripcion, condicion, accion,
             vigencia_desde, vigencia_hasta, activa, aprobada_por, aprobada_en
      from regla_semaforo
      where institucion_id = ${institucion.id} and version = ${vigente}
      order by prioridad desc
    `;
    return {
      version: vigente,
      aprobadas: filas.every((fila) => Boolean(fila.aprobada_por)),
      reglas: filas.map((fila) => ({
        ...fila,
        vigencia_desde: fila.vigencia_desde.toISOString().slice(0, 10),
        vigencia_hasta: fila.vigencia_hasta
          ? fila.vigencia_hasta.toISOString().slice(0, 10)
          : null,
        aprobada_en: fila.aprobada_en ? fila.aprobada_en.toISOString() : null,
      })),
    };
  }

  @Post('semaforo/recalcular')
  async recalcular(@Query('periodo') periodo?: string) {
    const institucion = await institucionActiva(this.db.sql);
    const clave = textoOpcional(periodo) ?? (await periodoActivo(this.db.sql));
    const version = await versionReglasVigente(this.db.sql);
    try {
      const resumen = await recalcularPeriodo(this.db.sql, {
        institucionId: institucion.id,
        periodo: clave,
        version,
      });
      await recalcularAlertas(this.db.sql, clave);
      return { ok: true, ...resumen };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo recalcular el semáforo.',
      );
    }
  }
}
