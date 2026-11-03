import type { CookieOptions, Response } from 'express';
import { leerEntorno } from '../entorno';

export const NOMBRE_COOKIE = 'sesion_tutorial';

export function opcionesCookie(): CookieOptions {
  const entorno = leerEntorno();
  const seguro = entorno.esProduccion || entorno.origen.startsWith('https://');
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: seguro,
    path: '/',
    maxAge: entorno.sesionHoras * 60 * 60 * 1000,
  };
}

export function ponerSesion(res: Response, token: string): void {
  res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
}

export function quitarSesion(res: Response): void {
  const opciones = opcionesCookie();
  res.clearCookie(NOMBRE_COOKIE, {
    path: opciones.path,
    sameSite: opciones.sameSite,
    secure: opciones.secure,
  });
}
