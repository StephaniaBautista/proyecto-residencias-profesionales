import type { ClaseRiesgo } from './etiqueta';
import { CLASES, calcularMetricas, type MetricasClasificacion } from './metricas';

export const RASGOS = [
  { clave: 'porcentaje_asistencia', etiqueta: 'Asistencia' },
  { clave: 'promedio_periodo', etiqueta: 'Promedio' },
  { clave: 'materias_reprobadas', etiqueta: 'Materias reprobadas' },
  { clave: 'creditos_aprobados', etiqueta: 'Créditos aprobados' },
  { clave: 'avance_curricular', etiqueta: 'Avance curricular' },
  { clave: 'acuerdos_vencidos', etiqueta: 'Acuerdos vencidos' },
  { clave: 'semestre', etiqueta: 'Semestre' },
] as const;

export type ClaveRasgo = (typeof RASGOS)[number]['clave'];

export type FilaModelo = Record<ClaveRasgo, number> & {
  riesgo_objetivo: ClaseRiesgo;
};

type NodoHoja = {
  tipo: 'hoja';
  clase: ClaseRiesgo;
  probabilidades: Record<ClaseRiesgo, number>;
  n: number;
};

type NodoRama = {
  tipo: 'rama';
  rasgo: number;
  umbral: number;
  izquierda: Nodo;
  derecha: Nodo;
};

export type Nodo = NodoHoja | NodoRama;

export type ModeloArbol = {
  tipo: 'arbol';
  rasgos: ClaveRasgo[];
  raiz: Nodo;
};

export type ComparacionModelos = {
  algoritmo: 'arbol';
  motivo: string;
  modelo: ModeloArbol;
  metricas: {
    regresion_logistica: MetricasClasificacion;
    arbol: MetricasClasificacion;
    bosque: MetricasClasificacion;
  };
};

type Rng = () => number;

export function entrenarComparacion(filas: FilaModelo[], semilla = 42): ComparacionModelos {
  if (filas.length < 30) {
    throw new Error('Se necesitan al menos 30 registros sintéticos para entrenar.');
  }
  for (const clase of CLASES) {
    if (filas.filter((fila) => fila.riesgo_objetivo === clase).length < 3) {
      throw new Error(`Faltan ejemplos de la clase ${clase}.`);
    }
  }

  const { entrenamiento, prueba } = dividir(filas, semilla);
  const logistica = entrenarLogistica(entrenamiento, semilla);
  const arbol = entrenarArbol(entrenamiento, 4, 6, 0);
  const bosque = entrenarBosque(entrenamiento, semilla);

  const metricas = {
    regresion_logistica: calcularMetricas(
      prueba.map((fila) => fila.riesgo_objetivo),
      prueba.map((fila) => predecirLogistica(logistica, fila).clase),
    ),
    arbol: calcularMetricas(
      prueba.map((fila) => fila.riesgo_objetivo),
      prueba.map((fila) => predecirArbol(arbol, fila).clase),
    ),
    bosque: calcularMetricas(
      prueba.map((fila) => fila.riesgo_objetivo),
      prueba.map((fila) => predecirBosque(bosque, fila).clase),
    ),
  };

  return {
    algoritmo: 'arbol',
    motivo:
      'Se guarda el árbol de decisión porque cada predicción se lee como una secuencia de umbrales. El bosque y la regresión quedan solo como comparación.',
    modelo: arbol,
    metricas,
  };
}

export function predecirArbol(modelo: ModeloArbol, fila: Record<ClaveRasgo, number>): {
  clase: ClaseRiesgo;
  probabilidad: number;
  reglas: string[];
} {
  const reglas: string[] = [];
  let nodo = modelo.raiz;
  while (nodo.tipo === 'rama') {
    const valor = Number(fila[modelo.rasgos[nodo.rasgo]]);
    const etiqueta = RASGOS[nodo.rasgo]?.etiqueta ?? `Rasgo ${nodo.rasgo}`;
    const umbral = formatearUmbral(nodo.umbral);
    if (valor <= nodo.umbral) {
      reglas.push(`${etiqueta} menor o igual a ${umbral}`);
      nodo = nodo.izquierda;
    } else {
      reglas.push(`${etiqueta} mayor a ${umbral}`);
      nodo = nodo.derecha;
    }
  }
  return {
    clase: nodo.clase,
    probabilidad: redondear(nodo.probabilidades[nodo.clase] ?? 0),
    reglas,
  };
}

export function esModeloArbol(valor: unknown): valor is ModeloArbol {
  if (!valor || typeof valor !== 'object') return false;
  const modelo = valor as ModeloArbol;
  return modelo.tipo === 'arbol' && Array.isArray(modelo.rasgos) && esNodo(modelo.raiz);
}

