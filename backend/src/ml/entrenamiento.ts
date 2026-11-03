import type { Sql } from '../base-datos/conexion';
import { registrarBitacora } from '../comun/bitacora';
import { DEFINICION_ETIQUETA, etiquetaObservada, type ClaseRiesgo } from './etiqueta';
import { entrenarComparacion, type ClaveRasgo, type ComparacionModelos, type FilaModelo } from './modelo';

export type ParModelo = FilaModelo & {
  periodo_origen: string;
  periodo_destino: string;
};

export type ResultadoEntrenamiento = {
  version: string;
  tipo: 'predictivo' | 'explicador';
  algoritmo: string;
  etiqueta_definicion: string;
  advertencia: string | null;
  registros_entrenamiento: number;
  registros_prueba: number;
  comparacion: ComparacionModelos;
};

type FilaTrayectoria = {
  estudiante_id: number;
  periodo: string;
  porcentaje_asistencia: number;
  promedio_periodo: number;
  materias_reprobadas: number;
  creditos_aprobados: number;
  avance_curricular: number;
  acuerdos_vencidos: number;
  semestre: number;
  nivel_alerta: string;
};

/**
 * Construye pares (periodo t, periodo t+1) con la etiqueta observada del
 * periodo siguiente. Es la única fuente de entrenamiento del modelo.
 */
export async function cargarParesObservados(
  sql: Sql,
  institucionId: number,
): Promise<{ pares: ParModelo[]; trayectorias: FilaTrayectoria[] }> {
  const filas = await sql<FilaTrayectoria[]>`
    select t.estudiante_id, t.periodo,
           t.porcentaje_asistencia::float8 as porcentaje_asistencia,
           t.promedio_periodo::float8 as promedio_periodo,
           t.materias_reprobadas,
           t.creditos_aprobados::float8 as creditos_aprobados,
           t.avance_curricular::float8 as avance_curricular,
           t.acuerdos_vencidos,
           e.semestre,
           t.nivel_alerta
    from trayectoria_periodo t
    join estudiante e on e.id = t.estudiante_id
    where (e.institucion_id = ${institucionId} or e.institucion_id is null)
    order by t.estudiante_id, t.periodo
  `;

  const porEstudiante = new Map<number, FilaTrayectoria[]>();
  for (const fila of filas) {
    const lista = porEstudiante.get(fila.estudiante_id);
    if (lista) lista.push(fila);
    else porEstudiante.set(fila.estudiante_id, [fila]);
  }

  const pares: ParModelo[] = [];
  for (const trayectorias of porEstudiante.values()) {
    for (let indice = 0; indice < trayectorias.length - 1; indice += 1) {
      const actual = trayectorias[indice];
      const siguiente = trayectorias[indice + 1];
      const etiqueta = etiquetaObservada({
        materias_reprobadas: Number(siguiente.materias_reprobadas),
        promedio_periodo: Number(siguiente.promedio_periodo),
      });
      pares.push({
        porcentaje_asistencia: Number(actual.porcentaje_asistencia),
        promedio_periodo: Number(actual.promedio_periodo),
        materias_reprobadas: Number(actual.materias_reprobadas),
        creditos_aprobados: Number(actual.creditos_aprobados),
        avance_curricular: Number(actual.avance_curricular),
        acuerdos_vencidos: Number(actual.acuerdos_vencidos),
        semestre: Number(actual.semestre),
        riesgo_objetivo: etiqueta,
        periodo_origen: actual.periodo,
        periodo_destino: siguiente.periodo,
      });
    }
  }

  return { pares, trayectorias: filas };
}

