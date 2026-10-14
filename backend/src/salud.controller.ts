import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Publico } from './auth/decoradores';
import { BaseDatos } from './base-datos/base-datos.service';

@Controller('salud')
export class SaludController {
  constructor(private readonly db: BaseDatos) {}

  @Publico()
  @Get()
  async salud() {
    try {
      await this.db.sql`select 1 as ok`;
      return { estado: 'ok', base: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ estado: 'degradado', base: 'sin_conexion' });
    }
  }
}
