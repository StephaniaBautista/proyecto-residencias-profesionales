export const MENSAJE_ABSTENCION =
  'No se encontró evidencia suficiente en los documentos autorizados cargados.';

export type FragmentoRecuperado = {
  documento: string;
  emisor?: string;
  numero: number;
  pagina: number | null;
  texto: string;
  similitud: number;
};

export type RespuestaAgente = {
  id_estudiante_anonimo: string | null;
  nivel_alerta: string | null;
  indicadores_activos: string[];
  evidencia: string;
  explicacion: string;
  accion_sugerida: string;
  fuentes_rag: Array<{ documento: string; fragmento: number; pagina: number | null }>;
  limitaciones: string;
  validacion_humana_requerida: true;
  abstencion: boolean;
};

const LIMITACION =
  'La respuesta se apoya solo en fragmentos autorizados. No sustituye la interpretación del personal institucional ni constituye una decisión.';

export function decidirRecuperacion(similitudes: number[], umbral: number): { suficiente: boolean; mejor: number } {
  const mejor = similitudes.length ? Math.max(...similitudes) : 0;
  return { suficiente: mejor >= umbral, mejor };
}

export function respuestaAbstencion(idEstudiante: string | null): RespuestaAgente {
  return {
    id_estudiante_anonimo: idEstudiante,
    nivel_alerta: null,
    indicadores_activos: [],
    evidencia: '',
    explicacion: MENSAJE_ABSTENCION,
    accion_sugerida: '',
    fuentes_rag: [],
    limitaciones: LIMITACION,
    validacion_humana_requerida: true,
    abstencion: true,
  };
}

export function respuestaConEvidencia(params: {
  idEstudiante: string | null;
  nivel: string | null;
  indicadores: string[];
  fragmentos: FragmentoRecuperado[];
  textoModelo: { evidencia: string; explicacion: string; accion_sugerida: string } | null;
}): RespuestaAgente {
  const fuente = params.fragmentos[0];
  const respaldo = fuente
    ? `Fragmento ${fuente.numero} de ${fuente.documento}: ${fuente.texto.slice(0, 500)}`
    : '';
  return {
    id_estudiante_anonimo: params.idEstudiante,
    nivel_alerta: params.nivel,
    indicadores_activos: params.indicadores,
    evidencia: params.textoModelo?.evidencia?.trim() || respaldo,
    explicacion: params.textoModelo?.explicacion?.trim() || respaldo,
    accion_sugerida: params.textoModelo?.accion_sugerida?.trim() || 'Revisar el fragmento recuperado antes de proponer una acción.',
    fuentes_rag: params.fragmentos.map((fragmento) => ({
      documento: fragmento.documento,
      fragmento: fragmento.numero,
      pagina: fragmento.pagina,
    })),
    limitaciones: LIMITACION,
    validacion_humana_requerida: true,
    abstencion: false,
  };
}

export function interpretarJsonModelo(texto: string): { evidencia: string; explicacion: string; accion_sugerida: string } | null {
  const limpio = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) return null;
  try {
    const valor = JSON.parse(limpio.slice(inicio, fin + 1)) as Record<string, unknown>;
    if (typeof valor.explicacion !== 'string' || typeof valor.evidencia !== 'string' || typeof valor.accion_sugerida !== 'string') {
      return null;
    }
    return {
      evidencia: valor.evidencia,
      explicacion: valor.explicacion,
      accion_sugerida: valor.accion_sugerida,
    };
  } catch {
    return null;
  }
}
