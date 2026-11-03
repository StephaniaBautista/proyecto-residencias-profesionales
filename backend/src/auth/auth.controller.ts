import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
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

  @Publico()
  @Post('registro')
  registro(@Body() cuerpo: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.registrar(cuerpo, req, res);
  }

  @Publico()
  @HttpCode(200)
  @Post('recuperar')
  recuperar(@Body() cuerpo: unknown, @Req() req: Request) {
    return this.auth.solicitarRecuperacion(cuerpo, req);
  }

  @Publico()
  @HttpCode(200)
  @Post('restablecer')
  restablecer(@Body() cuerpo: unknown, @Req() req: Request) {
    return this.auth.restablecer(cuerpo, req);
  }

  // Endpoints de QA: sólo responden con DEMO_MODE=true. La interfaz no los usa.
  @Publico()
  @Get('demo')
  cuentasDemo() {
    return this.auth.cuentasDemo();
  }

  @Publico()
  @Post('ingreso-demo')
  ingresoDemo(
    @Body() cuerpo: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.ingresarDemo(cuerpo, req, res);
  }

  @Post('salir')
  salir(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.salir(req.usuario, res);
  }

  @Get('yo')
  yo(@Req() req: Request) {
    return { usuario: req.usuario };
  }
}
