import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ErrorApi, api, mensajeError } from '../api';
import { useSesion } from '../auth';
import { Cargando, Fallo } from '../components/Estados';
import { CabeceraTarjeta, EncabezadoPagina } from '../components/Pagina';
import { Semaforo } from '../components/Semaforo';
import { periodoValido, useContexto } from '../contexto';
import {
  ETIQUETA_ACCION,
  ETIQUETA_ACUERDO,
  ETIQUETA_ALGORITMO,
  ETIQUETA_ESTADO_DATOS,
  ETIQUETA_ESTATUS_ACCION,
  ETIQUETA_FUENTE,
  ETIQUETA_RESULTADO,
  ETIQUETA_REVISION,
  ETIQUETA_RIESGO,
  ETIQUETA_TIPO_APOYO,
  decimal,
  entero,
  etiqueta,
  etiquetaTipoModelo,
  fechaLegible,
  type Nivel,
} from '../texto';

type ReglaActivada = {
  codigo: string;
  titulo: string;
  nivel: Nivel;
  prioridad?: number | null;
  accion: string;
  detalle?: string | null;
};

type CoberturaDatos = {
  porcentaje?: number | null;
  faltantes?: string[];
  inconsistencias?: string[];
  asignaturas_referencia?: number | null;
  asignaturas_esperadas?: number | null;
};

type ModeloFicha = {
  disponible: boolean;
  tipo?: string | null;
  version?: string | null;
  algoritmo?: string | null;
  motivo?: string | null;
  etiqueta_definicion?: string | null;
  registros_entrenamiento?: number | null;
  registros_prueba?: number | null;
  entrenado_en?: string | null;
  advertencia?: string | null;
  riesgo?: string | null;
  probabilidad?: number | null;
  reglas?: string[];
  leyenda?: string | null;
};

type FichaDatos = {
  institucion?: { clave: string; nombre: string; nombre_corto: string } | null;
  periodo_activo?: string | null;
  estudiante: {
    id_anonimo: string;
    carrera: string;
    semestre: number;
    generacion: string;
    grupo: string;
    modalidad: string;
    plan_estudios: string;
    fuente_sintetica: string;
    tutor?: string | null;
  };
  trayectoria: {
    periodo: string;
    periodo_referencia?: string | null;
    estado_datos: string;
    version_reglas?: string | null;
    promedio_periodo: number | null;
    porcentaje_asistencia: number | null;
    materias_reprobadas: number | null;
    avance_curricular: number | null;
    acuerdos_vencidos: number | null;
    creditos_aprobados: number | null;
    puntos_alerta: number | null;
    nivel_alerta: Nivel;
    senales: string[];
    reglas_activadas?: ReglaActivada[];
    cobertura_datos?: CoberturaDatos | null;
    accion_sugerida: string;
  };
  asignaturas: Array<{
    clave_asignatura: string;
    nombre_asignatura: string;
    calificacion: number | null;
    resultado: string;
  }>;
  parciales?: Array<{
    clave_asignatura: string;
    numero: number;
    calificacion: number | null;
    exigible: boolean;
    acreditada: boolean | null;
    fuente?: string | null;
  }>;
  curso_especial?: Array<{
    clave_asignatura: string;
    nombre_asignatura?: string | null;
    registrado: boolean;
    fuente?: string | null;
  }>;
  sesiones: Array<{
    fecha_sesion: string;
    motivo: string;
    estatus_acuerdo: string;
    acuerdos: string;
  }>;
  acciones: Array<{
    id: number | string;
    tipo: string;
    fecha_compromiso: string;
    estatus: string;
    observacion: string;
  }>;
  intervenciones: Array<{
    tipo_apoyo: string;
    taller: string | null;
    area_responsable: string;
    fecha_inicio: string;
    resultado: string | null;
  }>;
  revisiones: Array<{ estatus: string; comentario: string; creado_en: string }>;
  modelo: ModeloFicha;
};

type TipoFormulario = 'accion' | 'revision';
type EstatusCierre = 'cumplida' | 'vencida' | 'cancelada';

