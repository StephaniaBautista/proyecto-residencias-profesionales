import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Cargando, Fallo, Vacio } from '../components/Estados';
import { fechaLegible } from '../texto';

type Alerta = {
  id: number;
  id_anonimo: string;
  grupo: string;
  tipo: string;
  mensaje: string;
  prioridad: string;
  creado_en: string;
};

export function Alertas() {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [ocupada, setOcupada] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ alertas: Alerta[] }>('/api/alertas')
      .then((datos) => {
        if (vivo) setAlertas(datos.alertas);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(causa instanceof Error ? causa.message : 'No se pudieron cargar las alertas.');
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  async function atender(id: number) {
    setOcupada(id);
    try {
      await api(`/api/alertas/${id}/atender`, { method: 'POST' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo atender la alerta.');
    } finally {
      setOcupada(null);
    }
  }

  return (
    <>
      <header className="encabezado-pagina">
        <div>
          <h1>Alertas</h1>
          <p>Rojo sin revisión de asesoría, o una acción que vence en los próximos siete días.</p>
        </div>
      </header>
      {error ? <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} /> : null}
      {!alertas && !error ? <Cargando texto="Cargando alertas…" /> : null}
      {alertas && alertas.length === 0 ? <Vacio texto="No hay alertas pendientes." /> : null}
      {alertas && alertas.length > 0 ? (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Tutorado</th>
                <th>Mensaje</th>
                <th>Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((alerta) => (
                <tr key={alerta.id}>
                  <td>{alerta.prioridad === 'alta' ? 'Alta' : 'Media'}</td>
                  <td>
                    <Link to={`/tutorados/${alerta.id_anonimo}`}>{alerta.id_anonimo}</Link>
                    <div>{alerta.grupo}</div>
                  </td>
                  <td>{alerta.mensaje}</td>
                  <td>{fechaLegible(alerta.creado_en)}</td>
                  <td>
                    <button
                      type="button"
                      className="boton secundario oscuro"
                      disabled={ocupada === alerta.id}
                      onClick={() => void atender(alerta.id)}
                    >
                      {ocupada === alerta.id ? 'Guardando…' : 'Marcar atendida'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
