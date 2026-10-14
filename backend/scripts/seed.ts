import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { recalcularAlertas } from '../src/alertas/recalcular';
import { crearSql } from '../src/base-datos/conexion';
import { etiquetaRiesgo } from '../src/ml/etiqueta';
import { entrenarComparacion, mulberry32 } from '../src/ml/modelo';
import { evaluarSemaforo } from '../src/semaforo/semaforo';

const PASSWORD = 'Semaforo-demo-2026';
const PERIODO = '2026-1';
const TOTAL = 150;
const CARRERAS = ['Sistemas', 'Industrial', 'Administración', 'Mecatrónica'] as const;
const GRUPOS = ['GRP-A', 'GRP-B', 'GRP-C'] as const;

const MATERIAS: Record<(typeof CARRERAS)[number], Array<[string, string]>> = {
  Sistemas: [
    ['SIS-101', 'Programación'],
    ['SIS-204', 'Bases de datos'],
    ['SIS-308', 'Redes'],
    ['MAT-105', 'Matemáticas discretas'],
  ],
  Industrial: [
    ['IND-110', 'Estudio del trabajo'],
    ['IND-220', 'Investigación de operaciones'],
    ['IND-305', 'Gestión de calidad'],
    ['MAT-120', 'Estadística'],
  ],
  Administración: [
    ['ADM-101', 'Fundamentos de administración'],
    ['ADM-214', 'Costos'],
    ['ADM-330', 'Finanzas'],
    ['MAT-110', 'Matemáticas financieras'],
  ],
  Mecatrónica: [
    ['MEC-140', 'Circuitos'],
    ['MEC-250', 'Control'],
    ['MEC-360', 'Automatización'],
    ['MAT-130', 'Ecuaciones diferenciales'],
  ],
};

type Banda = 'verde' | 'amarillo' | 'rojo';

