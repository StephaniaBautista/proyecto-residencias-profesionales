export type FuenteRag = {
  archivo: string;
  titulo: string;
  emisor: string;
  /** Versión editorial del documento (por ejemplo "2022"); null si no se conoce. */
  version: string | null;
  /** Fecha de publicación del documento en formato AAAA-MM-DD; null si no se conoce. */
  fecha: string | null;
  /** Alcance institucional con el que se indexa la fuente. */
  institucion_aplicable: string | null;
  /** false mientras ITTLA no confirme que la versión aplica localmente. */
  vigencia_verificada: boolean;
  /** Condiciones de uso del documento dentro del corpus. */
  permisos: string;
  /** URL del documento original, si se conoce. */
  url: string | null;
  aprobada_por: string | null;
  aprobada_en: string | null;
  habilitada: boolean;
};

const PERMISOS_POR_DEFECTO = 'uso interno';
const MAX_ARCHIVO = 160;
const MAX_TITULO = 220;
const MAX_EMISOR = 160;

export function validarManifiestoFuentes(valor: unknown): FuenteRag[] {
  if (!esRegistro(valor) || (valor.version !== 1 && valor.version !== 2) || !Array.isArray(valor.fuentes)) {
    throw new Error('El manifiesto RAG debe tener version 1 o 2 y una lista de fuentes.');
  }
  const versionManifiesto = valor.version;
  if (valor.fuentes.length < 1 || valor.fuentes.length > 20) {
    throw new Error('El manifiesto RAG debe incluir de 1 a 20 fuentes.');
  }

  const fuentes: FuenteRag[] = [];
  const archivos = new Set<string>();
  for (const entrada of valor.fuentes) {
    if (!esRegistro(entrada)) throw new Error('Hay una fuente RAG con formato no válido.');
    const { archivo, titulo, emisor, habilitada } = entrada;
    if (typeof archivo !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf$/i.test(archivo) || archivo.length > MAX_ARCHIVO) {
      throw new Error('Cada fuente RAG debe ser un nombre de archivo PDF sin rutas.');
    }
    if (archivos.has(archivo.toLowerCase())) throw new Error(`Fuente RAG duplicada: ${archivo}`);
    if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > MAX_TITULO) {
      throw new Error(`La fuente ${archivo} necesita un título de hasta ${MAX_TITULO} caracteres.`);
    }
    if (typeof emisor !== 'string' || !emisor.trim() || emisor.length > MAX_EMISOR) {
      throw new Error(`La fuente ${archivo} necesita identificar a su emisor.`);
    }
    if (typeof habilitada !== 'boolean') {
      throw new Error(`La fuente ${archivo} debe indicar habilitada como true o false.`);
    }
    archivos.add(archivo.toLowerCase());

    if (versionManifiesto === 1) {
      fuentes.push({
        archivo,
        titulo: titulo.trim(),
        emisor: emisor.trim(),
        version: null,
        fecha: null,
        institucion_aplicable: null,
        vigencia_verificada: false,
        permisos: PERMISOS_POR_DEFECTO,
        url: null,
        aprobada_por: null,
        aprobada_en: null,
        habilitada,
      });
      continue;
    }

    fuentes.push({
      archivo,
      titulo: titulo.trim(),
      emisor: emisor.trim(),
      version: versionDocumento(entrada.version, archivo),
      fecha: fechaDocumento(entrada.fecha, archivo),
      institucion_aplicable: textoRequerido(
        entrada.institucion_aplicable,
        `La fuente ${archivo} debe indicar su institución aplicable.`,
        MAX_EMISOR,
      ),
      vigencia_verificada: booleanoRequerido(
        entrada.vigencia_verificada,
        `La fuente ${archivo} debe indicar vigencia_verificada como true o false.`,
      ),
      permisos: textoRequerido(
        entrada.permisos,
        `La fuente ${archivo} debe indicar sus permisos de uso.`,
        120,
      ),
      url: urlDocumento(entrada.url, archivo),
      aprobada_por: textoOpcional(
        entrada.aprobada_por,
        `La fuente ${archivo} debe indicar aprobada_por como texto o null.`,
      ),
      aprobada_en: fechaHoraOpcional(entrada.aprobada_en, archivo),
      habilitada,
    });
  }

  if (!fuentes.some((fuente) => fuente.habilitada)) {
    throw new Error('El manifiesto RAG no tiene fuentes habilitadas.');
  }
  return fuentes;
}

function versionDocumento(valor: unknown, archivo: string): string {
  if (
    typeof valor !== 'string' ||
    !valor.trim() ||
    valor.trim().length > 40 ||
    !/^[0-9A-Za-z][0-9A-Za-z._ -]*$/.test(valor.trim())
  ) {
    throw new Error(`La fuente ${archivo} necesita una versión válida (por ejemplo "2022").`);
  }
  return valor.trim();
}

function fechaDocumento(valor: unknown, archivo: string): string {
  if (typeof valor !== 'string' || !fechaCalendarioValida(valor)) {
    throw new Error(`La fuente ${archivo} necesita una fecha válida en formato AAAA-MM-DD.`);
  }
  return valor;
}

function booleanoRequerido(valor: unknown, mensaje: string): boolean {
  if (typeof valor !== 'boolean') throw new Error(mensaje);
  return valor;
}

function textoRequerido(valor: unknown, mensaje: string, maximo: number): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) throw new Error(mensaje);
  return valor.trim();
}

function textoOpcional(valor: unknown, mensaje: string): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > 160) throw new Error(mensaje);
  return valor.trim();
}

function urlDocumento(valor: unknown, archivo: string): string | null {
  if (valor === null) return null;
  if (typeof valor !== 'string' || valor.length > 500) {
    throw new Error(`La fuente ${archivo} debe indicar url como texto http(s) o null.`);
  }
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`La fuente ${archivo} debe indicar url como texto http(s) o null.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`La fuente ${archivo} debe indicar url como texto http(s) o null.`);
  }
  return valor;
}

function fechaHoraOpcional(valor: unknown, archivo: string): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    throw new Error(`La fuente ${archivo} debe indicar aprobada_en como fecha-hora ISO o null.`);
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`La fuente ${archivo} debe indicar aprobada_en como fecha-hora ISO o null.`);
  }
  return valor;
}

function fechaCalendarioValida(valor: string): boolean {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!coincidencia) return false;
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
