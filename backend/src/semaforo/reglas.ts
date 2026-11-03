export type NivelAlerta =
  | 'verde'
  | 'amarillo'
  | 'rojo'
  | 'informacion_insuficiente'
  | 'inconsistencia';

export type EstadoDatos = 'clasificado' | 'informacion_insuficiente' | 'inconsistencia';

export type ResultadoAsignatura = 'aprobado' | 'reprobado' | 'sin_registro';

export type AsignaturaHecho = {
  clave: string;
  calificacion: number | null;
  resultado: ResultadoAsignatura;
};

export type ParcialHecho = {
  clave: string;
  numero: number;
  calificacion: number | null;
  exigible: boolean;
  acreditada: boolean | null;
};

export type CursoEspecialHecho = {
  clave: string;
  registrado: boolean;
};

export type HechosSemaforo = {
  periodo: string;
  periodoReferencia: string | null;
  asignaturasReferencia: AsignaturaHecho[];
  asignaturasActuales: AsignaturaHecho[];
  parcialesActuales: ParcialHecho[];
  cursoEspecial: CursoEspecialHecho[];
  antecedenteReprobacion: boolean;
  asignaturasEsperadasPeriodo: number;
};

export type CondicionRegla =
  | { tipo: 'todas_acreditadas_anterior' }
  | { tipo: 'no_acreditadas_anterior'; exacto?: number; minimo?: number; maximo?: number }
  | { tipo: 'parciales_no_acreditados_misma_asignatura'; minimo: number }
  | { tipo: 'curso_especial_registrado' }
  | { tipo: 'antecedente_reprobacion_desempeno_actual_acreditado' }
  | { tipo: 'datos_faltantes' }
  | { tipo: 'inconsistencia' };

export type ReglaSemaforo = {
  codigo: string;
  version: string;
  prioridad: number;
  nivel: NivelAlerta;
  titulo: string;
  descripcion: string;
  condicion: CondicionRegla;
  accion: string;
  activa: boolean;
};

export type ReglaActivada = {
  codigo: string;
  titulo: string;
  nivel: NivelAlerta;
  prioridad: number;
  accion: string;
  detalle: string;
};

export type CoberturaDatos = {
  porcentaje: number;
  faltantes: string[];
  inconsistencias: string[];
  asignaturas_referencia: number;
  asignaturas_esperadas: number;
};

export type ResultadoEvaluacion = {
  version: string;
  estado_datos: EstadoDatos;
  nivel: NivelAlerta;
  puntos: number;
  reglas_activadas: ReglaActivada[];
  cobertura: CoberturaDatos;
  senales: string[];
  accion_sugerida: string;
};

const MENSAJE_INCONSISTENCIA =
  'Los datos del corte se contradicen entre sí; se bloquea la clasificación hasta validarlos.';
const MENSAJE_INSUFICIENTE =
  'Falta información indispensable del corte; no se presume acreditación ni reprobación.';

/**
 * Evalúa el catálogo de reglas versionadas contra los hechos del estudiante.
 * Función pura: no consulta la base, para poder probarla y auditar cada decisión.
 */
export function evaluarReglas(
  hechos: HechosSemaforo,
  reglas: ReglaSemaforo[],
  version: string,
): ResultadoEvaluacion {
  const cobertura = calcularCobertura(hechos);
  const activadas: ReglaActivada[] = [];

  const estadoSistema = clasificarEstadoSistema(hechos, cobertura);
  if (estadoSistema) {
    const codigo = estadoSistema === 'inconsistencia' ? 'SIS-INC' : 'RA-07';
    const reglaSistema = reglas.find((regla) => regla.codigo === codigo);
    activadas.push({
      codigo,
      titulo:
        estadoSistema === 'inconsistencia'
          ? 'Datos contradictorios en el corte'
          : reglaSistema?.titulo ?? 'Faltan datos indispensables para el corte evaluado',
      nivel: estadoSistema,
      prioridad: 100,
      accion:
        estadoSistema === 'inconsistencia'
          ? 'Validar el origen del dato con Servicios Escolares antes de clasificar.'
          : reglaSistema?.accion ?? 'Verificar la captura de datos antes de clasificar.',
      detalle:
        estadoSistema === 'inconsistencia'
          ? cobertura.inconsistencias.join('; ')
          : cobertura.faltantes.join('; '),
    });
    return {
      version,
      estado_datos: estadoSistema,
      nivel: estadoSistema,
      puntos: 100,
      reglas_activadas: activadas,
      cobertura,
      senales:
        estadoSistema === 'inconsistencia'
          ? [MENSAJE_INCONSISTENCIA, ...cobertura.inconsistencias]
          : [MENSAJE_INSUFICIENTE, ...cobertura.faltantes],
      accion_sugerida: activadas[0].accion,
    };
  }

  for (const regla of reglas) {
    if (!regla.activa) continue;
    const coincide = evaluarCondicion(regla.condicion, hechos, cobertura);
    if (!coincide) continue;
    activadas.push({
      codigo: regla.codigo,
      titulo: regla.titulo,
      nivel: regla.nivel,
      prioridad: regla.prioridad,
      accion: regla.accion,
      detalle: detalleRegla(regla, hechos, cobertura),
    });
  }

  activadas.sort((a, b) => b.prioridad - a.prioridad);
  const nivel = activadas[0]?.nivel ?? 'verde';
  const puntos = Math.min(
    999,
    activadas.reduce((suma, regla) => suma + regla.prioridad, 0),
  );

  return {
    version,
    estado_datos: 'clasificado',
    nivel,
    puntos,
    reglas_activadas: activadas,
    cobertura,
    senales: activadas.map((regla) => `${regla.codigo}: ${regla.titulo}`),
    accion_sugerida: activadas[0]?.accion ?? 'Mantener el seguimiento ordinario del periodo.',
  };
}

