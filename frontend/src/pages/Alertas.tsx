import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeError } from '../api';
import { Cargando, Fallo } from '../components/Estados';
import { CabeceraTarjeta, EncabezadoPagina } from '../components/Pagina';
import { useContexto } from '../contexto';
import {
  ETIQUETA_ALERTA_TIPO,
  ETIQUETA_PRIORIDAD,
  etiqueta,
  fechaLegible,
} from '../texto';

type Alerta = {
  id: number | string;
  id_anonimo: string;
  grupo: string;
  tipo: string;
  mensaje: string;
  prioridad: string;
  nivel_alerta?: string | null;
  creado_en: string;
};

type ListaAlertas = {
  alertas: Alerta[];
  total?: number;
};

export function Alertas() {
  const { contexto, cargando: cargandoContexto, error: errorContexto, recargar } = useContexto();
  const periodo = contexto?.periodo_activo ?? '';
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [ocupada, setOcupada] = useState<number | string | null>(null);

  useEffect(() => {
    if (!periodo) return;
    let vivo = true;
    setError('');
    const consulta = new URLSearchParams({ periodo });
    api<ListaAlertas>(`/api/alertas?${consulta.toString()}`)
      .then((datos) => {
        if (!vivo) return;
        setAlertas(datos.alertas);
        setTotal(datos.total ?? datos.alertas.length);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(mensajeError(causa, 'No se pudieron cargar las alertas.'));
      });
    return () => {
      vivo = false;
    };
  }, [periodo, intento]);

  async function atender(id: number | string) {
    setOcupada(id);
    setError('');
    try {
      await api(`/api/alertas/${encodeURIComponent(String(id))}/atender`, { method: 'POST' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setError(mensajeError(causa, 'No se pudo atender la alerta.'));
    } finally {
      setOcupada(null);
    }
  }

  const configError = Boolean(errorContexto) && !contexto;

  return (
    <>
      <EncabezadoPagina titulo="Alertas" subtitulo="Pendientes del periodo." />

      {configError ? <Fallo mensaje={errorContexto} onReintentar={recargar} /> : null}
      {error && !configError ? (
        <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />
      ) : null}
      {!contexto && !configError && cargandoContexto ? (
        <Cargando texto="Cargando configuración…" />
      ) : null}
      {contexto && !alertas && !error ? <Cargando texto="Cargando alertas…" /> : null}

      {alertas ? (
        <section className="tarjeta">
          <CabeceraTarjeta
            titulo="Pendientes"
            detalle={total > 0 ? `${total} en total` : undefined}
          />
          {alertas.length === 0 ? (
            <p className="estado-vacio">Sin alertas pendientes.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Estudiante</th>
                    <th>Prioridad</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((alerta) => (
                    <tr key={alerta.id}>
                      <td>{etiqueta(ETIQUETA_ALERTA_TIPO, alerta.tipo)}</td>
                      <td>
                        <Link
                          className="enlace"
                          to={`/estudiantes/${encodeURIComponent(alerta.id_anonimo)}${
                            periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''
                          }`}
                        >
                          {alerta.id_anonimo}
                        </Link>
                        <span className="nota">{alerta.grupo}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${alerta.prioridad}`}>
                          {etiqueta(ETIQUETA_PRIORIDAD, alerta.prioridad)}
                        </span>
                      </td>
                      <td>{fechaLegible(alerta.creado_en)}</td>
                      <td className="celda-accion">
                        <button
                          type="button"
                          className="boton boton-secundario boton-pequeno"
                          disabled={ocupada === alerta.id}
                          aria-busy={ocupada === alerta.id}
                          onClick={() => void atender(alerta.id)}
                        >
                          {ocupada === alerta.id ? 'Guardando…' : 'Atender'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
