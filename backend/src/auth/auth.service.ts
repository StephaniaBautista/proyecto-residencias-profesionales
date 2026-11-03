import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { valorConfiguracion } from '../comun/catalogos';
import { permitirAcceso } from '../comun/limite';
import { institucionActiva } from '../comun/periodo';
import { esRol } from '../comun/usuario';
import {
  esquemaIngreso,
  esquemaIngresoDemo,
  esquemaRecuperacion,
  esquemaRegistro,
  esquemaRestablecer,
  leerCuerpo,
} from '../comun/validar';
import { leerEntorno } from '../entorno';
import { ponerSesion, quitarSesion } from './cookie';

export const EMISOR_JWT = 'apoyo-tutorial-ittla';
export const AUDIENCIA_JWT = 'apoyo-tutorial-web';

const MENSAJE_RECUPERACION =
  'Si el correo está registrado, enviamos las instrucciones para restablecer la contraseña.';
const MINUTOS_TOKEN_RECUPERACION = 30;

type UsuarioFila = {
  id: number;
  correo: string;
  nombre: string;
  rol: string;
  hash_password: string;
  activo: boolean;
  token_version: number;
};

@Injectable()
export class AuthService {
  constructor(private readonly db: BaseDatos) {}

  async ingresar(cuerpo: unknown, req: Request, res: Response) {
    const datos = leerCuerpo(esquemaIngreso, cuerpo);
    if (!(await permitirAcceso(this.db.sql, `ingreso:${req.ip ?? 'local'}`, 8, 10 * 60 * 1000))) {
      throw new HttpException('Demasiados intentos. Espera unos minutos.', 429);
    }
    const usuario = await this.buscarPorCorreo(datos.correo);
    const coincide = usuario ? await bcrypt.compare(datos.password, usuario.hash_password) : false;
    if (!usuario || !coincide || !esRol(usuario.rol)) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    return this.abrirSesion(usuario, res, 'ingreso');
  }

  /**
   * Registro público. Crea una cuenta con rol `tutor` y abre sesión.
   * Se puede deshabilitar con la configuración `permitir_registro=false`.
   */
  async registrar(cuerpo: unknown, req: Request, res: Response) {
    const entorno = leerEntorno();
    const habilitado = Boolean(await valorConfiguracion(this.db.sql, 'permitir_registro', true));
    if (!habilitado) {
      throw new ForbiddenException(
        'El registro público no está habilitado. Solicita tu cuenta a coordinación.',
      );
    }
    if (!(await permitirAcceso(this.db.sql, `registro:${req.ip ?? 'local'}`, 5, 60 * 60 * 1000))) {
      throw new HttpException('Demasiados intentos. Espera unos minutos.', 429);
    }

    const datos = leerCuerpo(esquemaRegistro, cuerpo);
    const correo = datos.correo.toLowerCase().trim();
    const existentes = await this.db.sql<Array<{ id: number }>>`
      select id from usuario where lower(correo) = ${correo} limit 1
    `;
    if (existentes[0]) {
      throw new ConflictException('Ya existe una cuenta con ese correo.');
    }

    const institucion = await institucionActiva(this.db.sql);
    const hash = await bcrypt.hash(datos.password, 12);
    const creado = await this.db.sql<UsuarioFila[]>`
      insert into usuario (correo, nombre, rol, hash_password, institucion_id)
      values (${correo}, ${datos.nombre}, 'tutor', ${hash}, ${institucion.id})
      returning id, correo, nombre, rol, hash_password, activo, token_version
    `;
    const usuario = creado[0];
    if (!usuario) throw new Error('No se pudo crear la cuenta.');

    await registrarBitacora(this.db.sql, usuario.id, 'registro', 'usuario', usuario.id, {
      correo,
      rol: 'tutor',
      entorno: entorno.nodeEnv,
    });
    return this.abrirSesion(usuario, res, 'registro');
  }

  /**
   * Solicita el restablecimiento de contraseña. La respuesta es genérica para
   * no revelar si el correo existe. En desarrollo/demo se devuelve el token
   * para poder completar el flujo sin proveedor de correo; en producción no.
   */
  async solicitarRecuperacion(cuerpo: unknown, req: Request) {
    const entorno = leerEntorno();
    const habilitada = Boolean(
      await valorConfiguracion(this.db.sql, 'recuperacion_habilitada', true),
    );
    if (!habilitada) {
      throw new ForbiddenException('La recuperación de contraseña no está habilitada.');
    }

    const datos = leerCuerpo(esquemaRecuperacion, cuerpo);
    const correo = datos.correo.toLowerCase().trim();
    const ip = req.ip ?? 'local';
    if (!(await permitirAcceso(this.db.sql, `recuperar-ip:${ip}`, 10, 60 * 60 * 1000))) {
      throw new HttpException('Demasiadas solicitudes. Espera unos minutos.', 429);
    }
    if (!(await permitirAcceso(this.db.sql, `recuperar-correo:${correo}`, 3, 60 * 60 * 1000))) {
      throw new HttpException('Demasiadas solicitudes para ese correo. Espera unos minutos.', 429);
    }

    const usuario = await this.buscarPorCorreo(correo);
    const respuesta: {
      mensaje: string;
      token?: string;
      expira_en_minutos?: number;
    } = { mensaje: MENSAJE_RECUPERACION };

    if (usuario) {
      // Un solo enlace vigente por cuenta: invalida los anteriores.
      await this.db.sql`
        update recuperacion_password
        set usado = true
        where usuario_id = ${usuario.id} and usado = false
      `;
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);
      await this.db.sql`
        insert into recuperacion_password (usuario_id, token_hash, expira_en, ip)
        values (
          ${usuario.id},
          ${tokenHash},
          now() + (${MINUTOS_TOKEN_RECUPERACION} * interval '1 minute'),
          ${ip}
        )
      `;
      await registrarBitacora(
        this.db.sql,
        usuario.id,
        'solicitar_recuperacion',
        'usuario',
        usuario.id,
        { ip },
      );
      if (entorno.demoMode || !entorno.esProduccion) {
        respuesta.token = token;
        respuesta.expira_en_minutos = MINUTOS_TOKEN_RECUPERACION;
      }
    }

