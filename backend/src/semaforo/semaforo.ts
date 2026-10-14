export type NivelAlerta = 'verde' | 'amarillo' | 'rojo';

export type EntradaSemaforo = {
  promedio_periodo: number;
  porcentaje_asistencia: number;
  materias_reprobadas: number;
  avance_curricular: number;
  acuerdos_vencidos: number;
};

export type ResultadoSemaforo = {
  puntos: number;
  nivel: NivelAlerta;
  senales: string[];
  accion_sugerida: string;
};

export function evaluarSemaforo(entrada: EntradaSemaforo): ResultadoSemaforo {
  const senales: string[] = [];
  let puntos = 0;

  if (entrada.promedio_periodo < 70) {
    puntos += 2;
    senales.push('Promedio menor a 70');
  }
  if (entrada.porcentaje_asistencia < 80) {
    puntos += 2;
    senales.push('Asistencia menor a 80%');
  }
  if (entrada.materias_reprobadas >= 3) {
    puntos += 2;
    senales.push('Tres o más materias reprobadas');
  }
  if (entrada.avance_curricular < 50) {
    puntos += 1;
    senales.push('Avance curricular menor a 50%');
  }
  if (entrada.acuerdos_vencidos >= 2) {
    puntos += 1;
    senales.push('Dos o más acuerdos vencidos');
  }

  const nivel: NivelAlerta = puntos >= 5 ? 'rojo' : puntos >= 2 ? 'amarillo' : 'verde';
  return { puntos, nivel, senales, accion_sugerida: accionSugerida(nivel) };
}

export function accionSugerida(nivel: NivelAlerta): string {
  if (nivel === 'rojo') {
    return 'Entrevista tutorial prioritaria, asesoría en materias críticas y seguimiento semanal.';
  }
  if (nivel === 'amarillo') {
    return 'Seguimiento preventivo: revisar el indicador activo y registrar un acuerdo.';
  }
  return 'Mantener el seguimiento ordinario del periodo.';
}

export function etiquetaNivel(nivel: NivelAlerta): string {
  if (nivel === 'verde') return 'Verde';
  if (nivel === 'amarillo') return 'Amarillo';
  return 'Rojo';
}
