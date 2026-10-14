import { BadRequestException, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { esquemaPeriodo, textoOpcional } from '../comun/validar';
import { AlertasService } from './alertas.service';

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @Get()
  listar(@Req() req: Request, @Query('periodo') periodo?: string) {
    return this.alertas.listar(req.usuario!, periodoValido(periodo));
  }

  @Post(':id/atender')
  atender(@Req() req: Request, @Param('id') id: string) {
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero < 1) {
      throw new BadRequestException('La alerta no es válida.');
    }
    return this.alertas.atender(req.usuario!, numero);
  }
}

function periodoValido(valor: string | undefined): string {
  const texto = textoOpcional(valor);
  if (!texto) return '2026-1';
  const resultado = esquemaPeriodo.safeParse(texto);
  if (!resultado.success) throw new BadRequestException('El periodo no es válido.');
  return resultado.data;
}
