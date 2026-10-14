import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decoradores';
import {
  esquemaAccion,
  esquemaAnonimo,
  esquemaGrupo,
  esquemaNivel,
  esquemaPeriodo,
  esquemaRevision,
  leerCuerpo,
  textoOpcional,
} from '../comun/validar';
import { TutoradosService } from './tutorados.service';

@Controller()
export class TutoradosController {
  constructor(private readonly tutorados: TutoradosService) {}

  @Get('catalogos')
  catalogos(@Req() req: Request) {
    return this.tutorados.catalogos(req.usuario!);
  }

  @Get('tablero')
  tablero(@Req() req: Request, @Query('periodo') periodo?: string, @Query('grupo') grupo?: string) {
    return this.tutorados.tablero(req.usuario!, leerFiltro(periodo, grupo));
  }

  @Get('tutorados')
  listar(
    @Req() req: Request,
    @Query('periodo') periodo?: string,
    @Query('grupo') grupo?: string,
    @Query('nivel') nivel?: string,
  ) {
    return this.tutorados.listar(req.usuario!, leerFiltro(periodo, grupo, nivel));
  }

  @Get('tutorados/:idAnonimo')
  ficha(@Req() req: Request, @Param('idAnonimo') idAnonimo: string, @Query('periodo') periodo?: string) {
    return this.tutorados.ficha(req.usuario!, exigirAnonimo(idAnonimo), periodo ? exigirPeriodo(periodo) : '2026-1');
  }

  @Post('tutorados/:idAnonimo/acciones')
  accion(@Req() req: Request, @Param('idAnonimo') idAnonimo: string, @Body() cuerpo: unknown) {
    return this.tutorados.crearAccion(req.usuario!, exigirAnonimo(idAnonimo), leerCuerpo(esquemaAccion, cuerpo));
  }

  @Roles('asesoria')
  @Post('tutorados/:idAnonimo/revisiones')
  revision(@Req() req: Request, @Param('idAnonimo') idAnonimo: string, @Body() cuerpo: unknown) {
    return this.tutorados.crearRevision(req.usuario!, exigirAnonimo(idAnonimo), leerCuerpo(esquemaRevision, cuerpo));
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

function leerFiltro(periodo?: string, grupo?: string, nivel?: string) {
  const periodoTexto = textoOpcional(periodo) ?? '2026-1';
  const grupoTexto = textoOpcional(grupo);
  const nivelTexto = textoOpcional(nivel);
  const periodoOk = esquemaPeriodo.safeParse(periodoTexto);
  if (!periodoOk.success) throw new BadRequestException('El periodo no es válido.');
  let grupoOk: 'GRP-A' | 'GRP-B' | 'GRP-C' | undefined;
  if (grupoTexto) {
    const parsed = esquemaGrupo.safeParse(grupoTexto);
    if (!parsed.success) throw new BadRequestException('El grupo no es válido.');
    grupoOk = parsed.data;
  }
  let nivelOk: 'verde' | 'amarillo' | 'rojo' | undefined;
  if (nivelTexto) {
    const parsed = esquemaNivel.safeParse(nivelTexto);
    if (!parsed.success) throw new BadRequestException('El nivel no es válido.');
    nivelOk = parsed.data;
  }
  return { periodo: periodoOk.data, grupo: grupoOk, nivel: nivelOk };
}
