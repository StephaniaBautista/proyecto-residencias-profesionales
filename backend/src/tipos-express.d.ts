import type { UsuarioSesion } from './comun/usuario';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

export {};