export function calcularCobertura(hechos: HechosSemaforo): CoberturaDatos {
  const faltantes: string[] = [];
  const inconsistencias: string[] = [];

  if (!hechos.periodoReferencia) {
    faltantes.push('No existe un periodo de referencia anterior para este corte.');
  } else {
    if (hechos.asignaturasReferencia.length === 0) {
      faltantes.push('No hay resultados del periodo de referencia.');
    }
    const esperadas = Math.max(hechos.asignaturasEsperadasPeriodo, hechos.asignaturasReferencia.length);
    if (hechos.asignaturasReferencia.length < esperadas) {
      faltantes.push(
        `Sólo ${hechos.asignaturasReferencia.length} de ${esperadas} asignaturas del periodo de referencia están registradas.`,
      );
    }
    for (const asignatura of hechos.asignaturasReferencia) {
      if (asignatura.resultado === 'sin_registro') {
        faltantes.push(`Sin registro del resultado de ${asignatura.clave} en el periodo de referencia.`);
      }
    }
  }

  const claves = new Set<string>();
  for (const asignatura of hechos.asignaturasActuales) {
    if (asignatura.resultado === 'sin_registro') {
      faltantes.push(`Sin registro del resultado actual de ${asignatura.clave}.`);
    }
  }
  for (const asignatura of hechos.asignaturasReferencia) {
    if (claves.has(asignatura.clave)) {
      inconsistencias.push(`La asignatura ${asignatura.clave} está duplicada en el periodo de referencia.`);
    }
    claves.add(asignatura.clave);
    if (asignatura.resultado === 'aprobado' && asignatura.calificacion !== null && asignatura.calificacion < 70) {
      inconsistencias.push(
        `${asignatura.clave} figura aprobada con calificación ${asignatura.calificacion}.`,
      );
    }
    if (asignatura.resultado === 'reprobado' && asignatura.calificacion !== null && asignatura.calificacion >= 70) {
      inconsistencias.push(
        `${asignatura.clave} figura reprobada con calificación ${asignatura.calificacion}.`,
      );
    }
  }

  for (const parcial of hechos.parcialesActuales) {
    if (parcial.exigible && parcial.calificacion === null) {
      faltantes.push(
        `Falta la calificación del parcial ${parcial.numero} de ${parcial.clave}, que ya es exigible.`,
      );
    }
    if (parcial.acreditada === true && parcial.calificacion !== null && parcial.calificacion < 70) {
      inconsistencias.push(
        `El parcial ${parcial.numero} de ${parcial.clave} figura acreditado con calificación ${parcial.calificacion}.`,
      );
    }
  }

  const esperadas = Math.max(hechos.asignaturasEsperadasPeriodo, 1);
  const validas = hechos.asignaturasReferencia.filter(
    (asignatura) => asignatura.resultado === 'aprobado' || asignatura.resultado === 'reprobado',
  ).length;
  const porcentaje = Math.max(0, Math.min(100, Math.round((validas / esperadas) * 100)));

  return {
    porcentaje,
    faltantes: [...new Set(faltantes)],
    inconsistencias: [...new Set(inconsistencias)],
    asignaturas_referencia: hechos.asignaturasReferencia.length,
    asignaturas_esperadas: esperadas,
  };
}

