import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { permitir } from '../comun/limite';
import { esRol } from '../comun/usuario';
import { esquemaIngreso, leerCuerpo } from '../comun/validar';
import { leerEntorno } from '../entorno';
import { ponerSesion, quitarSesion } from './cookie';

@Injectable()
export class AuthService {
  constructor(private readonly db: BaseDatos) {}

  async ingresar(cuerpo: unknown, req: Request, res: Response) {
    if (!permitir(`ingreso:${req.ip ?? 'local'}`, 8, 10 * 60 * 1000)) {
      throw new UnauthorizedException('Demasiados intentos. Espera unos minutos.');
    }
    const datos = leerCuerpo(esquemaIngreso, cuerpo);
    const filas = await this.db.sql<Array<{ id: number; correo: string; nombre: string; rol: string; hash_password: string; activo: boolean }>>`
      select id, correo, nombre, rol, hash_password, activo
      from usuario
      where correo = ${datos.correo.toLowerCase()}
    `;
    const usuario = filas[0];
    const coincide = usuario ? await bcrypt.compare(datos.password, usuario.hash_password) : false;
    if (!usuario || !usuario.activo || !coincide || !esRol(usuario.rol)) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    const token = jwt.sign({ sub: usuario.id }, leerEntorno().jwtSecret, { expiresIn: '8h' });
    ponerSesion(res, token);
    await registrarBitacora(this.db.sql, usuario.id, 'ingreso', 'usuario', usuario.id, { correo: usuario.correo });
    return { usuario: { id: usuario.id, correo: usuario.correo, nombre: usuario.nombre, rol: usuario.rol } };
  }

  salir(res: Response) {
    quitarSesion(res);
    return { ok: true };
  }
}
