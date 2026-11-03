import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensajeError } from '../api';
import { Cargando, Fallo } from '../components/Estados';
import { EncabezadoPagina, CabeceraTarjeta } from '../components/Pagina';
import { Semaforo } from '../components/Semaforo';
import {
  grupoValido,
  periodoValido,
  useContexto,
  type Grupo,
  type PeriodoAcademico,
} from '../contexto';
import {
  ETIQUETA_ACCION,
  ETIQUETA_SENAL_CORTA,
  NIVELES,
  etiqueta,
  fechaLegible,
  type Nivel,
} from '../texto';

type ReglaActivada = { codigo: string; titulo: string; nivel: Nivel };

type CasoTablero = {
  id_anonimo: string;
  grupo: string;
  carrera: string;
  semestre: number;
  nivel_alerta: Nivel;
  estado_datos?: string;
  puntos?: number;
  senales: string[];
  reglas_activadas?: ReglaActivada[];
};

type TableroDatos = {
  conteos: Partial<Record<Nivel, number>>;
  casos: CasoTablero[];
  casos_total?: number;
  alertas_pendientes?: number;
  grupos?: Grupo[];
  proximas_revisiones: Array<{
    id_anonimo: string;
    tipo: string;
    fecha_compromiso: string | null;
    estatus: string;
  }>;
  proximas_total?: number;
};