function esNodo(valor: unknown): valor is Nodo {
  if (!valor || typeof valor !== 'object') return false;
  const nodo = valor as Nodo;
  if (nodo.tipo === 'hoja') return typeof nodo.clase === 'string' && typeof nodo.n === 'number';
  if (nodo.tipo === 'rama') {
    return typeof nodo.rasgo === 'number' && typeof nodo.umbral === 'number' && esNodo(nodo.izquierda) && esNodo(nodo.derecha);
  }
  return false;
}

function vector(fila: FilaModelo | Record<ClaveRasgo, number>): number[] {
  return RASGOS.map((rasgo) => Number(fila[rasgo.clave]));
}

function dividir(filas: FilaModelo[], semilla: number): { entrenamiento: FilaModelo[]; prueba: FilaModelo[] } {
  const rng = mulberry32(semilla);
  const entrenamiento: FilaModelo[] = [];
  const prueba: FilaModelo[] = [];
  for (const clase of CLASES) {
    const grupo = barajar(filas.filter((fila) => fila.riesgo_objetivo === clase), rng);
    const nPrueba = Math.max(1, Math.round(grupo.length * 0.3));
    prueba.push(...grupo.slice(0, nPrueba));
    entrenamiento.push(...grupo.slice(nPrueba));
  }
  return { entrenamiento, prueba };
}

function entrenarArbol(filas: FilaModelo[], profundidadMaxima: number, minimo: number, profundidad: number): ModeloArbol {
  return {
    tipo: 'arbol',
    rasgos: RASGOS.map((rasgo) => rasgo.clave),
    raiz: partir(filas, profundidadMaxima, minimo, profundidad),
  };
}

function partir(filas: FilaModelo[], profundidadMaxima: number, minimo: number, profundidad: number): Nodo {
  const hoja = crearHoja(filas);
  if (filas.length < minimo || profundidad >= profundidadMaxima || hoja.probabilidades[hoja.clase] === 1) {
    return hoja;
  }

  let mejor: { rasgo: number; umbral: number; ganancia: number; izquierda: FilaModelo[]; derecha: FilaModelo[] } | null = null;
  const impureza = gini(filas);
  for (let rasgo = 0; rasgo < RASGOS.length; rasgo += 1) {
    const valores = [...new Set(filas.map((fila) => vector(fila)[rasgo]))].sort((a, b) => a - b);
    const candidatos = umbrales(valores);
    for (const umbral of candidatos) {
      const izquierda = filas.filter((fila) => vector(fila)[rasgo] <= umbral);
      const derecha = filas.filter((fila) => vector(fila)[rasgo] > umbral);
      if (izquierda.length < 2 || derecha.length < 2) continue;
      const ganancia = impureza - (izquierda.length / filas.length) * gini(izquierda) - (derecha.length / filas.length) * gini(derecha);
      if (!mejor || ganancia > mejor.ganancia) {
        mejor = { rasgo, umbral, ganancia, izquierda, derecha };
      }
    }
  }

  if (!mejor || mejor.ganancia < 1e-6) return hoja;
  return {
    tipo: 'rama',
    rasgo: mejor.rasgo,
    umbral: mejor.umbral,
    izquierda: partir(mejor.izquierda, profundidadMaxima, minimo, profundidad + 1),
    derecha: partir(mejor.derecha, profundidadMaxima, minimo, profundidad + 1),
  };
}

function umbrales(valores: number[]): number[] {
  if (valores.length < 2) return [];
  const limites = valores.length > 16 ? cuantiles(valores, 12) : valores;
  const cortes: number[] = [];
  for (let i = 0; i < limites.length - 1; i += 1) {
    if (limites[i] !== limites[i + 1]) cortes.push((limites[i] + limites[i + 1]) / 2);
  }
  return cortes;
}

function cuantiles(valores: number[], n: number): number[] {
  const salida: number[] = [];
  for (let i = 0; i <= n; i += 1) {
    const indice = Math.min(valores.length - 1, Math.round((i / n) * (valores.length - 1)));
    salida.push(valores[indice]);
  }
  return [...new Set(salida)];
}

