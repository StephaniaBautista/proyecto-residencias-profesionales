import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useSesion } from '../auth';
import { Cargando, Fallo } from '../components/Estados';
import { Semaforo } from '../components/Semaforo';
import {
  ETIQUETA_ACCION,
  ETIQUETA_REVISION,
  ETIQUETA_RIESGO,
  decimal,
  fechaLegible,
  type Nivel,
} from '../texto';

type FichaDatos = {
  estudiante: {
    id_anonimo: string;
    carrera: string;
    semestre: number;
    generacion: string;
    grupo: string;
    modalidad: string;
    plan_estudios: string;
    fuente_sintetica: string;
  };
  trayectoria: {
    promedio_periodo: number;
    porcentaje_asistencia: number;
    materias_reprobadas: number;
    avance_curricular: number;
    acuerdos_vencidos: number;
    creditos_aprobados: number;
    creditos_pendientes: number;
    puntos_alerta: number;
    nivel_alerta: Nivel;
    senales: string[];
    accion_sugerida: string;
  };
  asignaturas: Array<{ clave_asignatura: string; nombre_asignatura: string; calificacion: number; resultado: string }>;
  sesiones: Array<{ fecha_sesion: string; motivo: string; estatus_acuerdo: string; acuerdos: string }>;
  acciones: Array<{ id: number; tipo: string; fecha_compromiso: string; estatus: string; observacion: string }>;
  intervenciones: Array<{ tipo_apoyo: string; taller: string | null; area_responsable: string; fecha_inicio: string; resultado: string | null }>;
  revisiones: Array<{ estatus: string; comentario: string; creado_en: string }>;
  modelo: {
    disponible: boolean;
    riesgo?: string;
    probabilidad?: number;
    reglas?: string[];
    leyenda: string;
  };
  aviso: string;
};

const TIPOS = Object.entries(ETIQUETA_ACCION);

