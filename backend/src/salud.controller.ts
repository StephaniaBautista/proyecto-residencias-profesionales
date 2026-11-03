import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Publico } from './auth/decoradores';
import { BaseDatos } from './base-datos/base-datos.service';
import { institucionActiva, periodoActivo } from './comun/periodo';
import { leerEntorno } from './entorno';

@Controller('salud')
export class SaludController {
  constructor(private readonly db: BaseDatos) {}

  @Publico()
  @Get()
  async salud() {
    const entorno = leerEntorno();
    try {
      const base = await this.db.sql<Array<{ ok: number }>>`select 1 as ok`;
      if (!base[0]) throw new Error('sin base');
      const [institucion, periodo, conteos] = await Promise.all([
        institucionActiva(this.db.sql),
        periodoActivo(this.db.sql),
        this.db.sql<{ estudiantes: number; documentos: number }[]>`
          select
            (select count(*)::int from estudiante) as estudiantes,
            (select count(*)::int from documento_rag) as documentos
        `,
      ]);
      const corpus = await this.db.sql<{ fragmentos: number }[]>`
        select count(*)::int as fragmentos from fragmento_rag where embedding is not null
      `;
      return {
        estado: 'ok',
        base: 'ok',
        entorno: entorno.nodeEnv,
        demo: entorno.demoMode,
        institucion: institucion.clave,
        periodo_activo: periodo,
        estudiantes: conteos[0]?.estudiantes ?? 0,
        documentos_rag: conteos[0]?.documentos ?? 0,
        fragmentos_rag: corpus[0]?.fragmentos ?? 0,
        rag_habilitado: Boolean(entorno.openRouterKey) && (corpus[0]?.fragmentos ?? 0) > 0,
      };
    } catch {
      throw new ServiceUnavailableException({ estado: 'degradado', base: 'sin_conexion' });
    }
  }
}
