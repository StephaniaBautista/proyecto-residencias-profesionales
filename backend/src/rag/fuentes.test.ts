import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validarManifiestoFuentes } from './fuentes';

const fuente = {
  archivo: 'PROGRAMA_DE_TUTORIAS_TECNM.pdf',
  titulo: 'Programa de Tutorías del TecNM (2022; vigencia para ITTLA por validar)',
  emisor: 'Tecnológico Nacional de México; marco general',
  version: '2022',
  fecha: '2022-01-01',
  institucion_aplicable: 'TecNM marco general',
  vigencia_verificada: false,
  permisos: 'uso interno',
  url: null,
  aprobada_por: null,
  aprobada_en: null,
  habilitada: true,
};

describe('validarManifiestoFuentes (v2)', () => {
  it('acepta fuentes con metadatos de vigencia completos', () => {
    assert.deepEqual(validarManifiestoFuentes({ version: 2, fuentes: [fuente] }), [fuente]);
  });

  it('acepta url http(s) y fecha-hora de aprobación cuando vienen', () => {
    const [validada] = validarManifiestoFuentes({
      version: 2,
      fuentes: [
        {
          ...fuente,
          vigencia_verificada: true,
          url: 'https://www.tecnm.mx/programa-de-tutorias.pdf',
          aprobada_por: 'Subdirección Académica ITTLA',
          aprobada_en: '2026-10-20T18:30:00-06:00',
        },
      ],
    });
    assert.equal(validada?.url, 'https://www.tecnm.mx/programa-de-tutorias.pdf');
    assert.equal(validada?.vigencia_verificada, true);
    assert.equal(validada?.aprobada_en, '2026-10-20T18:30:00-06:00');
  });

  it('rechaza fechas que no existen en el calendario', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, fecha: '2022-02-30' }] }),
      /fecha válida en formato AAAA-MM-DD/,
    );
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, fecha: 'enero 2022' }] }),
      /fecha válida en formato AAAA-MM-DD/,
    );
  });

  it('rechaza vigencia_verificada que no sea boolean', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, vigencia_verificada: 'false' }] }),
      /vigencia_verificada como true o false/,
    );
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, vigencia_verificada: undefined }] }),
      /vigencia_verificada como true o false/,
    );
  });

  it('rechaza versión y permisos vacíos, y url con esquema no permitido', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, version: ' ' }] }),
      /versión válida/,
    );
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, permisos: '' }] }),
      /permisos de uso/,
    );
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, url: 'file:///etc/passwd' }] }),
      /url como texto http\(s\) o null/,
    );
  });

  it('rechaza rutas y traversal fuera del corpus', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, archivo: '../secreto.pdf' }] }),
      /nombre de archivo PDF sin rutas/,
    );
  });

  it('rechaza fuentes duplicadas y una lista sin fuentes habilitadas', () => {
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [fuente, fuente] }),
      /duplicada/,
    );
    assert.throws(
      () => validarManifiestoFuentes({ version: 2, fuentes: [{ ...fuente, habilitada: false }] }),
      /no tiene fuentes habilitadas/,
    );
  });
});

describe('validarManifiestoFuentes (compatibilidad v1)', () => {
  it('acepta el manifiesto v1 y completa los metadatos con valores seguros', () => {
    const fuenteV1 = {
      archivo: 'MANUAL_DEL_TUTOR_SNIT_2013.pdf',
      titulo: 'Manual del Tutor del SNIT (2013)',
      emisor: 'SNIT / TecNM',
      habilitada: true,
    };
    assert.deepEqual(validarManifiestoFuentes({ version: 1, fuentes: [fuenteV1] }), [
      {
        ...fuenteV1,
        version: null,
        fecha: null,
        institucion_aplicable: null,
        vigencia_verificada: false,
        permisos: 'uso interno',
        url: null,
        aprobada_por: null,
        aprobada_en: null,
      },
    ]);
  });
});