export function Ficha() {
  const { id = '' } = useParams();
  const { usuario } = useSesion();
  const [datos, setDatos] = useState<FichaDatos | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    setError('');
    api<FichaDatos>(`/api/tutorados/${id}`)
      .then((respuesta) => {
        if (vivo) setDatos(respuesta);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(causa instanceof Error ? causa.message : 'No se pudo abrir la ficha.');
      });
    return () => {
      vivo = false;
    };
  }, [id, intento]);

  async function enviar(evento: FormEvent<HTMLFormElement>, ruta: string) {
    evento.preventDefault();
    setEnviando(true);
    setMensaje('');
    const formulario = evento.currentTarget;
    const cuerpo = Object.fromEntries(new FormData(formulario).entries());
    try {
      await api(ruta, { method: 'POST', body: JSON.stringify(cuerpo) });
      formulario.reset();
      setMensaje('Quedó registrado.');
      setIntento((n) => n + 1);
    } catch (causa) {
      setMensaje(causa instanceof Error ? causa.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  if (error) return <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />;
  if (!datos) return <Cargando texto="Abriendo la ficha…" />;

  const t = datos.trayectoria;
  return (
    <>
      <p>
        <Link to="/tutorados">Volver al listado</Link>
      </p>
      <header className="ficha-cabecera subida">
        <div>
          <h1>{datos.estudiante.id_anonimo}</h1>
          <p className="meta">
            <span>{datos.estudiante.carrera}</span>
            <span>Semestre {datos.estudiante.semestre}</span>
            <span>{datos.estudiante.grupo}</span>
            <span>Generación {datos.estudiante.generacion}</span>
            <span>{datos.estudiante.fuente_sintetica}</span>
          </p>
        </div>
        <Semaforo nivel={t.nivel_alerta} />
      </header>
      <p className="aviso neutro">{datos.aviso}</p>

      <div className="dos-columnas subida">
        <section className="bloque">
          <h2>Indicadores del periodo</h2>
          <div className="tabla-contenedor">
            <table>
              <tbody>
                <tr><th>Promedio</th><td>{decimal(t.promedio_periodo)}</td></tr>
                <tr><th>Asistencia</th><td>{decimal(t.porcentaje_asistencia)}%</td></tr>
                <tr><th>Materias reprobadas</th><td>{t.materias_reprobadas}</td></tr>
                <tr><th>Avance curricular</th><td>{decimal(t.avance_curricular)}%</td></tr>
                <tr><th>Acuerdos vencidos</th><td>{t.acuerdos_vencidos}</td></tr>
                <tr><th>Créditos aprobados</th><td>{decimal(t.creditos_aprobados)}</td></tr>
                <tr><th>Puntos de la regla</th><td>{t.puntos_alerta}</td></tr>
              </tbody>
            </table>
          </div>
          <h3>Señales que activaron el color</h3>
          {t.senales.length ? (
            <ul className="lista-senales">
              {t.senales.map((senal) => (
                <li key={senal}>{senal}</li>
              ))}
            </ul>
          ) : (
            <p>Ninguna señal activa.</p>
          )}
          <p><strong>Acción sugerida por la regla: </strong>{t.accion_sugerida}</p>
        </section>
        <section className="bloque">
          <h2>Sugerencia del modelo</h2>
          {datos.modelo.disponible ? (
            <>
              <p>Riesgo {ETIQUETA_RIESGO[datos.modelo.riesgo ?? ''] ?? datos.modelo.riesgo}, probabilidad {decimal((datos.modelo.probabilidad ?? 0) * 100)}%.</p>
              <ul className="lista-senales">
                {(datos.modelo.reglas ?? []).map((regla) => (
                  <li key={regla}>{regla}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>El modelo todavía no está entrenado.</p>
          )}
          <p className="aviso neutro">{datos.modelo.leyenda}</p>
          <p>
            <Link to={`/consulta?tutorado=${datos.estudiante.id_anonimo}`}>Consultar la norma para este caso</Link>
          </p>
        </section>
      </div>

      <section className="bloque">
        <h2>Asignaturas</h2>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr><th>Clave</th><th>Asignatura</th><th>Calificación</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              {datos.asignaturas.map((fila) => (
                <tr key={fila.clave_asignatura}>
                  <td>{fila.clave_asignatura}</td>
                  <td>{fila.nombre_asignatura}</td>
                  <td>{decimal(fila.calificacion)}</td>
                  <td>{fila.resultado === 'aprobado' ? 'Aprobado' : 'Reprobado'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bloque">
        <h2>Seguimiento</h2>
        {datos.acciones.length === 0 ? <p>Sin acciones registradas.</p> : (
          <ul className="lista-senales">
            {datos.acciones.map((accion) => (
              <li key={accion.id}>
                {ETIQUETA_ACCION[accion.tipo] ?? accion.tipo} · {fechaLegible(accion.fecha_compromiso)} · {accion.estatus}
                {accion.observacion ? ` · ${accion.observacion}` : ''}
              </li>
            ))}
          </ul>
        )}
        {datos.sesiones.length > 0 ? (
          <ul className="lista-senales">
            {datos.sesiones.map((sesion) => (
              <li key={`${sesion.fecha_sesion}-${sesion.estatus_acuerdo}`}>
                {fechaLegible(sesion.fecha_sesion)} · {sesion.estatus_acuerdo} · {sesion.acuerdos}
              </li>
            ))}
          </ul>
        ) : null}
        {datos.intervenciones.length > 0 ? (
          <ul className="lista-senales">
            {datos.intervenciones.map((item) => (
              <li key={`${item.fecha_inicio}-${item.tipo_apoyo}`}>
                {item.taller || item.tipo_apoyo} · {item.area_responsable} · {fechaLegible(item.fecha_inicio)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {usuario?.rol === 'tutor' ? (
        <form className="formulario" onSubmit={(evento) => void enviar(evento, `/api/tutorados/${id}/acciones`)}>
          <h2>Registrar acción</h2>
          <label className="campo">
            <span>Tipo</span>
            <select name="tipo" required defaultValue="entrevista_tutorial">
              {TIPOS.map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Fecha de compromiso</span>
            <input name="fecha_compromiso" type="date" required />
          </label>
          <label className="campo">
            <span>Observación académica, sin datos sensibles</span>
            <textarea name="observacion" maxLength={500} />
          </label>
          <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar acción'}</button>
        </form>
      ) : null}

      {usuario?.rol === 'asesoria' ? (
        <form className="formulario" onSubmit={(evento) => void enviar(evento, `/api/tutorados/${id}/revisiones`)}>
          <h2>Revisión de asesoría</h2>
          <label className="campo">
            <span>Estatus</span>
            <select name="estatus" required defaultValue="aprobada">
              {Object.entries(ETIQUETA_REVISION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Comentario</span>
            <textarea name="comentario" maxLength={500} />
          </label>
          <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar revisión'}</button>
        </form>
      ) : null}

      {datos.revisiones.length > 0 ? (
        <section className="bloque">
          <h2>Revisiones</h2>
          <ul className="lista-senales">
            {datos.revisiones.map((revision) => (
              <li key={revision.creado_en}>
                {ETIQUETA_REVISION[revision.estatus] ?? revision.estatus} · {fechaLegible(revision.creado_en)}
                {revision.comentario ? ` · ${revision.comentario}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {mensaje ? <p className={mensaje === 'Quedó registrado.' ? 'aviso ok' : 'aviso'} role="status">{mensaje}</p> : null}
    </>
  );
}