export async function registrarEntrenamiento(
  sql: Sql,
  opciones: {
    institucionId: number;
    usuarioId: number | null;
  },
): Promise<ResultadoEntrenamiento> {
  const { pares, trayectorias } = await cargarParesObservados(sql, opciones.institucionId);
  const periodos = [...new Set(pares.map((par) => par.periodo_origen))].sort();
  const ultimoPeriodo = periodos.at(-1);
  const entrenamiento = pares.filter((par) => par.periodo_origen !== ultimoPeriodo);
  const prueba = pares.filter((par) => par.periodo_origen === ultimoPeriodo);

  let comparacion: ComparacionModelos | null = null;
  let tipo: ResultadoEntrenamiento['tipo'] = 'predictivo';
  let advertencia: string | null = null;
  let definicion = DEFINICION_ETIQUETA;
  let filasEntrenamiento = entrenamiento.length;
  let filasPrueba = prueba.length;

  if (entrenamiento.length >= 30 && prueba.length >= 1) {
    try {
      comparacion = entrenarComparacion(entrenamiento, 42, { prueba });
    } catch {
      comparacion = null;
    }
  }
  if (!comparacion && pares.length >= 30) {
    try {
      comparacion = entrenarComparacion(pares, 42);
      tipo = 'predictivo';
      definicion = `${DEFINICION_ETIQUETA} Split aleatorio por falta de historial suficiente para un corte temporal.`;
      advertencia =
        'No hubo suficientes transiciones entre periodos para un split temporal; se usó un split aleatorio estratificado.';
      filasEntrenamiento = pares.length;
      filasPrueba = Math.round(pares.length * 0.3);
    } catch {
      comparacion = null;
    }
  }
  if (!comparacion) {
    const filasExplicador = trayectorias
      .filter((fila) => ['verde', 'amarillo', 'rojo'].includes(fila.nivel_alerta))
      .map((fila) => ({
        porcentaje_asistencia: Number(fila.porcentaje_asistencia),
        promedio_periodo: Number(fila.promedio_periodo),
        materias_reprobadas: Number(fila.materias_reprobadas),
        creditos_aprobados: Number(fila.creditos_aprobados),
        avance_curricular: Number(fila.avance_curricular),
        acuerdos_vencidos: Number(fila.acuerdos_vencidos),
        semestre: Number(fila.semestre),
        riesgo_objetivo: nivelARiesgo(fila.nivel_alerta),
      })) satisfies FilaModelo[];
    comparacion = entrenarComparacion(filasExplicador, 42);
    tipo = 'explicador';
    definicion =
      'Etiqueta derivada del nivel del semáforo (no del desempeño siguiente). Este árbol explica las reglas; no predice riesgo.';
    advertencia =
      'No hay etiquetas observadas suficientes. El modelo es un explicador de reglas y no debe presentarse como predicción.';
    filasEntrenamiento = filasExplicador.length;
    filasPrueba = Math.round(filasExplicador.length * 0.3);
  }

  if (comparacion && comparacion.metricas.linea_base) {
    const base = comparacion.metricas.linea_base;
    if (comparacion.metricas.arbol.exactitud <= base.exactitud) {
      const aviso =
        `El árbol (exactitud ${comparacion.metricas.arbol.exactitud}) no supera la línea base ` +
        `de la clase mayoritaria "${base.clase}" (${base.exactitud}); el conjunto de prueba es pequeño. ` +
        'Debe tratarse como apoyo explicativo, no como predicción validada.';
      advertencia = advertencia ? `${advertencia} ${aviso}` : aviso;
    }
  }

  const versionSugerida = `${tipo === 'predictivo' ? 'arbol-predictivo' : 'arbol-explicador'}-${new Date()
    .toISOString()
    .slice(0, 16)}`;
  const guardado = await sql<{ id: number }[]>`
    insert into modelo_riesgo (
      version, algoritmo, motivo, metricas, modelo, institucion_id, tipo,
      etiqueta_definicion, registros_entrenamiento, registros_prueba, advertencia
    ) values (
      ${versionSugerida},
      ${comparacion.algoritmo},
      ${comparacion.motivo},
      ${sql.json(comparacion.metricas)},
      ${sql.json(comparacion.modelo)},
      ${opciones.institucionId},
      ${tipo},
      ${definicion},
      ${filasEntrenamiento},
      ${filasPrueba},
      ${advertencia}
    )
    returning id
  `;

  await registrarBitacora(sql, opciones.usuarioId, 'entrenar_modelo', 'modelo_riesgo', guardado[0]?.id ?? null, {
    version: versionSugerida,
    tipo,
    exactitud_arbol: comparacion.metricas.arbol.exactitud,
  });

  return {
    version: versionSugerida,
    tipo,
    algoritmo: comparacion.algoritmo,
    etiqueta_definicion: definicion,
    advertencia,
    registros_entrenamiento: filasEntrenamiento,
    registros_prueba: filasPrueba,
    comparacion,
  };
}

function nivelARiesgo(nivel: string): ClaseRiesgo {
  if (nivel === 'rojo') return 'alto';
  if (nivel === 'amarillo') return 'medio';
  return 'bajo';
}

/** Útil para completar rasgos que falten en orígenes externos. */
export type { ClaveRasgo };
