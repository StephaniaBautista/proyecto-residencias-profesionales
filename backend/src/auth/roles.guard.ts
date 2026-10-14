import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Rol } from '../comun/usuario';
import { ROLES_META } from './decoradores';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_META, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para esta acción.');
    }
    return true;
  }
}
