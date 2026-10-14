import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { numero } from '../comun/fechas';
import type { UsuarioSesion } from '../comun/usuario';
import type { ClaseRiesgo } from './etiqueta';
import {
  esModeloArbol,
  entrenarComparacion,
  predecirArbol,
  type ClaveRasgo,
  type ComparacionModelos,
  type FilaModelo,
  type ModeloArbol,
} from './modelo';

const LEYENDA =
  'Sugerencia de apoyo. No cambia el color del semáforo y requiere revisión humana.';

let entrenando = false;

@Injectable()
export class ModeloService {
  constructor(private readonly db: BaseDatos) {}

  async vigente() {
    const filas = await this.db.sql<
      Array<{
        id: number;
        version: string;
        algoritmo: string;
        motivo: string;
        metricas: unknown;
        modelo: unknown;
        entrenado_en: Date;
      }>
    >`
      select id, version, algoritmo, motivo, metricas, modelo, entrenado_en
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
      motivo: fila.motivo,
      metricas: fila.metricas,
      entrenado_en: fila.entrenado_en,
    };
  }

  async predecir(fila: Record<ClaveRasgo, number>) {
    const vigente = await this.vigente();
    if (!vigente || !esModeloArbol(vigente.modelo)) {
      return { disponible: false as const, leyenda: LEYENDA };
    }
    const prediccion = predecirArbol(vigente.modelo as ModeloArbol, fila);
    return {
      disponible: true as const,
      algoritmo: 'arbol' as const,
      riesgo: prediccion.clase,
      probabilidad: prediccion.probabilidad,
      reglas: prediccion.reglas,
      leyenda: LEYENDA,
    };
  }

  async entrenar(usuario: UsuarioSesion | null) {
    if (entrenando) {
      throw new BadRequestException('Ya hay un entrenamiento en curso.');
    }
    entrenando = true;
    try {
      const filas = await this.cargarFilas();
      let comparacion: ComparacionModelos;
      try {
        comparacion = entrenarComparacion(filas, 42);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo entrenar el modelo.');
      }
      const version = `arbol-${new Date().toISOString().slice(0, 16)}`;
      const guardado = await this.db.sql<{ id: number }[]>`
        insert into modelo_riesgo (version, algoritmo, motivo, metricas, modelo)
        values (
          ${version},
          ${comparacion.algoritmo},
          ${comparacion.motivo},
          ${this.db.sql.json(comparacion.metricas)},
          ${this.db.sql.json(comparacion.modelo)}
        )
        returning id
      `;
      await registrarBitacora(this.db.sql, usuario?.id ?? null, 'entrenar_modelo', 'modelo_riesgo', guardado[0]?.id ?? null, {
        version,
        exactitud_arbol: comparacion.metricas.arbol.exactitud,
      });
      return this.resumen();
    } finally {
      entrenando = false;
    }
  }

  private async cargarFilas(): Promise<FilaModelo[]> {
    const filas = await this.db.sql<
      Array<Record<ClaveRasgo, unknown> & { riesgo_objetivo: ClaseRiesgo }>
    >`
      select
        t.porcentaje_asistencia::float8 as porcentaje_asistencia,
        t.promedio_periodo::float8 as promedio_periodo,
        t.materias_reprobadas,
        t.creditos_aprobados::float8 as creditos_aprobados,
        t.avance_curricular::float8 as avance_curricular,
        t.acuerdos_vencidos,
        e.semestre,
        t.riesgo_objetivo
      from trayectoria_periodo t
      join estudiante e on e.id = t.estudiante_id
    `;
    if (filas.length < 30) {
      throw new BadRequestException('No hay suficientes registros sintéticos para entrenar.');
    }
    return filas.map((fila) => ({
      porcentaje_asistencia: numero(fila.porcentaje_asistencia),
      promedio_periodo: numero(fila.promedio_periodo),
      materias_reprobadas: numero(fila.materias_reprobadas),
      creditos_aprobados: numero(fila.creditos_aprobados),
      avance_curricular: numero(fila.avance_curricular),
      acuerdos_vencidos: numero(fila.acuerdos_vencidos),
      semestre: numero(fila.semestre),
      riesgo_objetivo: fila.riesgo_objetivo,
    }));
  }
}
