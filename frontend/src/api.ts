const TIEMPO_LIMITE_MS = 15_000;

export type CampoError = {
  campo: string;
  detalle: string;
};

type CuerpoError = {
  mensaje?: unknown;
  codigo?: unknown;
  campos?: unknown;
};

/** Error de la API con el estado HTTP, el código de negocio y los campos inválidos. */
export class ErrorApi extends Error {
  readonly status: number;
  readonly codigo?: string;
  readonly campos: CampoError[];

  constructor(mensaje: string, status = 0, codigo?: string, campos: CampoError[] = []) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

type ManejadorSesionVencida = () => void;

let alVencerSesion: ManejadorSesionVencida | null = null;

/** La sesión registra aquí qué hacer cuando cualquier petición responde 401. */
export function registrarSesionVencida(manejador: ManejadorSesionVencida | null): void {
  alVencerSesion = manejador;
}

/** Mensaje apto para el usuario final: nunca expone detalles técnicos. */
export function mensajeError(causa: unknown, respaldo = 'No se pudo completar la operación.'): string {
  if (causa instanceof ErrorApi) return causa.message;
  return respaldo;
}

function leerCuerpo(texto: string): CuerpoError | null {
  if (!texto.trim()) return null;
  try {
    const datos: unknown = JSON.parse(texto);
    return typeof datos === 'object' && datos !== null ? (datos as CuerpoError) : null;
  } catch {
    // El proxy o un servidor intermedio pudo devolver HTML en lugar de JSON.
    return null;
  }
}

function mensajeDelCuerpo(cuerpo: CuerpoError | null): string {
  const mensaje = cuerpo?.mensaje;
  return typeof mensaje === 'string' ? mensaje.trim() : '';
}

function codigoDelCuerpo(cuerpo: CuerpoError | null): string | undefined {
  return typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : undefined;
}

function camposDelCuerpo(cuerpo: CuerpoError | null): CampoError[] {
  if (!Array.isArray(cuerpo?.campos)) return [];
  const salida: CampoError[] = [];
  for (const item of cuerpo.campos) {
    if (typeof item !== 'object' || item === null) continue;
    const campo = (item as { campo?: unknown }).campo;
    const detalle = (item as { detalle?: unknown }).detalle;
    if (typeof campo === 'string' && typeof detalle === 'string' && campo.trim() && detalle.trim()) {
      salida.push({ campo: campo.trim(), detalle: detalle.trim() });
    }
  }
  return salida;
}

/** Errores de validación por campo que devolvió la API, listos para pintar junto al input. */
export function erroresDeCampos(causa: unknown): Record<string, string> {
  if (!(causa instanceof ErrorApi)) return {};
  const salida: Record<string, string> = {};
  for (const { campo, detalle } of causa.campos) {
    if (!salida[campo]) salida[campo] = detalle;
  }
  return salida;
}

function mensajeSegunEstado(status: number, cuerpo: CuerpoError | null): string {
  const delServidor = mensajeDelCuerpo(cuerpo);
  const codigo = codigoDelCuerpo(cuerpo);

  switch (status) {
    case 401:
      return delServidor || 'Tu sesión venció. Vuelve a entrar.';
    case 403:
      return delServidor || 'No tienes permiso para ver esta información.';
    case 404:
      return delServidor || 'No encontramos lo que buscabas.';
    case 429:
      return delServidor || 'Demasiadas solicitudes. Espera un momento y vuelve a intentar.';
    case 503:
      if (codigo === 'RAG_NO_CONFIGURADO') {
        return 'La consulta normativa todavía no está habilitada por la institución.';
      }
      return delServidor || 'El servicio no está disponible por ahora. Vuelve a intentar más tarde.';
    default:
      if (status >= 500) {
        return delServidor || 'El servidor no respondió correctamente. Intenta de nuevo más tarde.';
      }
      return delServidor || 'No se pudo completar la operación.';
  }
}

function errorDeRed(vencidoPorTiempo: boolean): ErrorApi {
  if (vencidoPorTiempo) {
    return new ErrorApi(
      'El servidor tardó demasiado en responder. Vuelve a intentar.',
      0,
      'TIEMPO_AGOTADO',
    );
  }
  return new ErrorApi(
    'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
    0,
    'SIN_CONEXION',
  );
}

/**
 * Cliente único de la API.
 *
 * - Agrega `credentials: 'include'` y JSON cuando hay cuerpo.
 * - Corta la petición a los 15 s con AbortController.
 * - Protege el parseo de respuestas HTML o de proxy.
 * - Traduce 401/403/404/429/5xx a mensajes para el usuario final.
 * - Ante 401 avisa a la sesión para limpiarla y volver al ingreso.
 */
export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const control = new AbortController();
  let vencidoPorTiempo = false;
  const temporizador = setTimeout(() => {
    vencidoPorTiempo = true;
    control.abort();
  }, TIEMPO_LIMITE_MS);

  const senalExterna = init?.signal ?? null;
  const abortarPorSenalExterna = () => control.abort();
  if (senalExterna) {
    if (senalExterna.aborted) control.abort();
    else senalExterna.addEventListener('abort', abortarPorSenalExterna);
  }

  try {
    let respuesta: Response;
    try {
      respuesta = await fetch(ruta, {
        ...init,
        credentials: 'include',
        signal: control.signal,
        headers: {
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw errorDeRed(vencidoPorTiempo);
    }

    let texto: string;
    try {
      texto = await respuesta.text();
    } catch {
      throw errorDeRed(vencidoPorTiempo);
    }

    const cuerpo = leerCuerpo(texto);

    if (!respuesta.ok) {
      if (respuesta.status === 401) alVencerSesion?.();
      throw new ErrorApi(
        mensajeSegunEstado(respuesta.status, cuerpo),
        respuesta.status,
        codigoDelCuerpo(cuerpo),
        camposDelCuerpo(cuerpo),
      );
    }

    if (texto.trim() && cuerpo === null) {
      throw new ErrorApi(
        'El servidor devolvió una respuesta inesperada. Vuelve a intentar más tarde.',
        respuesta.status,
        'RESPUESTA_INVALIDA',
      );
    }

    return cuerpo as T;
  } finally {
    clearTimeout(temporizador);
    senalExterna?.removeEventListener('abort', abortarPorSenalExterna);
  }
}