export function Inicio() {
  const [params, setParams] = useSearchParams();
  const { contexto, error: errorContexto, recargar } = useContexto();
  const periodo = periodoValido(contexto, params.get('periodo'));
  const grupo = grupoValido(contexto, params.get('grupo'));
  const [datos, setDatos] = useState<TableroDatos | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!periodo) return;
    let vivo = true;
    setDatos(null);
    setError('');
    const consulta = new URLSearchParams({ periodo });
    if (grupo) consulta.set('grupo', grupo);
    api<TableroDatos>(`/api/tablero?${consulta.toString()}`)
      .then((respuesta) => {
        if (vivo) setDatos(respuesta);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(mensajeError(causa, 'No se pudo cargar el inicio.'));
      });
    return () => {
      vivo = false;
    };
  }, [periodo, grupo, intento]);

  function aplicarFiltro(siguientePeriodo: string, siguienteGrupo: string) {
    const siguientes = new URLSearchParams();
    if (siguientePeriodo) siguientes.set('periodo', siguientePeriodo);
    if (siguienteGrupo) siguientes.set('grupo', siguienteGrupo);
    setParams(siguientes);
  }

  const conteos = datos?.conteos ?? {};
  const cuenta = (nivel: Nivel) => conteos[nivel] ?? 0;
  const totalTutorados = NIVELES.reduce((suma, nivel) => suma + cuenta(nivel), 0);
  const sinClasificar = cuenta('informacion_insuficiente') + cuenta('inconsistencia');
  const alertasPendientes = datos?.alertas_pendientes ?? 0;
  const casos = datos?.casos ?? [];
  const casosTotal = datos?.casos_total ?? casos.length;
  const proximas = datos?.proximas_revisiones ?? [];
  const proximasTotal = datos?.proximas_total ?? proximas.length;
  const gruposFiltro = datos?.grupos?.length ? datos.grupos : (contexto?.grupos ?? []);
  const sinGruposAsignados = Boolean(datos) && (datos?.grupos?.length ?? 0) === 0 && totalTutorados === 0;
  const configError = Boolean(errorContexto) && !contexto;

  const enlaceFicha = (idAnonimo: string) =>
    periodo
      ? `/estudiantes/${encodeURIComponent(idAnonimo)}?periodo=${encodeURIComponent(periodo)}`
      : `/estudiantes/${encodeURIComponent(idAnonimo)}`;

  const opcionesPeriodo: PeriodoAcademico[] = contexto?.periodos?.length
    ? contexto.periodos
    : periodo
      ? [{ clave: periodo, nombre: periodo, activo: true, cerrado: false }]
      : [];

  return (
    <>
      <EncabezadoPagina titulo="Inicio" subtitulo="Resumen del periodo." />

      {configError ? <Fallo mensaje={errorContexto} onReintentar={recargar} /> : null}
      {error && !configError ? (
        <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />
      ) : null}
      {!contexto && !configError ? <Cargando texto="Cargando configuración…" /> : null}
      {contexto && !datos && !error ? <Cargando texto="Cargando inicio…" /> : null}

      {datos && sinGruposAsignados ? (
        <div className="tarjeta estado-vacio-tarjeta">
          <h2>Aún no tienes tutorados asignados</h2>
          <p>Coordinación debe asignarte grupos para ver el inicio y el seguimiento.</p>
        </div>
      ) : null}

      {datos && !sinGruposAsignados ? (
        <>
          <div className="toolbar">
            <label className="campo-inline">
              <span>Periodo</span>
              <select
                value={periodo}
                onChange={(evento) => aplicarFiltro(evento.target.value, grupo)}
                aria-label="Filtrar por periodo"
              >
                {opcionesPeriodo.map((item) => (
                  <option key={item.clave} value={item.clave}>
                    {item.nombre || item.clave}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-inline">
              <span>Grupo</span>
              <select
                value={grupo}
                onChange={(evento) => aplicarFiltro(periodo, evento.target.value)}
                aria-label="Filtrar por grupo"
              >
                <option value="">Todos</option>
                {gruposFiltro.map((item) => (
                  <option key={item.clave} value={item.clave}>
                    {item.nombre || item.clave}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="kpis">
            <Kpi etiqueta="Tutorados" valor={totalTutorados} />
            <Kpi etiqueta="En rojo" valor={cuenta('rojo')} tono="rojo" />
            <Kpi etiqueta="En amarillo" valor={cuenta('amarillo')} tono="amarillo" />
            <Kpi etiqueta="Sin clasificar" valor={sinClasificar} tono="neutro" />
            <Kpi etiqueta="Alertas pendientes" valor={alertasPendientes} tono="alerta" />
          </div>

          <div className="inicio-grid">
            <section className="tarjeta">
              <CabeceraTarjeta
                titulo="Requieren atención"
                detalle={casosTotal > 0 ? `Mostrando ${casos.length} de ${casosTotal}` : undefined}
              />
              {casos.length === 0 ? (
                <p className="estado-vacio">Sin casos que requieran atención.</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        <th>Grupo</th>
                        <th>Estado</th>
                        <th className="col-senales">Señales</th>
                        <th className="col-accion">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {casos.map((caso) => {
                        const reglas = caso.reglas_activadas ?? [];
                        const items = reglas.length
                          ? reglas.map((regla) => ({ codigo: regla.codigo, titulo: regla.titulo }))
                          : (caso.senales ?? []).map((senal) => {
                              const candidato = (senal.split(':')[0] ?? '').trim();
                              const codigo = /^[A-Z][A-Z0-9-]{1,12}$/.test(candidato)
                                ? candidato
                                : 'Señal';
                              return { codigo, titulo: senal };
                            });
                        const visibles = items.slice(0, 2);
                        const restantes = Math.max(items.length - visibles.length, 0);
                        return (
                          <tr key={caso.id_anonimo}>
                            <td>
                              <Link className="enlace" to={enlaceFicha(caso.id_anonimo)}>
                                {caso.id_anonimo}
                              </Link>
                            </td>
                            <td>{caso.grupo}</td>
                            <td>
                              <Semaforo nivel={caso.nivel_alerta} />
                            </td>
                            <td className="col-senales">
                              <span className="chips">
                                {visibles.map((senal) => (
                                  <span
                                    key={`${caso.id_anonimo}-${senal.codigo}`}
                                    className="chip"
                                    title={senal.titulo}
                                  >
                                    {etiqueta(ETIQUETA_SENAL_CORTA, senal.codigo, senal.codigo)}
                                  </span>
                                ))}
                                {restantes > 0 ? (
                                  <span className="chip chip-suave">+{restantes}</span>
                                ) : null}
                              </span>
                            </td>
                            <td className="celda-accion col-accion">
                              <Link
                                className="boton boton-fantasma boton-pequeno"
                                to={enlaceFicha(caso.id_anonimo)}
                              >
                                Ver ficha
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="tarjeta">
              <CabeceraTarjeta
                titulo="Próximos compromisos"
                detalle={
                  proximasTotal > 0 ? `Mostrando ${proximas.length} de ${proximasTotal}` : undefined
                }
              />
              {proximas.length === 0 ? (
                <p className="estado-vacio">Sin compromisos próximos.</p>
              ) : (
                <ul className="lista-compromisos">
                  {proximas.map((item) => (
                    <li
                      key={`${item.id_anonimo}-${item.fecha_compromiso}-${item.tipo}`}
                    >
                      <div className="compromiso-datos">
                        <Link className="enlace" to={enlaceFicha(item.id_anonimo)}>
                          {item.id_anonimo}
                        </Link>
                        <span className="nota">{etiqueta(ETIQUETA_ACCION, item.tipo)}</span>
                      </div>
                      <time className="compromiso-fecha" dateTime={item.fecha_compromiso ?? undefined}>
                        {fechaLegible(item.fecha_compromiso)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}

function Kpi({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono?: string }) {
  return (
    <div className={`kpi${tono ? ` kpi-${tono}` : ''}`}>
      <span className="kpi-etiqueta">{etiqueta}</span>
      <strong className="kpi-valor">{valor}</strong>
    </div>
  );
}

