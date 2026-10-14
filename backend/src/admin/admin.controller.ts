import { Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decoradores';
import { BaseDatos } from '../base-datos/base-datos.service';
import { ModeloService } from '../ml/modelo.service';

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
  async bitacora() {
    const filas = await this.db.sql<
      Array<{ id: number; operacion: string; entidad: string; detalle: unknown; creado_en: Date; correo: string | null }>
    >`
      select b.id, b.operacion, b.entidad, b.detalle, b.creado_en, u.correo
      from bitacora b
      left join usuario u on u.id = b.usuario_id
      order by b.creado_en desc
      limit 40
    `;
    return {
      registros: filas.map((fila) => ({
        id: fila.id,
        operacion: fila.operacion,
        entidad: fila.entidad,
        detalle: fila.detalle,
        correo: fila.correo,
        creado_en: fila.creado_en.toISOString(),
      })),
    };
  }

  @Get('corpus')
  async corpus() {
    const filas = await this.db.sql<
      Array<{ titulo: string; emisor: string; nombre_archivo: string; fragmentos: number; ingestado_en: Date | null }>
    >`
      select titulo, emisor, nombre_archivo, fragmentos, ingestado_en
      from documento_rag
      order by id
    `;
    return {
      documentos: filas.map((fila) => ({
        ...fila,
        ingestado_en: fila.ingestado_en ? fila.ingestado_en.toISOString() : null,
      })),
    };
  }
}
