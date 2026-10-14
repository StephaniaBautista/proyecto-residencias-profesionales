import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { etiquetaRiesgo } from './etiqueta';
import { calcularMetricas } from './metricas';
import { entrenarComparacion, predecirArbol, type FilaModelo } from './modelo';

describe('etiqueta y métricas', () => {
  it('clasifica alto, medio y bajo con las reglas del plan técnico', () => {
    assert.equal(etiquetaRiesgo({ porcentaje_asistencia: 61, promedio_periodo: 64, materias_reprobadas: 3 }), 'alto');
    assert.equal(etiquetaRiesgo({ porcentaje_asistencia: 78, promedio_periodo: 80, materias_reprobadas: 1 }), 'medio');
    assert.equal(etiquetaRiesgo({ porcentaje_asistencia: 95, promedio_periodo: 88, materias_reprobadas: 0 }), 'bajo');
  });

  it('arma la matriz de confusión', () => {
    const metricas = calcularMetricas(['bajo', 'alto'], ['bajo', 'bajo']);
    assert.equal(metricas.exactitud, 0.5);
    assert.equal(metricas.matriz[0][0], 1);
    assert.equal(metricas.matriz[2][0], 1);
  });
});

describe('entrenarComparacion', () => {
  const filas = sintetico();

  it('es reproducible y elige el árbol', () => {
    const primera = entrenarComparacion(filas, 42);
    const segunda = entrenarComparacion(filas, 42);
    assert.equal(primera.algoritmo, 'arbol');
    assert.equal(primera.metricas.arbol.exactitud, segunda.metricas.arbol.exactitud);
    assert.ok(primera.metricas.arbol.exactitud > 0.6);
  });

  it('explica la predicción con umbrales', () => {
    const comparacion = entrenarComparacion(filas, 42);
    const prediccion = predecirArbol(comparacion.modelo, filas[0]);
    assert.ok(prediccion.reglas.length > 0);
    assert.ok(prediccion.probabilidad > 0);
  });
});

function sintetico(): FilaModelo[] {
  const filas: FilaModelo[] = [];
  const perfiles: Array<Pick<FilaModelo, 'porcentaje_asistencia' | 'promedio_periodo' | 'materias_reprobadas' | 'riesgo_objetivo'>> = [
    { porcentaje_asistencia: 96, promedio_periodo: 90, materias_reprobadas: 0, riesgo_objetivo: 'bajo' },
    { porcentaje_asistencia: 78, promedio_periodo: 80, materias_reprobadas: 1, riesgo_objetivo: 'medio' },
    { porcentaje_asistencia: 60, promedio_periodo: 64, materias_reprobadas: 4, riesgo_objetivo: 'alto' },
  ];
  for (let i = 0; i < 36; i += 1) {
    const base = perfiles[i % 3];
    filas.push({
      ...base,
      porcentaje_asistencia: base.porcentaje_asistencia - (i % 4),
      promedio_periodo: base.promedio_periodo - (i % 3),
      creditos_aprobados: 80 + (i % 7) * 15,
      avance_curricular: 40 + (i % 5) * 10,
      acuerdos_vencidos: i % 3,
      semestre: (i % 9) + 1,
    });
  }
  return filas;
}
