import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Cargando, Fallo, Vacio } from '../components/Estados';
import { Semaforo } from '../components/Semaforo';
import { decimal, type Nivel } from '../texto';

type Lista = {
  periodo: string;
  periodos: string[];
  grupos: string[];
  tutorados: Array<{
    id_anonimo: string;
    grupo: string;
    carrera: string;
    semestre: number;
    nivel_alerta: Nivel;
    promedio_periodo: number;
    porcentaje_asistencia: number;
    materias_reprobadas: number;
    avance_curricular: number;
    acuerdos_vencidos: number;
  }>;
};

export function Tutorados() {
  const [params, setParams] = useSearchParams();
  const periodo = params.get('periodo') ?? '2026-1';
  const grupo = params.get('grupo') ?? '';
  const nivel = params.get('nivel') ?? '';
  const [datos, setDatos] = useState<Lista | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    const consulta = new URLSearchParams({ periodo });
    if (grupo) consulta.set('grupo', grupo);
    if (nivel) consulta.set('nivel', nivel);
    api<Lista>(`/api/tutorados?${consulta.toString()}`)
      .then((respuesta) => {
        if (vivo) setDatos(respuesta);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(causa instanceof Error ? causa.message : 'No se pudo cargar el listado.');
      });
    return () => {
      vivo = false;
    };
  }, [periodo, grupo, nivel, intento]);

  return (
    <>
      <header className="encabezado-pagina">
        <div>
          <h1>Tutorados</h1>
          <p>Identificadores ficticios. El tutor solo ve los grupos que tiene asignados.</p>
        </div>
      </header>
      <form
        className="filtros"
        onSubmit={(evento) => {
          evento.preventDefault();
          const forma = new FormData(evento.currentTarget);
          const siguientes = new URLSearchParams();
          siguientes.set('periodo', String(forma.get('periodo') ?? periodo));
          const grupoNuevo = String(forma.get('grupo') ?? '');
          const nivelNuevo = String(forma.get('nivel') ?? '');
          if (grupoNuevo) siguientes.set('grupo', grupoNuevo);
          if (nivelNuevo) siguientes.set('nivel', nivelNuevo);
          setParams(siguientes);
        }}
      >
        <label className="campo">
          <span>Periodo</span>
          <select name="periodo" defaultValue={periodo} key={`p-${periodo}`}>
            {(datos?.periodos.length ? datos.periodos : [periodo]).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Grupo</span>
          <select name="grupo" defaultValue={grupo} key={`g-${grupo}`}>
            <option value="">Todos</option>
            {(datos?.grupos ?? []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Semáforo</span>
          <select name="nivel" defaultValue={nivel} key={`n-${nivel}`}>
            <option value="">Todos</option>
            <option value="verde">Verde</option>
            <option value="amarillo">Amarillo</option>
            <option value="rojo">Rojo</option>
          </select>
        </label>
        <button className="boton secundario oscuro" type="submit">
          Filtrar
        </button>
      </form>
      {error ? <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} /> : null}
      {!datos && !error ? <Cargando texto="Cargando tutorados…" /> : null}
      {datos && datos.tutorados.length === 0 ? <Vacio texto="No hay tutorados con esos filtros." /> : null}
      {datos && datos.tutorados.length > 0 ? (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Tutorado</th>
                <th>Grupo</th>
                <th>Carrera</th>
                <th>Sem.</th>
                <th>Semáforo</th>
                <th>Promedio</th>
                <th>Asistencia</th>
                <th>Reprobadas</th>
                <th>Avance</th>
                <th>Acuerdos</th>
              </tr>
            </thead>
            <tbody>
              {datos.tutorados.map((fila) => (
                <tr key={fila.id_anonimo}>
                  <td>
                    <Link to={`/tutorados/${fila.id_anonimo}`}>{fila.id_anonimo}</Link>
                  </td>
                  <td>{fila.grupo}</td>
                  <td>{fila.carrera}</td>
                  <td>{fila.semestre}</td>
                  <td>
                    <Semaforo nivel={fila.nivel_alerta} />
                  </td>
                  <td>{decimal(fila.promedio_periodo)}</td>
                  <td>{decimal(fila.porcentaje_asistencia)}%</td>
                  <td>{fila.materias_reprobadas}</td>
                  <td>{decimal(fila.avance_curricular)}%</td>
                  <td>{fila.acuerdos_vencidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
