import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluarReglas,
  type HechosSemaforo,
  type ReglaSemaforo,
} from './reglas';

const reglas: ReglaSemaforo[] = [
  regla('RA-01', 10, 'verde', { tipo: 'todas_acreditadas_anterior' }),
  regla('RA-02', 40, 'amarillo', { tipo: 'no_acreditadas_anterior', exacto: 1 }),
  regla('RA-03', 50, 'amarillo', { tipo: 'no_acreditadas_anterior', exacto: 2 }),
  regla('RA-04', 80, 'rojo', { tipo: 'no_acreditadas_anterior', minimo: 3 }),
  regla('RA-05', 60, 'amarillo', { tipo: 'parciales_no_acreditados_misma_asignatura', minimo: 2 }),
  regla('RA-06', 90, 'rojo', { tipo: 'curso_especial_registrado' }),
  regla('RA-07', 100, 'informacion_insuficiente', { tipo: 'datos_faltantes' }),
  regla('RA-08', 20, 'verde', { tipo: 'antecedente_reprobacion_desempeno_actual_acreditado' }),
];

describe('motor de reglas RA-01 a RA-08', () => {
  it('RA-01: verde cuando el corte de referencia está completamente acreditado', () => {
    const resultado = evaluarReglas(hechos({ aprobadas: 6 }), reglas, 'v1');
    assert.equal(resultado.estado_datos, 'clasificado');
    assert.equal(resultado.nivel, 'verde');
    assert.deepEqual(resultado.reglas_activadas.map((fila) => fila.codigo), ['RA-01']);
  });

  it('RA-02: amarillo con una asignatura no acreditada', () => {
    const resultado = evaluarReglas(hechos({ aprobadas: 5 }), reglas, 'v1');
    assert.equal(resultado.nivel, 'amarillo');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-02'));
  });

  it('RA-03: amarillo con dos asignaturas no acreditadas', () => {
    const resultado = evaluarReglas(hechos({ aprobadas: 4 }), reglas, 'v1');
    assert.equal(resultado.nivel, 'amarillo');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-03'));
  });

  it('RA-04: rojo con tres asignaturas no acreditadas', () => {
    const resultado = evaluarReglas(hechos({ aprobadas: 3 }), reglas, 'v1');
    assert.equal(resultado.nivel, 'rojo');
    assert.equal(resultado.reglas_activadas[0]?.codigo, 'RA-04');
  });

  it('RA-05: amarillo por dos parciales no acreditados en la misma asignatura', () => {
    const resultado = evaluarReglas(
      hechos({
        aprobadas: 6,
        parciales: [
          { clave: 'ASG-01', numero: 1, calificacion: 60, exigible: true, acreditada: false },
          { clave: 'ASG-01', numero: 2, calificacion: 65, exigible: true, acreditada: false },
        ],
      }),
      reglas,
      'v1',
    );
    assert.equal(resultado.nivel, 'amarillo');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-05'));
  });

  it('RA-06: rojo provisional por curso especial registrado', () => {
    const resultado = evaluarReglas(
      hechos({ aprobadas: 6, cursos: [{ clave: 'ASG-03', registrado: true }] }),
      reglas,
      'v1',
    );
    assert.equal(resultado.nivel, 'rojo');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-06'));
  });

  it('RA-07: información insuficiente cuando no existe periodo de referencia', () => {
    const resultado = evaluarReglas(
      hechos({ aprobadas: 6, referencia: null, asignaturasReferencia: [] }),
      reglas,
      'v1',
    );
    assert.equal(resultado.estado_datos, 'informacion_insuficiente');
    assert.equal(resultado.nivel, 'informacion_insuficiente');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-07'));
  });

  it('bloquea por inconsistencia cuando una calificación contradice el resultado', () => {
    const resultado = evaluarReglas(
      hechos({ aprobadas: 5, contradiccion: true }),
      reglas,
      'v1',
    );
    assert.equal(resultado.estado_datos, 'inconsistencia');
    assert.equal(resultado.nivel, 'inconsistencia');
    assert.ok(resultado.cobertura.inconsistencias.length > 0);
  });

  it('RA-07: marca faltante una calificación parcial exigible sin registrar', () => {
    const resultado = evaluarReglas(
      hechos({
        aprobadas: 6,
        parciales: [
          { clave: 'ASG-02', numero: 1, calificacion: null, exigible: true, acreditada: null },
        ],
      }),
      reglas,
      'v1',
    );
    assert.equal(resultado.estado_datos, 'informacion_insuficiente');
  });

  it('RA-08: antecedentes con desempeño actual acreditado se quedan en verde', () => {
    const resultado = evaluarReglas(
      hechos({ aprobadas: 6, antecedente: true }),
      reglas,
      'v1',
    );
    assert.equal(resultado.nivel, 'verde');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-08'));
  });

  it('aplica precedencia de severidad y conserva todas las reglas activadas', () => {
    const resultado = evaluarReglas(
      hechos({
        aprobadas: 5,
        cursos: [{ clave: 'ASG-03', registrado: true }],
      }),
      reglas,
      'v1',
    );
    assert.equal(resultado.nivel, 'rojo');
    assert.equal(resultado.reglas_activadas[0]?.codigo, 'RA-06');
    assert.ok(resultado.reglas_activadas.some((fila) => fila.codigo === 'RA-02'));
  });
});

function regla(
  codigo: string,
  prioridad: number,
  nivel: ReglaSemaforo['nivel'],
  condicion: ReglaSemaforo['condicion'],
): ReglaSemaforo {
  return {
    codigo,
    version: 'v1',
    prioridad,
    nivel,
    titulo: codigo,
    descripcion: '',
    condicion,
    accion: `Acción ${codigo}`,
    activa: true,
  };
}

function hechos(opciones: {
  aprobadas: number;
  referencia?: string | null;
  asignaturasReferencia?: HechosSemaforo['asignaturasReferencia'];
  parciales?: HechosSemaforo['parcialesActuales'];
  cursos?: HechosSemaforo['cursoEspecial'];
  antecedente?: boolean;
  contradiccion?: boolean;
}): HechosSemaforo {
  const total = 6;
  const referencia = opciones.referencia === undefined ? '2026-1' : opciones.referencia;
  const asignaturas =
    opciones.asignaturasReferencia ??
    Array.from({ length: total }, (_, indice) => ({
      clave: `ASG-0${indice + 1}`,
      calificacion: indice < opciones.aprobadas ? 85 : 55,
      resultado: (indice < opciones.aprobadas ? 'aprobado' : 'reprobado') as
        | 'aprobado'
        | 'reprobado',
    }));
  if (opciones.contradiccion) {
    asignaturas[0] = { clave: 'ASG-01', calificacion: 85, resultado: 'reprobado' };
  }
  return {
    periodo: '2026-2',
    periodoReferencia: referencia,
    asignaturasReferencia: referencia ? asignaturas : [],
    asignaturasActuales: [],
    parcialesActuales: opciones.parciales ?? [],
    cursoEspecial: opciones.cursos ?? [],
    antecedenteReprobacion: opciones.antecedente ?? false,
    asignaturasEsperadasPeriodo: total,
  };
}
