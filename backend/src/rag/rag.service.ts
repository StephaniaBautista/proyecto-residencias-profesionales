import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseDatos } from '../base-datos/base-datos.service';
import { registrarBitacora } from '../comun/bitacora';
import { numero } from '../comun/fechas';
import { permitir } from '../comun/limite';
import type { UsuarioSesion } from '../comun/usuario';
import { leerEntorno } from '../entorno';
import { completarJson, embeberTextos } from './openrouter';
import { mensajesConsulta } from './prompt';
import {
  decidirRecuperacion,
  interpretarJsonModelo,
  respuestaAbstencion,
  respuestaConEvidencia,
  type FragmentoRecuperado,
  type RespuestaAgente,
} from './respuesta';

@Injectable()
export class RagService {
  constructor(private readonly db: BaseDatos) {}

  async consultar(usuario: UsuarioSesion, pregunta: string, idAnonimo?: string) {
    if (!permitir(`rag:${usuario.id}`, 30, 60 * 60 * 1000)) {
      throw new HttpException('Llegaste al límite de consultas de esta hora.', 429);
    }
    const entorno = leerEntorno();
    if (!entorno.openRouterKey) {
      throw new HttpException('Falta configurar OPENROUTER_API_KEY en el servidor.', 503);
    }

    const ficha = idAnonimo ? await this.ficha(usuario, idAnonimo) : null;
    let vectores: number[][];
    try {
      vectores = await embeberTextos([pregunta], entorno);
    } catch (error) {
      throw new HttpException(mensajeExterno(error), 502);
    }
    const vector = vectores[0];
    if (!vector || vector.length !== entorno.embeddingDimensiones) {
      throw new HttpException(
        `El modelo de embeddings devolvió ${vector?.length ?? 0} dimensiones y la base espera ${entorno.embeddingDimensiones}.`,
        502,
      );
    }

    const fragmentos = await this.recuperar(vector);
    const decision = decidirRecuperacion(
      fragmentos.map((fragmento) => fragmento.similitud),
      entorno.umbralSimilitud,
    );
    const utiles = decision.suficiente ? fragmentos.filter((fragmento) => fragmento.similitud >= entorno.umbralSimilitud) : [];

    let respuesta: RespuestaAgente;
    if (!utiles.length) {
      respuesta = respuestaAbstencion(ficha?.id_anonimo ?? null);
    } else {
      let texto = null;
      try {
        const mensajes = mensajesConsulta({
          pregunta,
          fragmentos: utiles,
          estudiante: ficha
            ? {
                id_anonimo: ficha.id_anonimo,
                nivel_alerta: ficha.nivel_alerta,
                senales: ficha.senales,
                resumen: ficha.resumen,
              }
            : null,
        });
        const crudo = await completarJson(mensajes.system, mensajes.user, entorno);
        texto = interpretarJsonModelo(crudo);
      } catch (error) {
        throw new HttpException(mensajeExterno(error), 502);
      }
      respuesta = respuestaConEvidencia({
        idEstudiante: ficha?.id_anonimo ?? null,
        nivel: ficha?.nivel_alerta ?? null,
        indicadores: ficha?.senales ?? [],
        fragmentos: utiles,
        textoModelo: texto,
      });
    }

    await this.db.sql`
      insert into consulta_rag (usuario_id, estudiante_id, pregunta, respuesta, abstencion)
      values (
        ${usuario.id},
        ${ficha?.id ?? null},
        ${pregunta},
        ${this.db.sql.json(respuesta)},
        ${respuesta.abstencion}
      )
    `;
    await registrarBitacora(this.db.sql, usuario.id, 'consultar_rag', 'consulta_rag', null, {
      abstencion: respuesta.abstencion,
      id_anonimo: ficha?.id_anonimo ?? null,
    });
    return respuesta;
  }

  async recientes(usuario: UsuarioSesion) {
    const filas = await this.db.sql<
      Array<{ id: number; pregunta: string; abstencion: boolean; respuesta: RespuestaAgente; creado_en: Date; id_anonimo: string | null }>
    >`
      select c.id, c.pregunta, c.abstencion, c.respuesta, c.creado_en, e.id_anonimo
      from consulta_rag c
      left join estudiante e on e.id = c.estudiante_id
      where c.usuario_id = ${usuario.id}
      order by c.creado_en desc
      limit 12
    `;
    return {
      consultas: filas.map((fila) => ({
        id: fila.id,
        pregunta: fila.pregunta,
        abstencion: fila.abstencion,
        respuesta: fila.respuesta,
        id_anonimo: fila.id_anonimo,
        creado_en: fila.creado_en.toISOString(),
      })),
    };
  }

  private async recuperar(vector: number[]): Promise<FragmentoRecuperado[]> {
    const literal = vectorATexto(vector);
    const filas = await this.db.sql<
      Array<{ documento: string; emisor: string; numero: number; pagina: number | null; texto: string; similitud: number }>
    >`
      select
        d.titulo as documento,
        d.emisor,
        f.numero,
        f.pagina,
        f.texto,
        (1 - (f.embedding operator(extensions.<=>) ${literal}::extensions.vector))::float8 as similitud
      from fragmento_rag f
      join documento_rag d on d.id = f.documento_id
      where d.vigente and f.embedding is not null
      order by f.embedding operator(extensions.<=>) ${literal}::extensions.vector
      limit 4
    `;
    return filas.map((fila) => ({ ...fila, similitud: numero(fila.similitud) }));
  }

  private async ficha(usuario: UsuarioSesion, idAnonimo: string) {
    const filas = await this.db.sql<
      Array<{
        id: number;
        id_anonimo: string;
        nivel_alerta: string;
        senales: string[];
        promedio_periodo: number;
        porcentaje_asistencia: number;
        materias_reprobadas: number;
        avance_curricular: number;
        acuerdos_vencidos: number;
      }>
    >`
      select
        e.id,
        e.id_anonimo,
        t.nivel_alerta,
        t.senales,
        t.promedio_periodo::float8 as promedio_periodo,
        t.porcentaje_asistencia::float8 as porcentaje_asistencia,
        t.materias_reprobadas,
        t.avance_curricular::float8 as avance_curricular,
        t.acuerdos_vencidos
      from estudiante e
      join trayectoria_periodo t on t.estudiante_id = e.id and t.periodo = '2026-1'
      where e.id_anonimo = ${idAnonimo}
        ${usuario.rol === 'tutor' ? this.db.sql`and e.tutor_id = ${usuario.id}` : this.db.sql``}
    `;
    const fila = filas[0];
    if (!fila) throw new NotFoundException('No se encontró el tutorado.');
    return {
      id: fila.id,
      id_anonimo: fila.id_anonimo,
      nivel_alerta: fila.nivel_alerta,
      senales: fila.senales,
      resumen: `Promedio ${fila.promedio_periodo}, asistencia ${fila.porcentaje_asistencia}%, materias reprobadas ${fila.materias_reprobadas}, avance ${fila.avance_curricular}%, acuerdos vencidos ${fila.acuerdos_vencidos}.`,
    };
  }
}

function vectorATexto(vector: number[]): string {
  if (vector.some((valor) => !Number.isFinite(valor))) {
    throw new HttpException('El embedding recibido no es numérico.', 502);
  }
  return `[${vector.join(',')}]`;
}

function mensajeExterno(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('OpenRouter')) return error.message;
  if (error instanceof Error && error.message.startsWith('Falta OPENROUTER')) return error.message;
  return 'No se pudo consultar el modelo. Revisa la clave y el nombre del modelo.';
}