function crearHoja(filas: FilaModelo[]): NodoHoja {
  const conteo = Object.fromEntries(CLASES.map((clase) => [clase, 0])) as Record<ClaseRiesgo, number>;
  for (const fila of filas) conteo[fila.riesgo_objetivo] += 1;
  const total = Math.max(filas.length, 1);
  const probabilidades = Object.fromEntries(
    CLASES.map((clase) => [clase, conteo[clase] / total]),
  ) as Record<ClaseRiesgo, number>;
  const clase = [...CLASES].sort((a, b) => conteo[b] - conteo[a] || CLASES.indexOf(a) - CLASES.indexOf(b))[0];
  return { tipo: 'hoja', clase, probabilidades, n: filas.length };
}

function gini(filas: FilaModelo[]): number {
  if (filas.length === 0) return 0;
  let suma = 0;
  for (const clase of CLASES) {
    const p = filas.filter((fila) => fila.riesgo_objetivo === clase).length / filas.length;
    suma += p * p;
  }
  return 1 - suma;
}

type ModeloLogistica = { pesos: number[][]; medias: number[]; desvios: number[] };

function entrenarLogistica(filas: FilaModelo[], semilla: number): ModeloLogistica {
  const rng = mulberry32(semilla);
  const crudos = filas.map(vector);
  const medias = RASGOS.map((_, indice) => promedio(crudos.map((fila) => fila[indice])));
  const desvios = RASGOS.map((_, indice) => {
    const varianza = promedio(crudos.map((fila) => (fila[indice] - medias[indice]) ** 2));
    return Math.sqrt(varianza) || 1;
  });
  const datos = crudos.map((fila) => fila.map((valor, indice) => (valor - medias[indice]) / desvios[indice]));
  const pesos = CLASES.map(() => Array.from({ length: RASGOS.length + 1 }, () => (rng() - 0.5) * 0.1));
  const lr = 0.15;

  for (let epoca = 0; epoca < 350; epoca += 1) {
    const gradientes = pesos.map((fila) => fila.map(() => 0));
    for (let i = 0; i < datos.length; i += 1) {
      const entrada = [1, ...datos[i]];
      const logits = pesos.map((fila) => producto(fila, entrada));
      const probs = softmax(logits);
      const real = CLASES.indexOf(filas[i].riesgo_objetivo);
      for (let clase = 0; clase < CLASES.length; clase += 1) {
        const error = probs[clase] - (clase === real ? 1 : 0);
        for (let j = 0; j < entrada.length; j += 1) gradientes[clase][j] += error * entrada[j];
      }
    }
    for (let clase = 0; clase < CLASES.length; clase += 1) {
      for (let j = 0; j < pesos[clase].length; j += 1) {
        pesos[clase][j] -= (lr * gradientes[clase][j]) / datos.length;
      }
    }
  }
  return { pesos, medias, desvios };
}

function predecirLogistica(modelo: ModeloLogistica, fila: Record<ClaveRasgo, number>): { clase: ClaseRiesgo } {
  const entrada = [1, ...vector(fila).map((valor, indice) => (valor - modelo.medias[indice]) / modelo.desvios[indice])];
  const probs = softmax(modelo.pesos.map((filaPesos) => producto(filaPesos, entrada)));
  let mejor = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[mejor]) mejor = i;
  return { clase: CLASES[mejor] };
}

type Bosque = ModeloArbol[];

function entrenarBosque(filas: FilaModelo[], semilla: number): Bosque {
  const rng = mulberry32(semilla + 99);
  const arboles: Bosque = [];
  for (let i = 0; i < 21; i += 1) {
    const muestra: FilaModelo[] = [];
    for (let n = 0; n < filas.length; n += 1) muestra.push(filas[Math.floor(rng() * filas.length)]);
    arboles.push(entrenarArbol(muestra, 5, 4, 0));
  }
  return arboles;
}

function predecirBosque(bosque: Bosque, fila: Record<ClaveRasgo, number>): { clase: ClaseRiesgo } {
  const votos = Object.fromEntries(CLASES.map((clase) => [clase, 0])) as Record<ClaseRiesgo, number>;
  for (const arbol of bosque) votos[predecirArbol(arbol, fila).clase] += 1;
  const clase = [...CLASES].sort((a, b) => votos[b] - votos[a])[0];
  return { clase };
}

function softmax(logits: number[]): number[] {
  const maximo = Math.max(...logits);
  const exps = logits.map((valor) => Math.exp(valor - maximo));
  const suma = exps.reduce((total, valor) => total + valor, 0);
  return exps.map((valor) => valor / suma);
}

function producto(pesos: number[], entrada: number[]): number {
  return pesos.reduce((total, peso, indice) => total + peso * entrada[indice], 0);
}

function promedio(valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0) / valores.length;
}

function barajar<T>(entrada: T[], rng: Rng): T[] {
  const copia = [...entrada];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function mulberry32(semilla: number): Rng {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatearUmbral(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
