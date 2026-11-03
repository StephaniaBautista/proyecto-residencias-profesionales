import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { recalcularAlertas } from '../src/alertas/recalcular';
import { crearSql, type Sql } from '../src/base-datos/conexion';
import { registrarEntrenamiento } from '../src/ml/entrenamiento';
import { validarManifiestoFuentes } from '../src/rag/fuentes';
import { marcarRiesgoObservado, recalcularPeriodo } from '../src/semaforo/evaluacion';

type Carrera = { clave: string; nombre: string };
type Grupo = { clave: string; nombre: string };
type Periodo = {
  clave: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
};
type UsuarioDataset = { correo: string; nombre: string; rol: string };

type Asignatura = {
  periodo: string;
  clave: string;
  nombre: string;
  creditos: number;
  calificacion: number | null;
  resultado: 'aprobado' | 'reprobado' | 'sin_registro';
  oportunidad: number;
  fuente: string;
};

type Parcial = {
  periodo: string;
  clave_asignatura: string;
  numero: number;
  calificacion: number | null;
  acreditada: boolean | null;
  exigible: boolean;
  fuente: string;
};

type Trayectoria = {
  periodo: string;
  creditos_aprobados: number;
  creditos_pendientes: number;
  promedio_periodo: number;
  materias_reprobadas: number;
  porcentaje_asistencia: number;
  avance_curricular: number;
  acuerdos_vencidos: number;
};

type Estudiante = {
  id_anonimo: string;
  id_fuente?: string;
  carrera: string;
  semestre: number;
  generacion: string;
  plan_estudios: string;
  modalidad: string;
  grupo: string;
  estatus_academico: string;
  tutor_correo: string;
  trayectoria: Trayectoria[];
  asignaturas: Asignatura[];
  parciales: Parcial[];
  curso_especial: Array<{ periodo: string; clave_asignatura: string; registrado: boolean; fuente?: string }>;
};

type Dataset = {
  contrato: string;
  version: string;
  institucion: { clave: string; nombre: string; nombre_corto: string };
  periodos: Periodo[];
  carreras: Carrera[];
  grupos: Grupo[];
  usuarios: UsuarioDataset[];
  estudiantes: Estudiante[];
  sesiones_tutoriales: Array<{
    id_anonimo: string;
    periodo: string;
    tipo?: string;
    tema?: string;
    acuerdo?: string;
    estado?: string;
    responsable?: string;
  }>;
  situaciones: Array<{
    id_anonimo: string;
    categoria: string;
    necesidad: string;
    origen?: string;
    documento?: string;
    estado?: string;
  }>;
  canalizaciones: Array<{
    id_anonimo: string;
    categoria: string;
    area_sugerida?: string;
    institucion?: string;
    estatus?: string;
    nota?: string;
  }>;
  asesorias: Array<{
    area: string;
    asignatura?: string;
    modalidad?: string;
    dia?: string;
    horario?: string;
    vigencia?: string;
    estado?: string;
  }>;
  solicitudes: Array<{ id_anonimo: string; tipo: string; estado?: string; area?: string; nota?: string }>;
  resumen?: Record<string, unknown>;
};

type ReglasArchivo = {
  version: string;
  estado: string;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  aprobada_por: string | null;
  nota: string;
  reglas: Array<{
    codigo: string;
    prioridad: number;
    nivel: string;
    titulo: string;
    descripcion: string;
    condicion: unknown;
    accion: string;
  }>;
};

