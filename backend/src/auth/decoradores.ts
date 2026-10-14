import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../comun/usuario';

export const ES_PUBLICO = 'esPublico';
export const ROLES_META = 'roles';

export const Publico = () => SetMetadata(ES_PUBLICO, true);
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_META, roles);
