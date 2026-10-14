import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { esquemaConsulta, leerCuerpo } from '../comun/validar';
import { RagService } from './rag.service';

@Controller('consultas')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get()
  recientes(@Req() req: Request) {
    return this.rag.recientes(req.usuario!);
  }

  @Post()
  consultar(@Req() req: Request, @Body() cuerpo: unknown) {
    const datos = leerCuerpo(esquemaConsulta, cuerpo);
    return this.rag.consultar(req.usuario!, datos.pregunta, datos.id_anonimo);
  }
}
