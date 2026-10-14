import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Cargando, Fallo, Vacio } from '../components/Estados';
import { Semaforo } from '../components/Semaforo';
import { ETIQUETA_ACCION, fechaLegible, type Nivel } from '../texto';

type TableroDatos = {
  periodo: string;
  grupo: string | null;
  periodos: string[];
  grupos: string[];
  conteos: Record<Nivel, number>;
  casos: Array<{
    id_anonimo: string;
    grupo: string;
    carrera: string;
    semestre: number;
    nivel_alerta: Nivel;
    puntos: number;
    senales: string[];
  }>;
  alertas_pendientes: number;
  proximas_revisiones: Array<{ id_anonimo: string; tipo: string; fecha_compromiso: string | null; estatus: string }>;
  leyenda: string;
};

export function Tablero() {
  const [params, setParams] = useSearchParams();
  const periodo = params.get('periodo') ?? '2026-1';
  const grupo = params.get('grupo') ?? '';
  const [datos, setDatos] = useState<TableroDatos | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setError('');
    const consulta = new URLSearchParams({ periodo });
    if (grupo) consulta.set('grupo', grupo);
    api<TableroDatos>(`/api/tablero?${consulta.toString()}`)
      .then((respuesta) => {
        if (vivo) setDatos(respuesta);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(causa instanceof Error ? causa.message : 'No se pudo cargar el tablero.');
      });
    return () => {
      vivo = false;
    };
  }, [periodo, grupo, intento]);

  const total = datos ? datos.conteos.verde + datos.conteos.amarillo + datos.conteos.rojo : 0;

  return (
    <>
      <header className="encabezado-pagina">
        <div>
          <h1>Tablero</h1>
          <p>Casos que piden mirada esta semana. El color ya trae su nombre.</p>
        </div>
      </header>
      <Filtros
        periodo={periodo}
        grupo={grupo}
        periodos={datos?.periodos ?? [periodo]}
        grupos={datos?.grupos ?? []}
        onChange={(siguientePeriodo, siguienteGrupo) => {
          const siguientes = new URLSearchParams();
          siguientes.set('periodo', siguientePeriodo);
          if (siguienteGrupo) siguientes.set('grupo', siguienteGrupo);
          setParams(siguientes);
        }}
      />
      {error ? <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} /> : null}
      {!datos && !error ? <Cargando texto="Cargando el tablero…" /> : null}
      {datos && total === 0 ? <Vacio texto="No hay tutorados para ese filtro." /> : null}
      {datos && total > 0 ? (
        <>
          <div className="barra-semaforo" aria-label={`Verde ${datos.conteos.verde}, Amarillo ${datos.conteos.amarillo}, Rojo ${datos.conteos.rojo}`}>
            <Tramo nivel="verde" valor={datos.conteos.verde} total={total} />
            <Tramo nivel="amarillo" valor={datos.conteos.amarillo} total={total} />
            <Tramo nivel="rojo" valor={datos.conteos.rojo} total={total} />
          </div>
          <p className="aviso neutro">{datos.leyenda} Alertas pendientes: {datos.alertas_pendientes}.</p>
          <div className="dos-columnas subida">
            <section>
              <h2>Prioridad</h2>
              {datos.casos.length === 0 ? (
                <Vacio texto="No hay casos en amarillo o rojo con este filtro." />
              ) : (
                <div className="tabla-contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Tutorado</th>
                        <th>Grupo</th>
                        <th>Semáforo</th>
                        <th>Señales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.casos.map((caso) => (
                        <tr key={caso.id_anonimo}>
                          <td>
                            <Link to={`/tutorados/${caso.id_anonimo}`}>{caso.id_anonimo}</Link>
                          </td>
                          <td>{caso.grupo}</td>
                          <td>
                            <Semaforo nivel={caso.nivel_alerta} />
                          </td>
                          <td>{caso.senales.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h2>Próximas revisiones</h2>
              {datos.proximas_revisiones.length === 0 ? (
                <Vacio texto="No hay acciones por vencer en los próximos 14 días." />
              ) : (
                <ul className="lista-senales">
                  {datos.proximas_revisiones.map((accion) => (
                    <li key={`${accion.id_anonimo}-${accion.fecha_compromiso}-${accion.tipo}`}>
                      <Link to={`/tutorados/${accion.id_anonimo}`}>{accion.id_anonimo}</Link>
                      {` · ${ETIQUETA_ACCION[accion.tipo] ?? accion.tipo} · ${fechaLegible(accion.fecha_compromiso)}`}
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

function Tramo({ nivel, valor, total }: { nivel: Nivel; valor: number; total: number }) {
  const ancho = total === 0 ? 0 : Math.max(valor / total, valor > 0 ? 0.12 : 0);
  return (
    <span className={`tramo ${nivel}`} style={{ flexGrow: ancho }}>
      <b>{valor}</b> {nivel === 'verde' ? 'Verde' : nivel === 'amarillo' ? 'Amarillo' : 'Rojo'}
    </span>
  );
}

function Filtros({
  periodo,
  grupo,
  periodos,
  grupos,
  onChange,
}: {
  periodo: string;
  grupo: string;
  periodos: string[];
  grupos: string[];
  onChange: (periodo: string, grupo: string) => void;
}) {
  return (
    <form
      className="filtros"
      onSubmit={(evento) => {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        onChange(String(datos.get('periodo') ?? periodo), String(datos.get('grupo') ?? ''));
      }}
    >
      <label className="campo">
        <span>Periodo</span>
        <select name="periodo" defaultValue={periodo} key={periodo}>
          {(periodos.length ? periodos : [periodo]).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>Grupo</span>
        <select name="grupo" defaultValue={grupo} key={grupo}>
          <option value="">Todos</option>
          {grupos.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <button className="boton secundario oscuro" type="submit">
        Filtrar
      </button>
    </form>
  );
}