function clasificarEstadoSistema(
  hechos: HechosSemaforo,
  cobertura: CoberturaDatos,
): 'informacion_insuficiente' | 'inconsistencia' | null {
  if (cobertura.inconsistencias.length > 0) return 'inconsistencia';
  if (cobertura.faltantes.length > 0) return 'informacion_insuficiente';
  if (!hechos.periodoReferencia) return 'informacion_insuficiente';
  return null;
}

function evaluarCondicion(
  condicion: CondicionRegla,
  hechos: HechosSemaforo,
  cobertura: CoberturaDatos,
): boolean {
  switch (condicion.tipo) {
    case 'todas_acreditadas_anterior': {
      return (
        hechos.asignaturasReferencia.length > 0 &&
        hechos.asignaturasReferencia.every((asignatura) => asignatura.resultado === 'aprobado')
      );
    }
    case 'no_acreditadas_anterior': {
      const noAcreditadas = contarNoAcreditadas(hechos.asignaturasReferencia);
      if (condicion.exacto !== undefined) return noAcreditadas === condicion.exacto;
      if (condicion.minimo !== undefined && noAcreditadas < condicion.minimo) return false;
      if (condicion.maximo !== undefined && noAcreditadas > condicion.maximo) return false;
      return true;
    }
    case 'parciales_no_acreditados_misma_asignatura': {
      const porAsignatura = new Map<string, number>();
      for (const parcial of hechos.parcialesActuales) {
        if (!parcial.exigible) continue;
        const noAcreditado =
          parcial.acreditada === false ||
          (parcial.calificacion !== null && parcial.calificacion < 70);
        if (!noAcreditado) continue;
        porAsignatura.set(parcial.clave, (porAsignatura.get(parcial.clave) ?? 0) + 1);
      }
      return [...porAsignatura.values()].some((total) => total >= condicion.minimo);
    }
    case 'curso_especial_registrado':
      return hechos.cursoEspecial.some((curso) => curso.registrado);
    case 'antecedente_reprobacion_desempeno_actual_acreditado': {
      if (!hechos.antecedenteReprobacion) return false;
      const referenciaAcreditada = hechos.asignaturasReferencia.every(
        (asignatura) => asignatura.resultado === 'aprobado',
      );
      const parcialesAcreditados = hechos.parcialesActuales
        .filter((parcial) => parcial.exigible)
        .every(
          (parcial) =>
            parcial.acreditada === true ||
            (parcial.calificacion !== null && parcial.calificacion >= 70),
        );
      return referenciaAcreditada && parcialesAcreditados;
    }
    case 'datos_faltantes':
      return cobertura.faltantes.length > 0;
    case 'inconsistencia':
      return cobertura.inconsistencias.length > 0;
    default:
      return false;
  }
}

function contarNoAcreditadas(asignaturas: AsignaturaHecho[]): number {
  return asignaturas.filter((asignatura) => asignatura.resultado === 'reprobado').length;
}

function detalleRegla(
  regla: ReglaSemaforo,
  hechos: HechosSemaforo,
  cobertura: CoberturaDatos,
): string {
  const condicion = regla.condicion;
  if (condicion.tipo === 'no_acreditadas_anterior') {
    const noAcreditadas = contarNoAcreditadas(hechos.asignaturasReferencia);
    return `${noAcreditadas} asignatura(s) no acreditada(s) en ${hechos.periodoReferencia}.`;
  }
  if (condicion.tipo === 'parciales_no_acreditados_misma_asignatura') {
    return 'Se detectaron parciales exigibles no acreditados en la misma asignatura.';
  }
  if (condicion.tipo === 'todas_acreditadas_anterior') {
    return `El periodo ${hechos.periodoReferencia} está completamente acreditado.`;
  }
  if (condicion.tipo === 'curso_especial_registrado') {
    return 'Hay un curso especial registrado; el nivel es provisional hasta validarlo.';
  }
  if (condicion.tipo === 'antecedente_reprobacion_desempeno_actual_acreditado') {
    return 'Hay antecedentes de reprobación, pero el corte de referencia está acreditado.';
  }
  if (condicion.tipo === 'datos_faltantes') {
    return cobertura.faltantes.join('; ');
  }
  if (condicion.tipo === 'inconsistencia') {
    return cobertura.inconsistencias.join('; ');
  }
  return '';
}
