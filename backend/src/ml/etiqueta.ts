export type ClaseRiesgo = 'bajo' | 'medio' | 'alto';

export function etiquetaRiesgo(entrada: {
  porcentaje_asistencia: number;
  promedio_periodo: number;
  materias_reprobadas: number;
}): ClaseRiesgo {
  if (
    entrada.porcentaje_asistencia < 70 ||
    entrada.promedio_periodo < 70 ||
    entrada.materias_reprobadas >= 3
  ) {
    return 'alto';
  }
  if (
    entrada.porcentaje_asistencia < 85 ||
    entrada.promedio_periodo < 78 ||
    entrada.materias_reprobadas >= 1
  ) {
    return 'medio';
  }
  return 'bajo';
}
