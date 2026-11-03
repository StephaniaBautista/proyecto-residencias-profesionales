import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decoradores';
import {
  enteroPositivo,
  esquemaAccion,
  esquemaAnonimo,
  esquemaCierreAccion,
  esquemaGrupo,
  esquemaNivel,
  esquemaPeriodo,
  esquemaRevision,
  leerCuerpo,
  textoOpcional,
} from '../comun/validar';
import { TutoradosService, type FiltroTutorados } from './tutorados.service';

@Controller()
export class TutoradosController {
  constructor(private readonly tutorados: TutoradosService) {}

  @Get('catalogos')
  catalogos(@Req() req: Request) {
    return this.tutorados.catalogos(req.usuario!);
  }

  @Get('tablero')
  tablero(@Req() req: Request, @Query('periodo') periodo?: string, @Query('grupo') grupo?: string) {
    return this.tutorados.tablero(req.usuario!, leerFiltro({ periodo, grupo }));
  }

  @Get('tutorados')
  listar(
    @Req() req: Request,
    @Query('periodo') periodo?: string,
    @Query('grupo') grupo?: string,
    @Query('nivel') nivel?: string,
    @Query('pagina') pagina?: string,
    @Query('por_pagina') porPagina?: string,
  ) {
    const filtro = leerFiltro({ periodo, grupo, nivel });
    return this.tutorados.listar(req.usuario!, {
      ...filtro,
      pagina: enteroPositivo(pagina, 1, 1, 10_000),
      porPagina: porPagina ? enteroPositivo(porPagina, 25, 5, 100) : undefined,
    });
  }

  @Get('tutorados/:idAnonimo')
  ficha(
    @Req() req: Request,
    @Param('idAnonimo') idAnonimo: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.tutorados.ficha(
      req.usuario!,
      exigirAnonimo(idAnonimo),
      periodo ? exigirPeriodo(periodo) : undefined,
    );
  }

  @Post('tutorados/:idAnonimo/acciones')
  accion(@Req() req: Request, @Param('idAnonimo') idAnonimo: string, @Body() cuerpo: unknown) {
    return this.tutorados.crearAccion(
      req.usuario!,
      exigirAnonimo(idAnonimo),
      leerCuerpo(esquemaAccion, cuerpo),
    );
  }

  @Post('tutorados/:idAnonimo/acciones/:accionId/cerrar')
  cerrarAccion(
    @Req() req: Request,
    @Param('idAnonimo') idAnonimo: string,
    @Param('accionId') accionId: string,
    @Body() cuerpo: unknown,
  ) {
    const id = Number(accionId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('La acción no es válida.');
    }
    return this.tutorados.cerrarAccion(
      req.usuario!,
      exigirAnonimo(idAnonimo),
      id,
      leerCuerpo(esquemaCierreAccion, cuerpo),
    );
  }

  @Roles('asesoria')
  @Post('tutorados/:idAnonimo/revisiones')
  revision(
    @Req() req: Request,
    @Param('idAnonimo') idAnonimo: string,
    @Body() cuerpo: unknown,
    @Query('periodo') periodo?: string,
  ) {
    return this.tutorados.crearRevision(
      req.usuario!,
      exigirAnonimo(idAnonimo),
      leerCuerpo(esquemaRevision, cuerpo),
      periodo ? exigirPeriodo(periodo) : undefined,
    );
  }
}

function exigirAnonimo(valor: string): string {
  const resultado = esquemaAnonimo.safeParse(valor);
  if (!resultado.success) throw new BadRequestException('El identificador no es válido.');
  return resultado.data;
}

function exigirPeriodo(valor: string): string {
  const resultado = esquemaPeriodo.safeParse(valor);
  if (!resultado.success) throw new BadRequestException('El periodo no es válido.');
  return resultado.data;
}

function leerFiltro({ periodo, grupo, nivel }: { periodo?: string; grupo?: string; nivel?: string }) {
  const periodoTexto = textoOpcional(periodo);
  if (periodoTexto) exigirPeriodo(periodoTexto);

  let grupoOk: string | undefined;
  if (textoOpcional(grupo)) {
    const parsed = esquemaGrupo.safeParse(grupo);
    if (!parsed.success) throw new BadRequestException('El grupo no es válido.');
    grupoOk = parsed.data;
  }

  let nivelOk: string | undefined;
  if (textoOpcional(nivel)) {
    const parsed = esquemaNivel.safeParse(textoOpcional(nivel));
    if (!parsed.success) throw new BadRequestException('El nivel no es válido.');
    nivelOk = parsed.data;
  }

  return {
    periodo: periodoTexto,
    grupo: grupoOk,
    nivel: nivelOk,
  } satisfies FiltroTutorados;
}
