import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Cargando } from '../components/Estados';
import { fechaLegible } from '../texto';

type Respuesta = {
  id_estudiante_anonimo: string | null;
  explicacion: string;
  evidencia: string;
  accion_sugerida: string;
  fuentes_rag: Array<{ documento: string; fragmento: number; pagina: number | null }>;
  limitaciones: string;
  validacion_humana_requerida: boolean;
  abstencion: boolean;
  indicadores_activos: string[];
  nivel_alerta: string | null;
};

type Historial = {
  id: number;
  pregunta: string;
  abstencion: boolean;
  id_anonimo: string | null;
  creado_en: string;
  respuesta?: Pick<Respuesta, 'explicacion' | 'evidencia' | 'fuentes_rag'>;
};

export function Consulta() {
  const [params] = useSearchParams();
  const tutorado = params.get('tutorado') ?? '';
  const [pregunta, setPregunta] = useState('¿Qué debe registrar el tutor en el seguimiento?');
  const [idAnonimo, setIdAnonimo] = useState(tutorado);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setIdAnonimo(tutorado);
  }, [tutorado]);

  useEffect(() => {
    let vivo = true;
    api<{ consultas: Historial[] }>('/api/consultas')
      .then((datos) => {
        if (vivo) setHistorial(datos.consultas);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(causa instanceof Error ? causa.message : 'No se pudo cargar el historial.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [respuesta]);

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const cuerpo: { pregunta: string; id_anonimo?: string } = { pregunta };
      if (/^EST_\d{3}$/.test(idAnonimo)) cuerpo.id_anonimo = idAnonimo;
      const datos = await api<Respuesta>('/api/consultas', { method: 'POST', body: JSON.stringify(cuerpo) });
      setRespuesta(datos);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo consultar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <header className="encabezado-pagina">
        <div>
          <h1>Consulta normativa</h1>
          <p>Responde con las fuentes registradas. Si la vigencia para ITTLA está por validar, lo indica; si falta evidencia, se abstiene.</p>
        </div>
      </header>
      <form className="formulario" onSubmit={(evento) => void onSubmit(evento)}>
        <label className="campo">
          <span>Pregunta</span>
          <textarea value={pregunta} onChange={(evento) => setPregunta(evento.target.value)} required minLength={8} maxLength={1000} />
        </label>
        <label className="campo">
          <span>Ficha opcional (EST_001)</span>
          <input value={idAnonimo} onChange={(evento) => setIdAnonimo(evento.target.value.toUpperCase())} pattern="EST_[0-9]{3}" />
        </label>
        <button className="boton" type="submit" disabled={enviando} data-state={enviando ? 'loading' : 'default'}>
          {enviando ? 'Consultando…' : 'Consultar'}
        </button>
      </form>
      {error ? <p className="aviso subida" role="alert">{error}</p> : null}
      {respuesta ? (
        <article className="bloque subida">
          {respuesta.abstencion ? (
            <p className="aviso" role="status">{respuesta.explicacion}</p>
          ) : (
            <>
              <h2>Respuesta de apoyo</h2>
              <p>{respuesta.explicacion}</p>
              <p className="subida"><strong>Evidencia. </strong>{respuesta.evidencia}</p>
              <p><strong>Acción sugerida. </strong>{respuesta.accion_sugerida}</p>
              {respuesta.indicadores_activos.length ? <p>Indicadores de la ficha: {respuesta.indicadores_activos.join(' · ')}</p> : null}
              <ul className="lista-senales">
                {respuesta.fuentes_rag.map((fuente) => (
                  <li key={`${fuente.documento}-${fuente.fragmento}`}>
                    {fuente.documento}, fragmento {fuente.fragmento}
                    {fuente.pagina ? `, página ${fuente.pagina}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p>{respuesta.limitaciones} {respuesta.validacion_humana_requerida ? 'Validación humana requerida.' : ''}</p>
        </article>
      ) : null}
      <section className="bloque">
        <h2>Consultas recientes</h2>
        <p>Se muestran las últimas 12 consultas de esta cuenta; abre una para revisar la respuesta y sus fuentes.</p>
        {cargando ? <Cargando texto="Cargando historial…" /> : null}
        {!cargando && historial.length === 0 ? <p>No hay consultas recientes para esta cuenta.</p> : null}
        {historial.length > 0 ? (
          <ul className="lista-senales">
            {historial.map((item) => (
              <li key={item.id}>
                <details>
                  <summary>
                    {fechaLegible(item.creado_en)} · {item.abstencion ? 'Sin evidencia' : 'Con fuente'}
                    {item.id_anonimo ? ` · ${item.id_anonimo}` : ''} · {item.pregunta}
                  </summary>
                  {item.respuesta?.explicacion ? <p>{item.respuesta.explicacion}</p> : null}
                  {item.respuesta?.evidencia ? <p><strong>Evidencia. </strong>{item.respuesta.evidencia}</p> : null}
                  {item.respuesta?.fuentes_rag.length ? (
                    <ul className="lista-senales">
                      {item.respuesta.fuentes_rag.map((fuente) => (
                        <li key={`${item.id}-${fuente.documento}-${fuente.fragmento}`}>
                          {fuente.documento}, fragmento {fuente.fragmento}
                          {fuente.pagina ? `, página ${fuente.pagina}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
