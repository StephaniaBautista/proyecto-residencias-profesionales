import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { fechaCorta } from '../comun/fechas';
import { periodoActivo } from '../comun/periodo';
import type { UsuarioSesion } from '../comun/usuario';
import { recalcularAlertas } from './recalcular';

@Injectable()
export class AlertasService {
  constructor(private readonly db: BaseDatos) {}

  async listar(usuario: UsuarioSesion, periodoOpcional?: string) {
    const periodo = periodoOpcional ?? (await periodoActivo(this.db.sql));
    await recalcularAlertas(this.db.sql, periodo);
    const filas = await this.db.sql<
      Array<{
        id: number;
        id_anonimo: string;
        grupo: string;
        tipo: string;
        mensaje: string;
        prioridad: string;
        estado: string;
        nivel_alerta: string | null;
        creado_en: Date;
      }>
    >`
      select a.id, e.id_anonimo, e.grupo, a.tipo, a.mensaje, a.prioridad, a.estado,
             t.nivel_alerta, a.creado_en
      from alerta a
      join estudiante e on e.id = a.estudiante_id
      left join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = a.periodo
      where a.periodo = ${periodo}
        and a.estado = 'pendiente'
        ${usuario.rol === 'tutor' ? this.db.sql`and e.tutor_id = ${usuario.id}` : this.db.sql``}
      order by case a.prioridad when 'alta' then 0 else 1 end, a.creado_en desc
    `;
    return {
      periodo,
      total: filas.length,
      alertas: filas.map((fila) => ({
        ...fila,
        creado_en: fila.creado_en.toISOString(),
      })),
    };
  }

  async atender(usuario: UsuarioSesion, id: number) {
    const filas = await this.db.sql<Array<{ id: number; tutor_id: number; periodo: string }>>`
      select a.id, e.tutor_id, a.periodo
      from alerta a
      join estudiante e on e.id = a.estudiante_id
      where a.id = ${id} and a.estado = 'pendiente'
    `;
    const alerta = filas[0];
    if (!alerta) throw new NotFoundException('No se encontró la alerta pendiente.');
    if (usuario.rol === 'tutor' && alerta.tutor_id !== usuario.id) {
      throw new NotFoundException('No se encontró la alerta pendiente.');
    }
    await this.db.sql`
      update alerta
      set estado = 'atendida', atendida_en = now()
      where id = ${id}
    `;
    await registrarBitacora(this.db.sql, usuario.id, 'atender_alerta', 'alerta', id, {
      periodo: alerta.periodo,
    });
    return { ok: true, atendida_en: fechaCorta(new Date()) };
  }
}
