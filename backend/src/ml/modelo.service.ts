import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseDatos } from '../base-datos/base-datos.service';
import { institucionActiva } from '../comun/periodo';
import type { UsuarioSesion } from '../comun/usuario';
import type { Sql } from '../base-datos/conexion';
import { registrarEntrenamiento } from './entrenamiento';
import { esModeloArbol, predecirArbol, type ClaveRasgo, type ModeloArbol } from './modelo';

const LEYENDA_BASE =
  'Sugerencia de apoyo. No cambia el color del semáforo y requiere revisión humana.';

@Injectable()
export class ModeloService {
  constructor(private readonly db: BaseDatos) {}

  async vigente() {
    const filas = await this.db.sql<
      Array<{
        id: number;
        version: string;
        algoritmo: string;
        tipo: 'predictivo' | 'explicador';
        motivo: string;
        etiqueta_definicion: string | null;
        metricas: unknown;
        modelo: unknown;
        registros_entrenamiento: number | null;
        registros_prueba: number | null;
        advertencia: string | null;
        entrenado_en: Date;
      }>
    >`
      select id, version, algoritmo, tipo, motivo, etiqueta_definicion, metricas, modelo,
             registros_entrenamiento, registros_prueba, advertencia, entrenado_en
      from modelo_riesgo
      order by entrenado_en desc
      limit 1
    `;
    return filas[0] ?? null;
  }

  async resumen() {
    const fila = await this.vigente();
    if (!fila || !esModeloArbol(fila.modelo)) {
      return { disponible: false as const };
    }
    return {
      disponible: true as const,
      version: fila.version,
      algoritmo: fila.algoritmo,
      tipo: fila.tipo,
      motivo: fila.motivo,
      etiqueta_definicion: fila.etiqueta_definicion,
      metricas: fila.metricas,
      registros_entrenamiento: fila.registros_entrenamiento,
      registros_prueba: fila.registros_prueba,
      advertencia: fila.advertencia,
      entrenado_en: fila.entrenado_en,
      leyenda: this.leyenda(fila.tipo, fila.advertencia),
    };
  }

  async predecir(fila: Record<ClaveRasgo, number>) {
    const vigente = await this.vigente();
    if (!vigente || !esModeloArbol(vigente.modelo)) {
      return { disponible: false as const, leyenda: LEYENDA_BASE };
    }
    const prediccion = predecirArbol(vigente.modelo as ModeloArbol, fila);
    return {
      disponible: true as const,
      tipo: vigente.tipo,
      version: vigente.version,
      algoritmo: 'arbol' as const,
      riesgo: prediccion.clase,
      probabilidad: prediccion.probabilidad,
      reglas: prediccion.reglas,
      advertencia: vigente.advertencia,
      leyenda: this.leyenda(vigente.tipo, vigente.advertencia),
    };
  }

  async entrenar(usuario: UsuarioSesion | null) {
    const institucion = await institucionActiva(this.db.sql);
    try {
      return await this.db.sql.begin(async (tx) => {
        const bloqueo = await tx<{ ok: boolean }[]>`
          select pg_try_advisory_xact_lock(hashtext('apoyo_tutorial_modelo_riesgo')) as ok
        `;
        if (!bloqueo[0]?.ok) {
          throw new BadRequestException('Ya hay un entrenamiento en curso.');
        }
        const resultado = await registrarEntrenamiento(tx as unknown as Sql, {
          institucionId: institucion.id,
          usuarioId: usuario?.id ?? null,
        });
        return {
          disponible: true as const,
          version: resultado.version,
          tipo: resultado.tipo,
          algoritmo: resultado.algoritmo,
          etiqueta_definicion: resultado.etiqueta_definicion,
          advertencia: resultado.advertencia,
          registros_entrenamiento: resultado.registros_entrenamiento,
          registros_prueba: resultado.registros_prueba,
          metricas: resultado.comparacion.metricas,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo entrenar el modelo.',
      );
    }
  }

  private leyenda(tipo: 'predictivo' | 'explicador', advertencia: string | null): string {
    const base =
      tipo === 'predictivo'
        ? 'Sugerencia de apoyo basada en el desempeño observado del siguiente periodo. No cambia el color del semáforo y requiere revisión humana.'
        : 'Explicador de las reglas del semáforo (demostración). No es una predicción de riesgo ni cambia el color; requiere revisión humana.';
    return advertencia ? `${base} ${advertencia}` : base;
  }
}