type ConfiguracionArchivo = {
  valores: Array<{ clave: string; valor: unknown; descripcion?: string; visible_ui?: boolean }>;
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const reemplazar = args.has('--reemplazar');

  if (process.env.NODE_ENV === 'production' && !args.has('--forzar')) {
    throw new Error(
      'La semilla reemplaza datos y no debe correr en producción. Si es intencional, usa --forzar.',
    );
  }

  const carpetaDatos = path.join(process.cwd(), 'datos');
  const [dataset, reglasArchivo, configuracionArchivo, manifiestoFuentes] = await Promise.all([
    leerJson<Dataset>(path.join(carpetaDatos, 'dataset.json')),
    leerJson<ReglasArchivo>(path.join(carpetaDatos, 'reglas-semaforo.json')),
    leerJson<ConfiguracionArchivo>(path.join(carpetaDatos, 'configuracion.json')),
    leerJson<unknown>(path.join(process.cwd(), 'corpus', 'fuentes-rag.json')),
  ]);
  const fuentesRag = validarManifiestoFuentes(manifiestoFuentes);

  const totalAsignaturas = dataset.estudiantes.reduce(
    (suma, estudiante) => suma + estudiante.asignaturas.length,
    0,
  );
  const totalParciales = dataset.estudiantes.reduce(
    (suma, estudiante) => suma + estudiante.parciales.length,
    0,
  );
  if (
    dataset.estudiantes.length !== 30 ||
    totalAsignaturas !== 540 ||
    dataset.periodos.length !== 3
  ) {
    throw new Error(
      `El dataset no cumple el contrato: ${dataset.estudiantes.length} estudiantes, ` +
        `${totalAsignaturas} asignaturas, ${dataset.periodos.length} periodos.`,
    );
  }
  if (!configuracionArchivo.valores.some((fila) => fila.clave === 'version_reglas')) {
    throw new Error('La configuración no declara version_reglas.');
  }
  const periodoActivo = dataset.periodos.find((periodo) => periodo.activo)?.clave;
  if (!periodoActivo) throw new Error('El dataset no marca un periodo activo.');

  console.log(
    `Dataset ${dataset.version}: ${dataset.estudiantes.length} estudiantes, ` +
      `${totalAsignaturas} asignaturas, ${totalParciales} parciales, ${dataset.periodos.length} periodos.`,
  );
  if (dryRun) {
    console.log('Simulación de semilla: no se escribió en la base.');
    return;
  }

  const sql = crearSql();
  try {
    const existentes = await sql<{ total: number }[]>`select count(*)::int as total from estudiante`;
    if ((existentes[0]?.total ?? 0) > 0 && !reemplazar) {
      throw new Error(
        'La base ya tiene estudiantes. La semilla reemplaza todos los datos: vuelve a ejecutar con --reemplazar.',
      );
    }

    const contrasenaDemo =
      process.env.DEMO_PASSWORD?.trim() || `${randomBytes(9).toString('base64url')}`;
    const hash = await bcrypt.hash(contrasenaDemo, 12);
    const institucionId = await sql.begin(async (tx) => {
      await vaciar(tx);

      const institucion = await tx<{ id: number }[]>`
        insert into institucion (clave, nombre, nombre_corto)
        values (${dataset.institucion.clave}, ${dataset.institucion.nombre}, ${dataset.institucion.nombre_corto})
        returning id
      `;
      const idInstitucion = institucion[0]?.id;
      if (!idInstitucion) throw new Error('No se insertó la institución.');

      for (const periodo of dataset.periodos) {
        await tx`
          insert into periodo (institucion_id, clave, nombre, fecha_inicio, fecha_fin, activo)
          values (${idInstitucion}, ${periodo.clave}, ${periodo.nombre},
                  ${periodo.fecha_inicio}, ${periodo.fecha_fin}, ${periodo.activo})
        `;
      }
      for (const carrera of dataset.carreras) {
        await tx`
          insert into catalogo_carrera (institucion_id, clave, nombre)
          values (${idInstitucion}, ${carrera.clave}, ${carrera.nombre})
        `;
      }
      for (const grupo of dataset.grupos) {
        await tx`
          insert into catalogo_grupo (institucion_id, clave, nombre)
          values (${idInstitucion}, ${grupo.clave}, ${grupo.nombre})
        `;
      }
      for (const fila of configuracionArchivo.valores) {
        await tx`
          insert into configuracion (clave, valor, descripcion, visible_ui)
          values (${fila.clave}, ${tx.json(fila.valor)}, ${fila.descripcion ?? ''}, ${Boolean(fila.visible_ui)})
        `;
      }
      for (const regla of reglasArchivo.reglas) {
        await tx`
          insert into regla_semaforo (
            institucion_id, codigo, version, prioridad, nivel, titulo, descripcion,
            condicion, accion, vigencia_desde, vigencia_hasta, activa, aprobada_por
          ) values (
            ${idInstitucion}, ${regla.codigo}, ${reglasArchivo.version}, ${regla.prioridad},
            ${regla.nivel}, ${regla.titulo}, ${regla.descripcion}, ${tx.json(regla.condicion)},
            ${regla.accion}, ${reglasArchivo.vigencia_desde}, ${reglasArchivo.vigencia_hasta},
            true, ${reglasArchivo.aprobada_por}
          )
        `;
      }

      // Documentos del corpus RAG: se registran con metadatos y sin embeddings.
      // La ingesta real (`npm run ingest`) los reemplaza e indexa cuando hay clave.
      for (const fuente of fuentesRag) {
        await tx`
          insert into documento_rag (
            institucion_id, titulo, emisor, nombre_archivo, vigente, fragmentos,
            version, fecha_documento, institucion_aplicable, vigencia_verificada,
            permisos, url, aprobada_por, aprobada_en
          ) values (
            ${idInstitucion}, ${fuente.titulo}, ${fuente.emisor}, ${fuente.archivo}, true, 0,
            ${fuente.version}, ${fuente.fecha}, ${fuente.institucion_aplicable},
            ${fuente.vigencia_verificada}, ${fuente.permisos}, ${fuente.url},
            ${fuente.aprobada_por}, ${fuente.aprobada_en}
          )
        `;
      }

      const idsUsuarios = new Map<string, number>();
      for (const usuario of dataset.usuarios) {
        const creado = await tx<{ id: number }[]>`
          insert into usuario (correo, nombre, rol, hash_password, institucion_id)
          values (${usuario.correo}, ${usuario.nombre}, ${usuario.rol}, ${hash}, ${idInstitucion})
          returning id
        `;
        const id = creado[0]?.id;
        if (!id) throw new Error(`No se creó el usuario ${usuario.correo}.`);
        idsUsuarios.set(usuario.correo, id);
      }

      const fechasPeriodo = new Map(
        dataset.periodos.map((periodo) => [periodo.clave, new Date(`${periodo.fecha_inicio}T12:00:00Z`)]),
      );
      const idsEstudiantes = new Map<string, { id: number; tutorId: number }>();

      for (const estudiante of dataset.estudiantes) {
        const tutorId = idsUsuarios.get(estudiante.tutor_correo);
        if (!tutorId) throw new Error(`Falta el tutor ${estudiante.tutor_correo}.`);
        const creado = await tx<{ id: number }[]>`
          insert into estudiante (
            institucion_id, id_anonimo, carrera, semestre, generacion, plan_estudios, modalidad,
            grupo, estatus_academico, tutor_id, fuente_sintetica, version_dataset
          ) values (
            ${idInstitucion}, ${estudiante.id_anonimo}, ${estudiante.carrera}, ${estudiante.semestre},
            ${estudiante.generacion}, ${estudiante.plan_estudios}, ${estudiante.modalidad},
            ${estudiante.grupo}, ${estudiante.estatus_academico}, ${tutorId},
            'generado_sinteticamente', ${dataset.version}
          )
          returning id
        `;
        const idEstudiante = creado[0]?.id;
        if (!idEstudiante) throw new Error(`No se creó el estudiante ${estudiante.id_anonimo}.`);
        idsEstudiantes.set(estudiante.id_anonimo, { id: idEstudiante, tutorId });

        for (const trayectoria of estudiante.trayectoria) {
          await tx`
            insert into trayectoria_periodo (
              estudiante_id, periodo, creditos_aprobados, creditos_pendientes,
              promedio_periodo, materias_reprobadas, porcentaje_asistencia,
              avance_curricular, acuerdos_vencidos, puntos_alerta, nivel_alerta,
              senales, accion_sugerida
            ) values (
              ${idEstudiante}, ${trayectoria.periodo}, ${trayectoria.creditos_aprobados},
              ${trayectoria.creditos_pendientes}, ${trayectoria.promedio_periodo},
              ${trayectoria.materias_reprobadas}, ${trayectoria.porcentaje_asistencia},
              ${trayectoria.avance_curricular}, ${trayectoria.acuerdos_vencidos},
              0, 'verde', '{}', ''
            )
          `;
        }

        for (const asignatura of estudiante.asignaturas) {
          await tx`
            insert into asignatura_resultado (
              estudiante_id, periodo, clave_asignatura, nombre_asignatura, creditos,
              calificacion, resultado, oportunidad
            ) values (
              ${idEstudiante}, ${asignatura.periodo}, ${asignatura.clave}, ${asignatura.nombre},
              ${asignatura.creditos}, ${asignatura.calificacion}, ${asignatura.resultado},
              ${asignatura.oportunidad}
            )
          `;
        }

        for (const parcial of estudiante.parciales) {
          await tx`
            insert into evaluacion_parcial (
              estudiante_id, periodo, clave_asignatura, numero, calificacion,
              exigible, acreditada, fuente
            ) values (
              ${idEstudiante}, ${parcial.periodo}, ${parcial.clave_asignatura}, ${parcial.numero},
              ${parcial.calificacion}, ${parcial.exigible}, ${parcial.acreditada}, ${parcial.fuente}
            )
          `;
        }

        for (const curso of estudiante.curso_especial) {
          await tx`
            insert into curso_especial (
              estudiante_id, periodo, clave_asignatura, registrado, fuente
            ) values (
              ${idEstudiante}, ${curso.periodo}, ${curso.clave_asignatura}, ${curso.registrado},
              ${curso.fuente ?? 'generado_sintetico'}
            )
          `;
        }
      }

      let indiceSesion = 0;
      for (const sesion of dataset.sesiones_tutoriales) {
        const estudiante = idsEstudiantes.get(sesion.id_anonimo);
        if (!estudiante) continue;
        const inicio = fechasPeriodo.get(sesion.periodo) ?? new Date();
        const fechaSesion = sumarDias(inicio, 7 + (indiceSesion % 8) * 7);
        const fechaCompromiso = sumarDias(fechaSesion, 14);
        const estatus = normalizarEstatusAcuerdo(sesion.estado);
        await tx`
          insert into sesion_tutorial (
            estudiante_id, tutor_id, fecha_sesion, tipo_sesion, motivo, acuerdos,
            fecha_compromiso, estatus_acuerdo, observacion
          ) values (
            ${estudiante.id}, ${estudiante.tutorId}, ${fechaSesion}, ${sesion.tipo ?? 'seguimiento'},
            ${sesion.tema ?? 'Acompañamiento tutorial'}, ${sesion.acuerdo ?? 'Acuerdo de seguimiento'},
            ${fechaCompromiso}, ${estatus}, 'Registro sintético sin datos personales.'
          )
        `;
        indiceSesion += 1;
      }

      for (const situacion of dataset.situaciones) {
        const estudiante = idsEstudiantes.get(situacion.id_anonimo);
        if (!estudiante) continue;
        await tx`
          insert into necesidad_apoyo (
            estudiante_id, categoria, necesidad, origen, documento_presentado, estado
          ) values (
            ${estudiante.id}, ${situacion.categoria}, ${situacion.necesidad},
            ${situacion.origen ?? 'declaracion_sintetica'},
            ${situacion.documento ?? 'No se almacena'}, ${situacion.estado ?? 'sin_atender'}
          )
        `;
      }

      for (const canalizacion of dataset.canalizaciones) {
        const estudiante = idsEstudiantes.get(canalizacion.id_anonimo);
        if (!estudiante) continue;
        await tx`
          insert into canalizacion (
            estudiante_id, categoria, area_sugerida, institucion_destino, estatus, nota
          ) values (
            ${estudiante.id}, ${canalizacion.categoria}, ${canalizacion.area_sugerida ?? 'por_confirmar'},
            ${canalizacion.institucion ?? 'por_verificar'}, ${canalizacion.estatus ?? 'pendiente'},
            ${canalizacion.nota ?? ''}
          )
        `;
      }

      for (const asesoria of dataset.asesorias) {
        await tx`
          insert into servicio_asesoria (
            institucion_id, area, asignatura, modalidad, dia, horario, vigencia, estado, fuente, nota
          ) values (
            ${idInstitucion}, ${asesoria.area}, ${asesoria.asignatura ?? null},
            ${asesoria.modalidad ?? null}, ${asesoria.dia ?? null}, ${asesoria.horario ?? null},
            ${asesoria.vigencia ?? 'por_confirmar'}, ${asesoria.estado ?? 'por_validar'},
            'libro_casos', 'Horario simulado; no confirmado por ITTLA.'
          )
        `;
      }

      for (const solicitud of dataset.solicitudes) {
        const estudiante = idsEstudiantes.get(solicitud.id_anonimo);
        if (!estudiante) continue;
        await tx`
          insert into solicitud (estudiante_id, tipo, estado, area, nota)
          values (${estudiante.id}, ${solicitud.tipo}, ${solicitud.estado ?? 'pendiente'},
                  ${solicitud.area ?? 'por_confirmar'}, ${solicitud.nota ?? ''})
        `;
      }

      return idInstitucion;
    });

    // El semáforo se recalcula con las reglas cargadas, periodo por periodo.
    const versionReglas = reglasArchivo.version;
    for (const periodo of dataset.periodos) {
      const resumen = await recalcularPeriodo(sql, {
        institucionId,
        periodo: periodo.clave,
        version: versionReglas,
      });
      console.log(
        `Semáforo ${periodo.clave}: ${resumen.clasificados} clasificados, ` +
          `${resumen.informacion_insuficiente} con información insuficiente, ` +
          `${resumen.inconsistencias} inconsistentes.`,
      );
    }

    const etiquetados = await marcarRiesgoObservado(sql, institucionId);
    const alertasActivo = await recalcularAlertas(sql, periodoActivo);

    const admin = dataset.usuarios.find((usuario) => usuario.rol === 'admin_tecnico');
    const idAdmin = admin
      ? (await sql<{ id: number }[]>`select id from usuario where correo = ${admin.correo} limit 1`)[0]?.id
      : null;
    const entrenamiento = await registrarEntrenamiento(sql, {
      institucionId,
      usuarioId: idAdmin ?? null,
    });

    await sql`
      insert into bitacora (usuario_id, operacion, entidad, detalle)
      values (
        ${idAdmin ?? null}, 'semilla', 'dataset',
        ${sql.json({
          version: dataset.version,
          estudiantes: dataset.estudiantes.length,
          asignaturas: totalAsignaturas,
          parciales: totalParciales,
          periodos: dataset.periodos.length,
          etiquetados,
          alertas_activo: alertasActivo,
        })}
      )
    `;

    const metricas = entrenamiento.comparacion.metricas.arbol;
    const base = entrenamiento.comparacion.metricas.linea_base;
    console.log(
      `Modelo ${entrenamiento.tipo} ${entrenamiento.version}: ` +
        `exactitud ${metricas.exactitud} (${entrenamiento.registros_entrenamiento} entrenamiento / ` +
        `${entrenamiento.registros_prueba} prueba); línea base "${base.clase}" ${base.exactitud}.`,
    );
    if (entrenamiento.advertencia) console.log(`Advertencia: ${entrenamiento.advertencia}`);
    console.log(
      `Semilla lista. Periodo activo: ${periodoActivo}. Contraseña de las cuentas sembradas: ${contrasenaDemo}`,
    );
    console.log(
      `Cuentas sembradas: ${dataset.usuarios.map((usuario) => usuario.correo).join(', ')}. ` +
        'El acceso es con correo y contraseña; los endpoints de QA de demostración sólo responden con DEMO_MODE=true.',
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function vaciar(tx: Sql): Promise<void> {
  await tx`
    truncate table
      bitacora,
      consulta_rag,
      alerta,
      revision_ficha,
      accion_tutorial,
      intervencion_apoyo,
      sesion_tutorial,
      asignatura_resultado,
      evaluacion_parcial,
      curso_especial,
      evaluacion_riesgo,
      trayectoria_periodo,
      necesidad_apoyo,
      canalizacion,
      solicitud,
      estudiante,
      modelo_riesgo,
      documento_rag,
      fragmento_rag,
      servicio_asesoria,
      regla_semaforo,
      configuracion,
      catalogo_carrera,
      catalogo_grupo,
      periodo,
      usuario,
      institucion,
      limite_acceso
    restart identity cascade
  `;
}

function normalizarEstatusAcuerdo(valor: string | undefined): 'pendiente' | 'cumplido' | 'vencido' {
  const limpio = (valor ?? '').toLowerCase();
  if (limpio.includes('cumpl')) return 'cumplido';
  if (limpio.includes('venc')) return 'vencido';
  return 'pendiente';
}

function sumarDias(fecha: Date, dias: number): string {
  const copia = new Date(fecha);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia.toISOString().slice(0, 10);
}

async function leerJson<T>(ruta: string): Promise<T> {
  return JSON.parse(await readFile(ruta, 'utf8')) as T;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