const TIPOS = Object.entries(ETIQUETA_ACCION);
const ESTATUS_CIERRE: EstatusCierre[] = ['cumplida', 'vencida', 'cancelada'];

export function Ficha() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { usuario } = useSesion();
  const { contexto, error: errorContexto } = useContexto();
  const periodo = periodoValido(contexto, params.get('periodo'));
  const catalogoListo = Boolean(contexto) || Boolean(errorContexto);
  const volverAlListado = periodo
    ? `/estudiantes?periodo=${encodeURIComponent(periodo)}`
    : '/estudiantes';
  const [datos, setDatos] = useState<FichaDatos | null>(null);
  const [error, setError] = useState('');
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [intento, setIntento] = useState(0);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [accionCerrando, setAccionCerrando] = useState<number | string | null>(null);
  const [estatusCierre, setEstatusCierre] = useState<EstatusCierre>('cumplida');
  const [observacionCierre, setObservacionCierre] = useState('');
  const [cerrandoAccion, setCerrandoAccion] = useState(false);
  const refFecha = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catalogoListo) return;
    let vivo = true;
    setDatos(null);
    setError('');
    setNoEncontrada(false);
    const consulta = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
    api<FichaDatos>(`/api/tutorados/${encodeURIComponent(id)}${consulta}`)
      .then((respuesta) => {
        if (vivo) setDatos(respuesta);
      })
      .catch((causa: unknown) => {
        if (!vivo) return;
        if (causa instanceof ErrorApi && causa.status === 404) {
          setNoEncontrada(true);
          setError('No encontramos esa ficha.');
          return;
        }
        setError(mensajeError(causa, 'No se pudo abrir la ficha.'));
      });
    return () => {
      vivo = false;
    };
  }, [id, periodo, catalogoListo, intento]);

  async function enviar(evento: FormEvent<HTMLFormElement>, ruta: string, tipo: TipoFormulario) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const cuerpo = Object.fromEntries(new FormData(formulario).entries()) as Record<string, string>;
    const nuevos: Record<string, string> = {};
    if (tipo === 'accion') {
      if (!cuerpo.tipo) nuevos.tipo = 'Elige el tipo de acción.';
      if (!cuerpo.fecha_compromiso) {
        nuevos.fecha_compromiso = 'Elige una fecha de compromiso.';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha_compromiso)) {
        nuevos.fecha_compromiso = 'Escribe una fecha válida.';
      }
    } else if (!cuerpo.estatus) {
      nuevos.estatus = 'Elige el estatus de la revisión.';
    }

    setErrores(nuevos);
    if (nuevos.fecha_compromiso) refFecha.current?.focus();
    if (Object.keys(nuevos).length > 0) return;

    setEnviando(true);
    setMensaje(null);
    try {
      await api(ruta, { method: 'POST', body: JSON.stringify(cuerpo) });
      formulario.reset();
      setMensaje({ tipo: 'ok', texto: 'Registro guardado.' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setMensaje({
        tipo: 'error',
        texto: mensajeError(causa, 'No se pudo guardar. Intenta de nuevo.'),
      });
    } finally {
      setEnviando(false);
    }
  }

  async function cerrarAccion(accionId: number | string) {
    setCerrandoAccion(true);
    setMensaje(null);
    try {
      await api(
        `/api/tutorados/${encodeURIComponent(id)}/acciones/${encodeURIComponent(String(accionId))}/cerrar`,
        {
          method: 'POST',
          body: JSON.stringify({
            estatus: estatusCierre,
            observacion: observacionCierre.trim(),
          }),
        },
      );
      setAccionCerrando(null);
      setObservacionCierre('');
      setMensaje({ tipo: 'ok', texto: 'Acción cerrada.' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setMensaje({
        tipo: 'error',
        texto: mensajeError(causa, 'No se pudo cerrar la acción.'),
      });
    } finally {
      setCerrandoAccion(false);
    }
  }

  if (noEncontrada) {
    return (
      <>
        <EncabezadoPagina titulo="Ficha no encontrada" volver={{ to: volverAlListado, texto: 'Estudiantes' }} />
        <div className="tarjeta estado-vacio-tarjeta">
          <h2>No encontramos esa ficha</h2>
          <p>El identificador puede haber cambiado o no pertenecer a tus grupos asignados.</p>
          <p>
            <Link className="boton boton-secundario" to={volverAlListado}>
              Volver al listado
            </Link>
          </p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <EncabezadoPagina titulo="Ficha" volver={{ to: volverAlListado, texto: 'Estudiantes' }} />
        <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />
      </>
    );
  }

  if (!datos) return <Cargando texto="Abriendo ficha…" />;

  const t = datos.trayectoria;
  const reglas = t.reglas_activadas ?? [];
  const modelo = datos.modelo;
  const probabilidad = modelo.probabilidad;
  const cobertura = t.cobertura_datos ?? null;
  const faltantes = cobertura?.faltantes ?? [];
  const inconsistencias = cobertura?.inconsistencias ?? [];
  const mostrarCobertura =
    t.estado_datos !== 'clasificado' || faltantes.length > 0 || inconsistencias.length > 0;
  const subtitulo = `${datos.estudiante.carrera} · Semestre ${datos.estudiante.semestre} · ${datos.estudiante.grupo} · Periodo ${t.periodo}`;

  return (
    <>
      <EncabezadoPagina
        titulo={datos.estudiante.id_anonimo}
        subtitulo={subtitulo}
        volver={{ to: volverAlListado, texto: 'Estudiantes' }}
        acciones={
          <div className="badges-ficha">
            <Semaforo nivel={t.nivel_alerta} />
            <span className="badge badge-neutro">
              {etiqueta(ETIQUETA_ESTADO_DATOS, t.estado_datos)}
            </span>
            {t.version_reglas ? <span className="nota">Reglas {t.version_reglas}</span> : null}
          </div>
        }
      />

      {mensaje ? (
        <p
          className={mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}
          role={mensaje.tipo === 'ok' ? 'status' : 'alert'}
        >
          {mensaje.texto}
        </p>
      ) : null}

      <div className="ficha-grid">
        <section className="tarjeta">
          <CabeceraTarjeta titulo="Indicadores" detalle={`Tutor: ${datos.estudiante.tutor ?? '—'}`} />
          <dl className="datos-grid">
            <div>
              <dt>Promedio</dt>
              <dd>{decimal(t.promedio_periodo)}</dd>
            </div>
            <div>
              <dt>Asistencia</dt>
              <dd>{decimal(t.porcentaje_asistencia)}%</dd>
            </div>
            <div>
              <dt>Reprobadas</dt>
              <dd>{entero(t.materias_reprobadas)}</dd>
            </div>
            <div>
              <dt>Avance</dt>
              <dd>{decimal(t.avance_curricular)}%</dd>
            </div>
            <div>
              <dt>Acuerdos vencidos</dt>
              <dd>{entero(t.acuerdos_vencidos)}</dd>
            </div>
            <div>
              <dt>Créditos aprobados</dt>
              <dd>{decimal(t.creditos_aprobados)}</dd>
            </div>
            <div>
              <dt>Reglas</dt>
              <dd>{reglas.length}</dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>{t.periodo_referencia ?? '—'}</dd>
            </div>
          </dl>
          {mostrarCobertura ? (
            <details className="detalle-tecnico">
              <summary>Cobertura de datos ({decimal(cobertura?.porcentaje)}%)</summary>
              <p className="nota">
                Asignaturas de referencia {entero(cobertura?.asignaturas_referencia)} de{' '}
                {entero(cobertura?.asignaturas_esperadas)}.
              </p>
              {faltantes.length ? (
                <>
                  <h3 className="subtitulo-bloque">Datos faltantes</h3>
                  <ul className="lista-simple">
                    {faltantes.map((item, indice) => (
                      <li key={`${indice}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {inconsistencias.length ? (
                <>
                  <h3 className="subtitulo-bloque">Inconsistencias</h3>
                  <ul className="lista-simple">
                    {inconsistencias.map((item, indice) => (
                      <li key={`${indice}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </details>
          ) : null}
        </section>

        <section className="tarjeta">
          <CabeceraTarjeta titulo="Reglas activadas" />
          {reglas.length === 0 ? (
            <p className="estado-vacio">Sin reglas activadas para este periodo.</p>
          ) : (
            <ul className="reglas-lista">
              {reglas.map((regla, indice) => (
                <li key={`${regla.codigo}-${indice}`}>
                  <div className="regla-linea">
                    <span className="chip">{regla.codigo}</span>
                    <strong>{regla.titulo}</strong>
                    <Semaforo nivel={regla.nivel} />
                  </div>
                  <p className="nota">{regla.accion}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta ficha-ancha">
          <CabeceraTarjeta titulo="Sugerencia de apoyo" />
          {!modelo.disponible ? (
            <p className="estado-vacio">Sin sugerencia disponible.</p>
          ) : (
            <>
              <div className="sugerencia-linea">
                <span className="badge badge-info">{etiquetaTipoModelo(modelo.tipo)}</span>
                {modelo.riesgo ? (
                  <span className={`badge badge-riesgo-${modelo.riesgo}`}>
                    Riesgo {etiqueta(ETIQUETA_RIESGO, modelo.riesgo)}
                  </span>
                ) : null}
                <span className="sugerencia-probabilidad">
                  <strong>
                    {probabilidad === null || probabilidad === undefined
                      ? '—'
                      : `${decimal(probabilidad * 100)}%`}
                  </strong>
                  {' '}
                  <span>probabilidad</span>
                </span>
              </div>
              <p className="nota">
                {modelo.algoritmo
                  ? etiqueta(ETIQUETA_ALGORITMO, modelo.algoritmo)
                  : 'Modelo de apoyo'}
                {modelo.version ? ` · ${modelo.version}` : ''}
              </p>
              <details className="detalle-tecnico">
                <summary>Reglas del modelo</summary>
                {(modelo.reglas ?? []).length ? (
                  <ul className="lista-simple">
                    {(modelo.reglas ?? []).map((regla, indice) => (
                      <li key={`${indice}-${regla}`}>{regla}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="nota">Sin reglas del modelo.</p>
                )}
                {modelo.advertencia ? <p className="nota">{modelo.advertencia}</p> : null}
              </details>
            </>
          )}
        </section>

        <section className="tarjeta ficha-ancha">
          <CabeceraTarjeta titulo="Seguimiento" />
          {datos.acciones.length === 0 ? (
            <p className="estado-vacio">Sin acciones registradas.</p>
          ) : (
            <ul className="acciones-lista">
              {datos.acciones.map((accion) => (
                <li key={accion.id}>
                  <div className="accion-linea">
                    <span>{etiqueta(ETIQUETA_ACCION, accion.tipo)}</span>
                    <span className="nota">{fechaLegible(accion.fecha_compromiso)}</span>
                    <span className={`badge badge-estatus`}>
                      {etiqueta(ETIQUETA_ESTATUS_ACCION, accion.estatus)}
                    </span>
                    {usuario?.rol === 'tutor' && accion.estatus === 'en_seguimiento' ? (
                      accionCerrando === accion.id ? (
                        <span className="cierre-inline">
                          <select
                            value={estatusCierre}
                            onChange={(evento) =>
                              setEstatusCierre(evento.target.value as EstatusCierre)
                            }
                            disabled={cerrandoAccion}
                            aria-label="Resultado del cierre"
                          >
                            {ESTATUS_CIERRE.map((valor) => (
                              <option key={valor} value={valor}>
                                {etiqueta(ETIQUETA_ESTATUS_ACCION, valor)}
                              </option>
                            ))}
                          </select>
                          <input
                            value={observacionCierre}
                            maxLength={500}
                            placeholder="Observación (opcional)"
                            onChange={(evento) => setObservacionCierre(evento.target.value)}
                            disabled={cerrandoAccion}
                            aria-label="Observación del cierre"
                          />
                          <button
                            type="button"
                            className="boton boton-pequeno"
                            onClick={() => void cerrarAccion(accion.id)}
                            disabled={cerrandoAccion}
                            aria-busy={cerrandoAccion}
                          >
                            {cerrandoAccion ? 'Cerrando…' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            className="boton boton-secundario boton-pequeno"
                            onClick={() => setAccionCerrando(null)}
                            disabled={cerrandoAccion}
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="boton boton-secundario boton-pequeno"
                          onClick={() => {
                            setAccionCerrando(accion.id);
                            setEstatusCierre('cumplida');
                            setObservacionCierre('');
                            setMensaje(null);
                          }}
                        >
                          Cerrar acción
                        </button>
                      )
                    ) : null}
                  </div>
                  {accion.observacion ? <p className="nota">{accion.observacion}</p> : null}
                </li>
              ))}
            </ul>
          )}

          {usuario?.rol === 'tutor' ? (
            <details className="form-detalle">
              <summary>Registrar acción</summary>
              <form
                className="formulario"
                onSubmit={(evento) =>
                  void enviar(
                    evento,
                    `/api/tutorados/${encodeURIComponent(id)}/acciones`,
                    'accion',
                  )
                }
                noValidate
              >
                <div className="campo">
                  <label htmlFor="accion-tipo">Tipo</label>
                  <select
                    id="accion-tipo"
                    name="tipo"
                    defaultValue="entrevista_tutorial"
                    aria-invalid={Boolean(errores.tipo)}
                  >
                    {TIPOS.map(([valor, nombre]) => (
                      <option key={valor} value={valor}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                  {errores.tipo ? (
                    <p className="campo-error" role="alert">
                      {errores.tipo}
                    </p>
                  ) : null}
                </div>
                <div className="campo">
                  <label htmlFor="accion-fecha">Fecha de compromiso</label>
                  <input
                    ref={refFecha}
                    id="accion-fecha"
                    name="fecha_compromiso"
                    type="date"
                    aria-invalid={Boolean(errores.fecha_compromiso)}
                    aria-describedby={errores.fecha_compromiso ? 'error-accion-fecha' : undefined}
                  />
                  {errores.fecha_compromiso ? (
                    <p className="campo-error" id="error-accion-fecha" role="alert">
                      {errores.fecha_compromiso}
                    </p>
                  ) : null}
                </div>
                <div className="campo">
                  <label htmlFor="accion-observacion">Observación</label>
                  <textarea id="accion-observacion" name="observacion" maxLength={500} rows={2} />
                </div>
                <button className="boton" type="submit" disabled={enviando} aria-busy={enviando}>
                  {enviando ? 'Guardando…' : 'Guardar acción'}
                </button>
              </form>
            </details>
          ) : null}

          {usuario?.rol === 'asesoria' ? (
            <details className="form-detalle">
              <summary>Registrar revisión</summary>
              <form
                className="formulario"
                onSubmit={(evento) =>
                  void enviar(
                    evento,
                    `/api/tutorados/${encodeURIComponent(id)}/revisiones`,
                    'revision',
                  )
                }
                noValidate
              >
                <div className="campo">
                  <label htmlFor="revision-estatus">Estatus</label>
                  <select
                    id="revision-estatus"
                    name="estatus"
                    defaultValue="aprobada"
                    aria-invalid={Boolean(errores.estatus)}
                  >
                    {Object.entries(ETIQUETA_REVISION).map(([valor, nombre]) => (
                      <option key={valor} value={valor}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                  {errores.estatus ? (
                    <p className="campo-error" role="alert">
                      {errores.estatus}
                    </p>
                  ) : null}
                </div>
                <div className="campo">
                  <label htmlFor="revision-comentario">Comentario</label>
                  <textarea
                    id="revision-comentario"
                    name="comentario"
                    maxLength={500}
                    rows={2}
                  />
                </div>
                <button className="boton" type="submit" disabled={enviando} aria-busy={enviando}>
                  {enviando ? 'Guardando…' : 'Guardar revisión'}
                </button>
              </form>
            </details>
          ) : null}
        </section>

        <section className="tarjeta ficha-ancha">
          <CabeceraTarjeta
            titulo="Historial"
            detalle={`Periodo ${t.periodo}`}
          />
          <div className="historial">
            <details className="detalle-tecnico">
              <summary>Asignaturas ({datos.asignaturas.length})</summary>
              {datos.asignaturas.length === 0 ? (
                <p className="estado-vacio">Sin asignaturas registradas.</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th scope="col">Clave</th>
                        <th scope="col">Asignatura</th>
                        <th scope="col">Calificación</th>
                        <th scope="col">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.asignaturas.map((fila) => (
                        <tr key={fila.clave_asignatura}>
                          <td>{fila.clave_asignatura}</td>
                          <td>{fila.nombre_asignatura}</td>
                          <td>{decimal(fila.calificacion)}</td>
                          <td>{etiqueta(ETIQUETA_RESULTADO, fila.resultado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>

            <details className="detalle-tecnico">
              <summary>Evaluaciones parciales ({datos.parciales?.length ?? 0})</summary>
              {(datos.parciales?.length ?? 0) === 0 ? (
                <p className="estado-vacio">Sin evaluaciones parciales registradas.</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th scope="col">Asignatura</th>
                        <th scope="col">Parcial</th>
                        <th scope="col">Calificación</th>
                        <th scope="col">Exigible</th>
                        <th scope="col">Acreditada</th>
                        <th scope="col">Fuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.parciales?.map((fila, indice) => (
                        <tr key={`${fila.clave_asignatura}-${fila.numero}-${indice}`}>
                          <td>{fila.clave_asignatura}</td>
                          <td>{fila.numero}</td>
                          <td>{decimal(fila.calificacion)}</td>
                          <td>{fila.exigible ? 'Sí' : 'No'}</td>
                          <td>
                            {fila.acreditada === null
                              ? 'Sin registro'
                              : fila.acreditada
                                ? 'Sí'
                                : 'No'}
                          </td>
                          <td>{etiqueta(ETIQUETA_FUENTE, fila.fuente, '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>

            {(datos.curso_especial?.length ?? 0) > 0 ? (
              <details className="detalle-tecnico">
                <summary>Curso especial ({datos.curso_especial?.length})</summary>
                <ul className="lista-simple">
                  {datos.curso_especial?.map((fila, indice) => (
                    <li key={`${fila.clave_asignatura}-${indice}`}>
                      {fila.clave_asignatura}
                      {fila.nombre_asignatura ? ` · ${fila.nombre_asignatura}` : ''} ·{' '}
                      {fila.registrado ? 'Registrado' : 'No registrado'}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <details className="detalle-tecnico">
              <summary>Acuerdos de sesiones ({datos.sesiones.length})</summary>
              {datos.sesiones.length === 0 ? (
                <p className="estado-vacio">Sin sesiones registradas.</p>
              ) : (
                <ul className="lista-simple">
                  {datos.sesiones.map((sesion, indice) => (
                    <li key={`${sesion.fecha_sesion}-${indice}`}>
                      <span className="nota">{fechaLegible(sesion.fecha_sesion)}</span>{' '}
                      {etiqueta(ETIQUETA_ACUERDO, sesion.estatus_acuerdo)} · {sesion.acuerdos}
                    </li>
                  ))}
                </ul>
              )}
            </details>

            {datos.intervenciones.length > 0 ? (
              <details className="detalle-tecnico">
                <summary>Apoyos registrados ({datos.intervenciones.length})</summary>
                <ul className="lista-simple">
                  {datos.intervenciones.map((item, indice) => (
                    <li key={`${item.fecha_inicio}-${indice}`}>
                      {etiqueta(ETIQUETA_TIPO_APOYO, item.tipo_apoyo)}
                      {item.taller ? ` · ${item.taller}` : ''} · {item.area_responsable} ·{' '}
                      {fechaLegible(item.fecha_inicio)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {datos.revisiones.length > 0 ? (
              <details className="detalle-tecnico">
                <summary>Revisiones ({datos.revisiones.length})</summary>
                <ul className="lista-simple">
                  {datos.revisiones.map((revision, indice) => (
                    <li key={`${revision.creado_en}-${indice}`}>
                      {etiqueta(ETIQUETA_REVISION, revision.estatus)} ·{' '}
                      {fechaLegible(revision.creado_en)}
                      {revision.comentario ? ` · ${revision.comentario}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
