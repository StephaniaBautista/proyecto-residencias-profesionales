export class ErrorApi extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(ruta, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const texto = await respuesta.text();
  const datos = texto ? (JSON.parse(texto) as { mensaje?: string }) : null;
  if (!respuesta.ok) {
    throw new ErrorApi(datos?.mensaje || 'No se pudo completar la operación.');
  }
  return datos as T;
}
