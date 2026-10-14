import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { BaseDatos } from '../base-datos/base-datos.service';
import { esRol } from '../comun/usuario';
import { leerEntorno } from '../entorno';
import { ES_PUBLICO } from './decoradores';
import { NOMBRE_COOKIE } from './cookie';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: BaseDatos,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const token = leerToken(req);
    if (!token) {
      if (publico) return true;
      throw new UnauthorizedException('Inicia sesión para continuar.');
    }

    let sub: number;
    try {
      const payload = jwt.verify(token, leerEntorno().jwtSecret);
      if (typeof payload === 'string') throw new Error('payload');
      sub = Number(payload.sub);
      if (!Number.isInteger(sub) || sub < 1) throw new Error('payload');
    } catch {
      if (publico) return true;
      throw new UnauthorizedException('La sesión no es válida.');
    }

    const filas = await this.db.sql<Array<{ id: number; correo: string; nombre: string; rol: string; activo: boolean }>>`
      select id, correo, nombre, rol, activo
      from usuario
      where id = ${sub}
    `;
    const usuario = filas[0];
    if (!usuario?.activo || !esRol(usuario.rol)) {
      throw new UnauthorizedException('La sesión no es válida.');
    }
    req.usuario = { id: usuario.id, correo: usuario.correo, nombre: usuario.nombre, rol: usuario.rol };
    return true;
  }
}

function leerToken(req: Request): string | undefined {
  const cookie = req.cookies?.[NOMBRE_COOKIE];
  if (typeof cookie === 'string' && cookie.length > 0) return cookie;
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return undefined;
}
