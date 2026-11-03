export type ClaseRiesgo = 'bajo' | 'medio' | 'alto';

/**
 * Etiqueta observada para entrenar el modelo: no se calcula con las mismas
 * reglas del semáforo, sino con el desempeño real del periodo siguiente.
 * Es la variable que el modelo intenta anticipar.
 */
export function etiquetaObservada(siguiente: {
  materias_reprobadas: number;
  promedio_periodo: number;
}): ClaseRiesgo {
  if (siguiente.materias_reprobadas >= 3 || siguiente.promedio_periodo < 70) return 'alto';
  if (siguiente.materias_reprobadas >= 1 || siguiente.promedio_periodo < 78) return 'medio';
  return 'bajo';
}

export const DEFINICION_ETIQUETA =
  'Riesgo observado en el periodo siguiente: alto si reprueba 3+ asignaturas o su promedio baja de 70; ' +
  'medio si reprueba al menos una o su promedio baja de 78; bajo en el resto de los casos.';
