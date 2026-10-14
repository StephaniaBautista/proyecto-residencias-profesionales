import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MENSAJE_ABSTENCION,
  decidirRecuperacion,
  interpretarJsonModelo,
  respuestaAbstencion,
  respuestaConEvidencia,
} from './respuesta';

describe('recuperación y abstención', () => {
  it('se abstiene si la mejor similitud no llega al umbral', () => {
    const decision = decidirRecuperacion([0.11, 0.2], 0.32);
    assert.equal(decision.suficiente, false);
    const respuesta = respuestaAbstencion('EST_010');
    assert.equal(respuesta.abstencion, true);
    assert.equal(respuesta.explicacion, MENSAJE_ABSTENCION);
    assert.equal(respuesta.validacion_humana_requerida, true);
    assert.deepEqual(respuesta.fuentes_rag, []);
  });

  it('se abstiene cuando no hay fragmentos', () => {
    assert.equal(decidirRecuperacion([], 0.32).suficiente, false);
  });

  it('arma la respuesta con las fuentes recuperadas, no con las que invente el modelo', () => {
    const respuesta = respuestaConEvidencia({
      idEstudiante: 'EST_024',
      nivel: 'rojo',
      indicadores: ['Asistencia menor a 80%'],
      fragmentos: [
        {
          documento: 'Programa de Tutorías del TecNM',
          numero: 3,
          pagina: 12,
          texto: 'El tutor da seguimiento a los acuerdos.',
          similitud: 0.72,
        },
      ],
      textoModelo: {
        evidencia: 'El fragmento habla de seguimiento.',
        explicacion: 'Conviene revisar los acuerdos.',
        accion_sugerida: 'Registrar una entrevista, sujeta a validación.',
      },
    });
    assert.equal(respuesta.abstencion, false);
    assert.equal(respuesta.fuentes_rag[0]?.documento, 'Programa de Tutorías del TecNM');
    assert.equal(respuesta.validacion_humana_requerida, true);
  });

  it('acepta JSON del modelo y rechaza texto sin el contrato', () => {
    const json = interpretarJsonModelo('```json\n{"evidencia":"a","explicacion":"b","accion_sugerida":"c"}\n```');
    assert.deepEqual(json, { evidencia: 'a', explicacion: 'b', accion_sugerida: 'c' });
    assert.equal(interpretarJsonModelo('no hay json'), null);
    assert.equal(interpretarJsonModelo('{"explicacion":"solo una clave"}'), null);
  });
});
