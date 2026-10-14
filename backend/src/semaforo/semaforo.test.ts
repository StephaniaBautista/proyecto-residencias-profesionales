import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluarSemaforo } from './semaforo';

const sano = {
  promedio_periodo: 88,
  porcentaje_asistencia: 95,
  materias_reprobadas: 0,
  avance_curricular: 70,
  acuerdos_vencidos: 0,
};

describe('evaluarSemaforo', () => {
  it('deja en verde cuando no hay señales', () => {
    const resultado = evaluarSemaforo(sano);
    assert.equal(resultado.puntos, 0);
    assert.equal(resultado.nivel, 'verde');
    assert.deepEqual(resultado.senales, []);
  });

  it('un punto de avance sigue en verde', () => {
    const resultado = evaluarSemaforo({ ...sano, avance_curricular: 40 });
    assert.equal(resultado.puntos, 1);
    assert.equal(resultado.nivel, 'verde');
  });

  it('dos puntos de asistencia pasan a amarillo', () => {
    const resultado = evaluarSemaforo({ ...sano, porcentaje_asistencia: 79 });
    assert.equal(resultado.puntos, 2);
    assert.equal(resultado.nivel, 'amarillo');
    assert.deepEqual(resultado.senales, ['Asistencia menor a 80%']);
  });

  it('cuatro puntos siguen en amarillo', () => {
    const resultado = evaluarSemaforo({
      ...sano,
      promedio_periodo: 69,
      porcentaje_asistencia: 70,
    });
    assert.equal(resultado.puntos, 4);
    assert.equal(resultado.nivel, 'amarillo');
  });

  it('cinco puntos pasan a rojo', () => {
    const resultado = evaluarSemaforo({
      ...sano,
      promedio_periodo: 69,
      porcentaje_asistencia: 70,
      avance_curricular: 46,
    });
    assert.equal(resultado.puntos, 5);
    assert.equal(resultado.nivel, 'rojo');
  });

  it('el caso de rezago acumulado suma ocho puntos y queda en rojo', () => {
    const resultado = evaluarSemaforo({
      promedio_periodo: 65,
      porcentaje_asistencia: 72,
      materias_reprobadas: 4,
      avance_curricular: 46,
      acuerdos_vencidos: 2,
    });
    assert.equal(resultado.puntos, 8);
    assert.equal(resultado.nivel, 'rojo');
    assert.equal(resultado.senales.length, 5);
    assert.match(resultado.accion_sugerida, /Entrevista tutorial prioritaria/);
  });
});
