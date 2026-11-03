import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensajeError } from '../api';
import { Cargando, Fallo } from '../components/Estados';
import { CabeceraTarjeta, EncabezadoPagina } from '../components/Pagina';
import { Semaforo } from '../components/Semaforo';
import {
  grupoValido,
  periodoValido,
  useContexto,
  type Grupo,
  type PeriodoAcademico,
} from '../contexto';
import { ETIQUETA_NIVEL, NIVELES, decimal, entero, type Nivel } from '../texto';

type FilaTutorado = {
  id_anonimo: string;
  grupo: string;
  carrera: string;
  semestre: number;
  nivel_alerta: Nivel;
  promedio_periodo: number | null;
  porcentaje_asistencia: number | null;
  materias_reprobadas: number | null;
};

type Lista = {
  total?: number;
  pagina?: number;
  por_pagina?: number;
  grupos?: Grupo[];
  tutorados: FilaTutorado[];
};

const POR_PAGINA = 25;

export function Estudiantes() {
  const [params, setParams] = useSearchParams();
  const { contexto, error: errorContexto, recargar } = useContexto();
  const periodo = periodoValido(contexto, params.get('periodo'));
  const grupo = grupoValido(contexto, params.get('grupo'));
  const nivelSolicitado = params.get('nivel') ?? '';
  const nivel = (NIVELES as readonly string[]).includes(nivelSolicitado) ? nivelSolicitado : '';
  const paginaSolicitada = Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1);
  const [datos, setDatos] = useState<Lista | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!periodo) return;
    let vivo = true;
    setDatos(null);
    setError('');
    const consulta = new URLSearchParams({
      periodo,
      pagina: String(paginaSolicitada),
      por_pagina: String(POR_PAGINA),
    });
    if (grupo) consulta.set('grupo', grupo);
    if (nivel) consulta.set('nivel', nivel);
    api<Lista>(`/api/tutorados?${consulta.toString()}`)
      .then((respuesta) => {
        if (vivo) setDatos(respuesta);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(mensajeError(causa, 'No se pudo cargar el listado de estudiantes.'));
      });
    return () => {
      vivo = false;
    };
  }, [periodo, grupo, nivel, paginaSolicitada, intento]);

  const total = datos?.total ?? datos?.tutorados.length ?? 0;
  const porPagina = datos?.por_pagina && datos.por_pagina > 0 ? datos.por_pagina : POR_PAGINA;
  const paginaActual = datos?.pagina && datos.pagina > 0 ? datos.pagina : 1;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const desde = total === 0 ? 0 : (paginaSegura - 1) * porPagina + 1;
  const hasta = Math.min(paginaSegura * porPagina, total);
  const gruposFiltro = datos?.grupos?.length ? datos.grupos : (contexto?.grupos ?? []);
  const sinGruposAsignados = Boolean(datos) && (datos?.grupos?.length ?? 0) === 0 && total === 0;
  const configError = Boolean(errorContexto) && !contexto;

  function aplicarFiltro(siguientePeriodo: string, siguienteGrupo: string, siguienteNivel: string) {
    const siguientes = new URLSearchParams();
    if (siguientePeriodo) siguientes.set('periodo', siguientePeriodo);
    if (siguienteGrupo) siguientes.set('grupo', siguienteGrupo);
    if (siguienteNivel) siguientes.set('nivel', siguienteNivel);
    setParams(siguientes);
  }

  function irAPagina(nueva: number) {
    const siguientes = new URLSearchParams();
    if (periodo) siguientes.set('periodo', periodo);
    if (grupo) siguientes.set('grupo', grupo);
    if (nivel) siguientes.set('nivel', nivel);
    if (nueva > 1) siguientes.set('pagina', String(nueva));
    setParams(siguientes);
  }

  useEffect(() => {
    if (!datos) return;
    if (datos.tutorados.length > 0) return;
    if (total > 0 && paginaActual > 1) irAPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, total, paginaActual]);

  const opcionesPeriodo: PeriodoAcademico[] = contexto?.periodos?.length
    ? contexto.periodos
    : periodo
      ? [{ clave: periodo, nombre: periodo, activo: true, cerrado: false }]
      : [];

  return (
    <>
      <EncabezadoPagina
        titulo="Estudiantes"
        subtitulo="Estado académico del periodo."
      />

      {configError ? <Fallo mensaje={errorContexto} onReintentar={recargar} /> : null}
      {error && !configError ? (
        <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />
      ) : null}
      {!contexto && !configError ? <Cargando texto="Cargando configuración…" /> : null}
      {contexto && !datos && !error ? <Cargando texto="Cargando estudiantes…" /> : null}

      {datos && sinGruposAsignados ? (
        <div className="tarjeta estado-vacio-tarjeta">
          <h2>Aún no tienes tutorados asignados</h2>
          <p>Coordinación debe asignarte grupos para que aparezcan aquí.</p>
        </div>
      ) : null}

      {datos && !sinGruposAsignados ? (
        <>
          <div className="toolbar">
            <label className="campo-inline">
              <span>Periodo</span>
              <select
                value={periodo}
                onChange={(evento) => aplicarFiltro(evento.target.value, grupo, nivel)}
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
                onChange={(evento) => aplicarFiltro(periodo, evento.target.value, nivel)}
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
            <label className="campo-inline">
              <span>Estado</span>
              <select
                value={nivel}
                onChange={(evento) => aplicarFiltro(periodo, grupo, evento.target.value)}
                aria-label="Filtrar por estado"
              >
                <option value="">Todos</option>
                {NIVELES.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETA_NIVEL[opcion]}
                  </option>
                ))}
              </select>
            </label>
            {grupo || nivel ? (
              <Link className="boton-texto" to="/estudiantes">
                Limpiar filtros
              </Link>
            ) : null}
          </div>

          <section className="tarjeta">
            <CabeceraTarjeta
              titulo="Listado"
              detalle={total > 0 ? `Mostrando ${desde}–${hasta} de ${total}` : undefined}
            />
            {datos.tutorados.length === 0 ? (
              <p className="estado-vacio">Sin estudiantes con esos filtros.</p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Grupo</th>
                      <th>Carrera</th>
                      <th>Semestre</th>
                      <th>Estado</th>
                      <th>Promedio</th>
                      <th>Asistencia</th>
                      <th>Reprobadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.tutorados.map((fila) => (
                      <tr key={fila.id_anonimo}>
                        <td>
                          <Link
                            className="enlace"
                            to={`/estudiantes/${encodeURIComponent(fila.id_anonimo)}${
                              periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''
                            }`}
                          >
                            {fila.id_anonimo}
                          </Link>
                        </td>
                        <td>{fila.grupo}</td>
                        <td>{fila.carrera}</td>
                        <td>{fila.semestre}</td>
                        <td>
                          <Semaforo nivel={fila.nivel_alerta} />
                        </td>
                        <td>{decimal(fila.promedio_periodo)}</td>
                        <td>{decimal(fila.porcentaje_asistencia)}%</td>
                        <td>{entero(fila.materias_reprobadas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {total > 0 ? (
              <nav className="paginacion" aria-label="Páginas del listado">
                <button
                  type="button"
                  className="boton boton-secundario boton-pequeno"
                  onClick={() => irAPagina(paginaSegura - 1)}
                  disabled={paginaSegura <= 1}
                >
                  Anterior
                </button>
                <span className="paginacion-info">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="boton boton-secundario boton-pequeno"
                  onClick={() => irAPagina(paginaSegura + 1)}
                  disabled={paginaSegura >= totalPaginas}
                >
                  Siguiente
                </button>
              </nav>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}
