import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Publico } from './decoradores';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('ingreso')
  ingreso(@Body() cuerpo: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.ingresar(cuerpo, req, res);
  }

  @Post('salir')
  salir(@Res({ passthrough: true }) res: Response) {
    return this.auth.salir(res);
  }

  @Get('yo')
  yo(@Req() req: Request) {
    return { usuario: req.usuario };
  }
}
