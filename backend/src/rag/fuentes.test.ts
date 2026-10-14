import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validarManifiestoFuentes } from './fuentes';

const fuente = {
  archivo: 'PROGRAMA_DE_TUTORIAS_TECNM.pdf',
  titulo: 'Programa de Tutorías del TecNM (2022; vigencia para ITTLA por validar)',
  emisor: 'Tecnológico Nacional de México; marco general',
  habilitada: true,
};

describe('validarManifiestoFuentes', () => {
  it('acepta fuentes PDF con procedencia explícita', () => {
    assert.deepEqual(validarManifiestoFuentes({ version: 1, fuentes: [fuente] }), [fuente]);
  });

  it('rechaza rutas y traversal fuera del corpus', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 1, fuentes: [{ ...fuente, archivo: '../secreto.pdf' }] }),
      /nombre de archivo PDF sin rutas/,
    );
  });

  it('rechaza fuentes duplicadas y una lista sin fuentes habilitadas', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 1, fuentes: [fuente, fuente] }),
      /duplicada/,
    );
    assert.throws(
      () => validarManifiestoFuentes({ version: 1, fuentes: [{ ...fuente, habilitada: false }] }),
      /no tiene fuentes habilitadas/,
    );
  });
});
