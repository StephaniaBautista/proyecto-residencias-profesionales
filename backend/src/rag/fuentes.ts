export type FuenteRag = {
  archivo: string;
  titulo: string;
  emisor: string;
  habilitada: boolean;
};

export function validarManifiestoFuentes(valor: unknown): FuenteRag[] {
  if (!esRegistro(valor) || valor.version !== 1 || !Array.isArray(valor.fuentes)) {
    throw new Error('El manifiesto RAG debe tener version 1 y una lista de fuentes.');
  }
  if (valor.fuentes.length < 1 || valor.fuentes.length > 20) {
    throw new Error('El manifiesto RAG debe incluir de 1 a 20 fuentes.');
  }

  const fuentes: FuenteRag[] = [];
  const archivos = new Set<string>();
  for (const entrada of valor.fuentes) {
    if (!esRegistro(entrada)) throw new Error('Hay una fuente RAG con formato no válido.');
    const { archivo, titulo, emisor, habilitada } = entrada;
    if (typeof archivo !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf$/i.test(archivo)) {
      throw new Error('Cada fuente RAG debe ser un nombre de archivo PDF sin rutas.');
    }
    if (archivos.has(archivo.toLowerCase())) throw new Error(`Fuente RAG duplicada: ${archivo}`);
    if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 220) {
      throw new Error(`La fuente ${archivo} necesita un título de hasta 220 caracteres.`);
    }
    if (typeof emisor !== 'string' || !emisor.trim() || emisor.length > 160) {
      throw new Error(`La fuente ${archivo} necesita identificar a su emisor.`);
    }
    if (typeof habilitada !== 'boolean') {
      throw new Error(`La fuente ${archivo} debe indicar habilitada como true o false.`);
    }
    archivos.add(archivo.toLowerCase());
    fuentes.push({ archivo, titulo: titulo.trim(), emisor: emisor.trim(), habilitada });
  }

  if (!fuentes.some((fuente) => fuente.habilitada)) {
    throw new Error('El manifiesto RAG no tiene fuentes habilitadas.');
  }
  return fuentes;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
