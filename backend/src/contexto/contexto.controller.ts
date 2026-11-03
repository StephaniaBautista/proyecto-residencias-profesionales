import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/decoradores';
import { BaseDatos } from '../base-datos/base-datos.service';
import {
  catalogoCarreras,
  catalogoGrupos,
  configuracionVisible,
  valorConfiguracion,
} from '../comun/catalogos';
import {
  institucionActiva,
  listaPeriodos,
  periodoPorFecha,
  type PeriodoAcademico,
} from '../comun/periodo';
import { leerEntorno } from '../entorno';
import { RagService } from '../rag/rag.service';

type Contexto = {
  institucion: { clave: string; nombre: string; nombre_corto: string };
  periodo_activo: string;
  periodos: PeriodoAcademico[];
  grupos: Array<{ clave: string; nombre: string }>;
  carreras: Array<{ clave: string; nombre: string }>;
  demo: boolean;
  prototipo: boolean;
  version_reglas: string | null;
  banner: string;
  rag: { habilitado: boolean; motivo: string | null };
  auth: { registro: boolean; recuperacion: boolean };
  leyendas: { semaforo: string; modelo: string };
};

@Controller('contexto')
export class ContextoController {
  constructor(
    private readonly db: BaseDatos,
    private readonly ragService: RagService,
  ) {}

  /**
   * Contexto público que la interfaz necesita antes de iniciar sesión:
   * institución, periodos, catálogos y avisos. Si la base todavía no está
   * sembrada, responde un contexto mínimo sin inventar catálogos.
   */
  @Publico()
  @Get()
  async contexto(): Promise<Contexto> {
    const entorno = leerEntorno();
    const rag = await this.estadoRag();
    try {
      const institucion = await institucionActiva(this.db.sql);
      const [periodos, carreras, grupos, config, permitirRegistro, recuperacion] =
        await Promise.all([
          listaPeriodos(this.db.sql, institucion.id),
          catalogoCarreras(this.db.sql, institucion.id),
          catalogoGrupos(this.db.sql, institucion.id),
          configuracionVisible(this.db.sql),
          valorConfiguracion(this.db.sql, 'permitir_registro', true),
          valorConfiguracion(this.db.sql, 'recuperacion_habilitada', true),
        ]);
      const activo = periodos.find((periodo) => periodo.activo)?.clave ?? periodos.at(-1)?.clave;
      return {
        institucion: {
          clave: institucion.clave,
          nombre: institucion.nombre,
          nombre_corto: institucion.nombre_corto,
        },
        periodo_activo: activo ?? periodoPorFecha(new Date()),
        periodos,
        grupos,
        carreras,
        demo: entorno.demoMode,
        prototipo: Boolean(config.prototipo ?? true),
        version_reglas: (config.version_reglas as string | undefined) ?? null,
        banner: String(
          config.banner ??
            'Prototipo con datos sintéticos · Reglas experimentales, no aprobadas por ITTLA',
        ),
        rag,
        auth: {
          registro: Boolean(permitirRegistro),
          recuperacion: Boolean(recuperacion),
        },
        leyendas: {
          semaforo: String(
            config.leyenda_semaforo ??
              'El color se calcula con reglas versionadas y explicables.',
          ),
          modelo: String(
            config.leyenda_modelo ??
              'El modelo sugiere apoyo y no cambia el color del semáforo.',
          ),
        },
      };
    } catch {
      return {
        institucion: {
          clave: 'ITTLA',
          nombre: 'Instituto Tecnológico de Tlalnepantla',
          nombre_corto: 'IT Tlalnepantla',
        },
        periodo_activo: periodoPorFecha(new Date()),
        periodos: [],
        grupos: [],
        carreras: [],
        demo: entorno.demoMode,
        prototipo: true,
        version_reglas: null,
        banner: 'Prototipo sin base de datos inicializada. Ejecuta las migraciones y la semilla.',
        rag,
        auth: { registro: true, recuperacion: true },
        leyendas: {
          semaforo: 'El color se calcula con reglas versionadas y explicables.',
          modelo: 'El modelo sugiere apoyo y no cambia el color del semáforo.',
        },
      };
    }
  }

  private async estadoRag(): Promise<{ habilitado: boolean; motivo: string | null }> {
    const entorno = leerEntorno();
    if (!entorno.openRouterKey) {
      return {
        habilitado: false,
        motivo: 'El asistente normativo no está habilitado en este entorno (falta la clave del proveedor).',
      };
    }
    try {
      const estado = await this.ragService.estado();
      return { habilitado: estado.habilitado, motivo: estado.motivo };
    } catch {
      return { habilitado: false, motivo: 'No se pudo verificar el corpus normativo.' };
    }
  }
}