    return respuesta;
  }

  /**
   * Restablece la contraseña con un token vigente de un solo uso. Revoca las
   * sesiones anteriores incrementando `token_version`.
   */
  async restablecer(cuerpo: unknown, req: Request) {
    const datos = leerCuerpo(esquemaRestablecer, cuerpo);
    if (
      !(await permitirAcceso(this.db.sql, `restablecer:${req.ip ?? 'local'}`, 20, 60 * 60 * 1000))
    ) {
      throw new HttpException('Demasiados intentos. Espera unos minutos.', 429);
    }

    const tokenHash = hashToken(datos.token.trim());
    const filas = await this.db.sql<
      Array<{ id: number; usuario_id: number; correo: string }>
    >`
      select r.id, r.usuario_id, u.correo
      from recuperacion_password r
      join usuario u on u.id = r.usuario_id
      where r.token_hash = ${tokenHash}
        and r.usado = false
        and r.expira_en > now()
        and u.activo
      limit 1
    `;
    const recuperacion = filas[0];
    if (!recuperacion) {
      throw new BadRequestException(
        'El enlace no es válido, ya se usó o expiró. Solicita uno nuevo.',
      );
    }

    const hash = await bcrypt.hash(datos.password, 12);
    await this.db.sql`
      update usuario
      set hash_password = ${hash}, token_version = token_version + 1
      where id = ${recuperacion.usuario_id}
    `;
    await this.db.sql`
      update recuperacion_password set usado = true where id = ${recuperacion.id}
    `;
    await registrarBitacora(
      this.db.sql,
      recuperacion.usuario_id,
      'restablecer_password',
      'usuario',
      recuperacion.usuario_id,
      {},
    );

    return {
      ok: true,
      mensaje: 'Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.',
    };
  }

  async cuentasDemo() {
    const entorno = leerEntorno();
    if (!entorno.demoMode) {
      return { habilitado: false as const, cuentas: [] };
    }
    const cuentas = await this.db.sql<Array<{ correo: string; nombre: string; rol: string }>>`
      select correo, nombre, rol
      from usuario
      where activo
        and rol in ('tutor', 'coordinacion', 'asesoria', 'admin_tecnico')
      order by rol, nombre
    `;
    return {
      habilitado: true as const,
      cuentas: cuentas.map((cuenta) => ({
        correo: cuenta.correo,
        nombre: cuenta.nombre,
        rol: cuenta.rol,
      })),
    };
  }

  /**
   * Acceso de demostración sin contraseña. Sólo para QA con DEMO_MODE=true;
   * la interfaz pública ya no lo utiliza.
   */
  async ingresarDemo(cuerpo: unknown, req: Request, res: Response) {
    const entorno = leerEntorno();
    if (!entorno.demoMode) {
      throw new NotFoundException('Las cuentas de demostración no están habilitadas.');
    }
    if (!(await permitirAcceso(this.db.sql, `demo:${req.ip ?? 'local'}`, 20, 10 * 60 * 1000))) {
      throw new HttpException('Demasiados intentos. Espera unos minutos.', 429);
    }
    const datos = leerCuerpo(esquemaIngresoDemo, cuerpo);
    const usuario = await this.buscarPorCorreo(datos.correo);
    if (!usuario || !esRol(usuario.rol)) {
      throw new UnauthorizedException('La cuenta de demostración no existe o está inactiva.');
    }
    return this.abrirSesion(usuario, res, 'ingreso_demo');
  }

  async salir(usuario: { id: number } | null | undefined, res: Response) {
    if (usuario?.id) {
      await this.db.sql`
        update usuario
        set token_version = token_version + 1
        where id = ${usuario.id}
      `;
      await registrarBitacora(this.db.sql, usuario.id, 'salir', 'usuario', usuario.id, {});
    }
    quitarSesion(res);
    return { ok: true };
  }

  private async buscarPorCorreo(correo: string): Promise<UsuarioFila | null> {
    const filas = await this.db.sql<UsuarioFila[]>`
      select id, correo, nombre, rol, hash_password, activo, token_version
      from usuario
      where correo = ${correo.toLowerCase().trim()}
      limit 1
    `;
    const usuario = filas[0];
    if (!usuario || !usuario.activo) return null;
    return usuario;
  }

  private async abrirSesion(
    usuario: UsuarioFila,
    res: Response,
    operacion: 'ingreso' | 'ingreso_demo' | 'registro',
  ) {
    const entorno = leerEntorno();
    const token = jwt.sign(
      { sub: usuario.id, tv: usuario.token_version },
      entorno.jwtSecret,
      {
        expiresIn: `${entorno.sesionHoras}h`,
        issuer: EMISOR_JWT,
        audience: AUDIENCIA_JWT,
      },
    );
    ponerSesion(res, token);
    await registrarBitacora(this.db.sql, usuario.id, operacion, 'usuario', usuario.id, {
      correo: usuario.correo,
    });
    return {
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
