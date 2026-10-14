import type { ClaseRiesgo } from './etiqueta';

export const CLASES: ClaseRiesgo[] = ['bajo', 'medio', 'alto'];

export type MetricasClasificacion = {
  exactitud: number;
  precision_macro: number;
  recall_macro: number;
  matriz: number[][];
  clases: ClaseRiesgo[];
  soporte: number;
};

export function calcularMetricas(reales: ClaseRiesgo[], predichas: ClaseRiesgo[]): MetricasClasificacion {
  if (reales.length !== predichas.length || reales.length === 0) {
    throw new Error('No hay pares real/predicho para evaluar.');
  }
  const matriz = CLASES.map(() => CLASES.map(() => 0));
  let aciertos = 0;
  for (let i = 0; i < reales.length; i += 1) {
    const fila = CLASES.indexOf(reales[i]);
    const columna = CLASES.indexOf(predichas[i]);
    matriz[fila][columna] += 1;
    if (fila === columna) aciertos += 1;
  }

  let precisionSuma = 0;
  let recallSuma = 0;
  for (let clase = 0; clase < CLASES.length; clase += 1) {
    const verdaderos = matriz[clase][clase];
    const predichos = matriz.reduce((suma, fila) => suma + fila[clase], 0);
    const realesClase = matriz[clase].reduce((suma, valor) => suma + valor, 0);
    precisionSuma += predichos === 0 ? 0 : verdaderos / predichos;
    recallSuma += realesClase === 0 ? 0 : verdaderos / realesClase;
  }

  return {
    exactitud: redondear(aciertos / reales.length),
    precision_macro: redondear(precisionSuma / CLASES.length),
    recall_macro: redondear(recallSuma / CLASES.length),
    matriz,
    clases: CLASES,
    soporte: reales.length,
  };
}

function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}