async function main() {
  const sql = crearSql();
  const hash = await bcrypt.hash(PASSWORD, 12);
  const rng = mulberry32(42);
  try {
    await sql.begin(async (tx) => {
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
          trayectoria_periodo,
          estudiante,
          modelo_riesgo,
          usuario
        restart identity cascade
      `;

      const cuentas = [
        ['tutor@ittla.demo', 'Tutor de GRP-A y GRP-B', 'tutor'],
        ['tutor.c@ittla.demo', 'Tutor de GRP-C', 'tutor'],
        ['coordinacion@ittla.demo', 'Coordinación de tutoría', 'coordinacion'],
        ['asesoria@ittla.demo', 'Asesoría de desarrollo académico', 'asesoria'],
        ['admin@ittla.demo', 'Administración técnica', 'admin_tecnico'],
      ] as const;
      for (const [correo, nombre, rol] of cuentas) {
        await tx`
          insert into usuario (correo, nombre, rol, hash_password)
          values (${correo}, ${nombre}, ${rol}, ${hash})
        `;
      }
      const usuarios = await tx<{ id: number; correo: string }[]>`select id, correo from usuario`;
      const idDe = (correo: string) => {
        const usuario = usuarios.find((fila) => fila.correo === correo);
        if (!usuario) throw new Error(`Falta la cuenta ${correo}`);
        return usuario.id;
      };
      const tutorAb = idDe('tutor@ittla.demo');
      const tutorC = idDe('tutor.c@ittla.demo');
      const asesoria = idDe('asesoria@ittla.demo');

      const filasModelo = [];
      for (let i = 1; i <= TOTAL; i += 1) {
        const banda: Banda = i % 20 < 8 ? 'verde' : i % 20 < 15 ? 'amarillo' : 'rojo';
        const grupo = GRUPOS[i % 3];
        const carrera = CARRERAS[i % CARRERAS.length];
        const semestre = 1 + Math.floor(rng() * 9);
        const indicadores = perfil(rng, banda, i);
        const semaforo = evaluarSemaforo(indicadores);
        if (semaforo.nivel !== banda) {
          throw new Error(`EST_${String(i).padStart(3, '0')} salió ${semaforo.nivel} y se esperaba ${banda}.`);
        }
        const riesgo = etiquetaRiesgo(indicadores);
        const creditosAprobados = Math.round(indicadores.avance_curricular * 2.1 * 10) / 10;
        const creditosPendientes = Math.max(0, Math.round((210 - creditosAprobados) * 10) / 10);
        const idAnonimo = `EST_${String(i).padStart(3, '0')}`;
        const tutorId = grupo === 'GRP-C' ? tutorC : tutorAb;
        const creados = await tx<{ id: number }[]>`
          insert into estudiante (
            id_anonimo, carrera, semestre, generacion, plan_estudios, modalidad, grupo,
            estatus_academico, tutor_id, fuente_sintetica, version_dataset, fecha_generacion
          ) values (
            ${idAnonimo}, ${carrera}, ${semestre}, ${String(2026 - semestre)},
            ${'Plan sintético ' + carrera}, 'Escolarizada', ${grupo},
            'inscrito', ${tutorId}, 'generado_sinteticamente', 'v1.0', current_date
          )
          returning id
        `;
        const estudianteId = creados[0]?.id;
        if (!estudianteId) throw new Error('No se insertó el estudiante.');
        await tx`
          insert into trayectoria_periodo (
            estudiante_id, periodo, creditos_aprobados, creditos_pendientes, promedio_periodo,
            materias_reprobadas, porcentaje_asistencia, avance_curricular, acuerdos_vencidos,
            puntos_alerta, nivel_alerta, riesgo_objetivo, senales, accion_sugerida
          ) values (
            ${estudianteId}, ${PERIODO}, ${creditosAprobados}, ${creditosPendientes}, ${indicadores.promedio_periodo},
            ${indicadores.materias_reprobadas}, ${indicadores.porcentaje_asistencia}, ${indicadores.avance_curricular},
            ${indicadores.acuerdos_vencidos}, ${semaforo.puntos}, ${semaforo.nivel}, ${riesgo},
            ${semaforo.senales}, ${semaforo.accion_sugerida}
          )
        `;
        const materias = MATERIAS[carrera];
        for (let m = 0; m < materias.length; m += 1) {
          const reprobada = m < indicadores.materias_reprobadas;
          const calificacion = reprobada ? 50 + Math.floor(rng() * 19) : 70 + Math.floor(rng() * 31);
          await tx`
            insert into asignatura_resultado (
              estudiante_id, periodo, clave_asignatura, nombre_asignatura, creditos, calificacion, resultado, oportunidad
            ) values (
              ${estudianteId}, ${PERIODO}, ${materias[m][0]}, ${materias[m][1]}, 5,
              ${calificacion}, ${reprobada ? 'reprobado' : 'aprobado'}, ${reprobada && rng() > 0.7 ? 2 : 1}
            )
          `;
        }
        if (indicadores.acuerdos_vencidos > 0) {
          for (let a = 0; a < indicadores.acuerdos_vencidos; a += 1) {
            await tx`
              insert into sesion_tutorial (
                estudiante_id, tutor_id, fecha_sesion, tipo_sesion, motivo, acuerdos, fecha_compromiso, estatus_acuerdo, observacion
              ) values (
                ${estudianteId}, ${tutorId}, ${iso(-40 - a * 7)}, 'seguimiento',
                'Revisión de indicadores académicos', 'Entregar evidencias del plan de trabajo',
                ${iso(-10 - a)}, 'vencido', 'Sin datos sensibles.'
              )
            `;
          }
        } else {
          await tx`
            insert into sesion_tutorial (
              estudiante_id, tutor_id, fecha_sesion, tipo_sesion, motivo, acuerdos, fecha_compromiso, estatus_acuerdo, observacion
            ) values (
              ${estudianteId}, ${tutorId}, ${iso(-15)}, 'seguimiento',
              'Acompañamiento ordinario del periodo', 'Mantener asistencia y entregas',
              ${iso(20)}, ${banda === 'verde' ? 'cumplido' : 'pendiente'}, 'Sin datos sensibles.'
            )
          `;
        }
        if (banda === 'rojo' || (banda === 'amarillo' && i % 4 === 0)) {
          const pronto = banda === 'rojo' ? i % 2 === 0 : true;
          await tx`
            insert into accion_tutorial (estudiante_id, tutor_id, tipo, fecha_compromiso, estatus, observacion)
            values (
              ${estudianteId}, ${tutorId},
              ${banda === 'rojo' ? 'entrevista_tutorial' : 'seguimiento'},
              ${iso(pronto ? 3 : 25)},
              'en_seguimiento',
              'Acción de prueba, sin datos personales.'
            )
          `;
        }
        if (banda === 'rojo' && i % 2 === 1) {
          await tx`
            insert into revision_ficha (estudiante_id, periodo, revisor_id, estatus, comentario)
            values (${estudianteId}, ${PERIODO}, ${asesoria}, 'aprobada', 'Revisión de prueba sobre datos sintéticos.')
          `;
        }
        if (banda === 'rojo' && i % 4 === 0) {
          await tx`
            insert into intervencion_apoyo (
              estudiante_id, tipo_apoyo, taller, area_responsable, fecha_inicio, resultado
            ) values (
              ${estudianteId}, 'asesoria', 'Taller de regularización', 'Desarrollo académico',
              ${iso(-20)}, 'en_curso'
            )
          `;
        }
        filasModelo.push({
          porcentaje_asistencia: indicadores.porcentaje_asistencia,
          promedio_periodo: indicadores.promedio_periodo,
          materias_reprobadas: indicadores.materias_reprobadas,
          creditos_aprobados: creditosAprobados,
          avance_curricular: indicadores.avance_curricular,
          acuerdos_vencidos: indicadores.acuerdos_vencidos,
          semestre,
          riesgo_objetivo: riesgo,
        });
      }

      await recalcularAlertas(tx, PERIODO);
      const comparacion = entrenarComparacion(filasModelo, 42);
      await tx`
        insert into modelo_riesgo (version, algoritmo, motivo, metricas, modelo)
        values (
          'arbol-semilla-v1',
          ${comparacion.algoritmo},
          ${comparacion.motivo},
          ${tx.json(comparacion.metricas)},
          ${tx.json(comparacion.modelo)}
        )
      `;
      await tx`
        insert into bitacora (usuario_id, operacion, entidad, detalle)
        values (${idDe('admin@ittla.demo')}, 'semilla', 'dataset', ${tx.json({ registros: TOTAL, periodo: PERIODO })})
      `;
    });
    console.log(`Semilla lista: ${TOTAL} tutorados sintéticos. Contraseña de demostración: ${PASSWORD}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function perfil(rng: () => number, banda: Banda, indice: number) {
  const entre = (min: number, max: number) => Math.round((min + rng() * (max - min)) * 10) / 10;
  if (banda === 'verde') {
    return {
      promedio_periodo: entre(82, 98),
      porcentaje_asistencia: entre(88, 100),
      materias_reprobadas: 0,
      avance_curricular: entre(58, 94),
      acuerdos_vencidos: 0,
    };
  }
  if (banda === 'amarillo') {
    const modo = indice % 3;
    if (modo === 0) {
      return {
        promedio_periodo: entre(82, 95),
        porcentaje_asistencia: entre(70, 79),
        materias_reprobadas: 0,
        avance_curricular: entre(60, 90),
        acuerdos_vencidos: 0,
      };
    }
    if (modo === 1) {
      return {
        promedio_periodo: entre(60, 69),
        porcentaje_asistencia: entre(85, 98),
        materias_reprobadas: 0,
        avance_curricular: entre(60, 90),
        acuerdos_vencidos: 0,
      };
    }
    return {
      promedio_periodo: entre(80, 92),
      porcentaje_asistencia: entre(88, 99),
      materias_reprobadas: 1,
      avance_curricular: entre(30, 49),
      acuerdos_vencidos: 2,
    };
  }
  return {
    promedio_periodo: entre(55, 68),
    porcentaje_asistencia: entre(55, 74),
    materias_reprobadas: 3 + (indice % 2),
    avance_curricular: entre(22, 47),
    acuerdos_vencidos: 2,
  };
}

function iso(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
