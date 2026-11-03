import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensajeError } from '../api';
import { Cargando, Fallo } from '../components/Estados';
import { CabeceraTarjeta, EncabezadoPagina } from '../components/Pagina';
import { useContexto } from '../contexto';
import { fechaLegible } from '../texto';

type FuenteRag = {
  documento: string;
  emisor?: string | null;
  version?: string | null;
  vigencia_verificada?: boolean;
  fragmento: string | number | null;
  pagina?: number | null;
};

type Respuesta = {
  explicacion: string;
  evidencia: string;
  accion_sugerida: string;
  fuentes_rag: FuenteRag[];
  limitaciones: string;
  validacion_humana_requerida: boolean;
  abstencion: boolean;
};

type Historial = {
  id: number | string;
  pregunta: string;
  abstencion: boolean;
  id_anonimo: string | null;
  creado_en: string;
  respuesta?: Pick<Respuesta, 'explicacion' | 'evidencia' | 'fuentes_rag'>;
};

type ListaHistorial = {
  consultas: Historial[];
  total?: number;
  mostradas?: number;
};

const PATRON_ID = /^EST[-_]\d{3,4}$/;

export function Asistente() {
  const [params] = useSearchParams();
  const tutorado = params.get('tutorado') ?? '';
  const { contexto, error: errorContexto, recargar } = useContexto();
  const rag = contexto?.rag;
  const habilitado = rag?.habilitado === true;
  const [pregunta, setPregunta] = useState('');
  const [idAnonimo, setIdAnonimo] = useState(tutorado);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [totalHistorial, setTotalHistorial] = useState(0);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [errorHistorial, setErrorHistorial] = useState('');
  const [errores, setErrores] = useState<{ pregunta?: string; id?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const refPregunta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIdAnonimo(tutorado);
  }, [tutorado]);

  useEffect(() => {
    let vivo = true;
    setCargandoHistorial(true);
    setErrorHistorial('');
    api<ListaHistorial>('/api/consultas')
      .then((datos) => {
        if (!vivo) return;
        setHistorial(datos.consultas);
        setTotalHistorial(datos.total ?? datos.consultas.length);
      })
      .catch((causa: unknown) => {
        if (vivo) setErrorHistorial(mensajeError(causa, 'No se pudo cargar el historial.'));
      })
      .finally(() => {
        if (vivo) setCargandoHistorial(false);
      });
    return () => {
      vivo = false;
    };
  }, [respuesta]);

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (!habilitado) return;
    const textoPregunta = pregunta.trim();
    const textoId = idAnonimo.trim().toUpperCase();
    const nuevos: { pregunta?: string; id?: string } = {};
    if (textoPregunta.length < 8) {
      nuevos.pregunta = 'Escribe una pregunta de al menos 8 caracteres.';
    }
    if (textoId && !PATRON_ID.test(textoId)) {
      nuevos.id = 'Usa el formato EST-0001.';
    }
    setErrores(nuevos);
    if (nuevos.pregunta) {
      refPregunta.current?.focus();
      return;
    }
    if (nuevos.id) return;

    setEnviando(true);
    setErrorConsulta('');
    try {
      const cuerpo: { pregunta: string; id_anonimo?: string } = { pregunta: textoPregunta };
      if (textoId) cuerpo.id_anonimo = textoId;
      const datos = await api<Respuesta>('/api/consultas', {
        method: 'POST',
        body: JSON.stringify(cuerpo),
      });
      setRespuesta(datos);
    } catch (causa) {
      setErrorConsulta(mensajeError(causa, 'No se pudo consultar. Intenta de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  const configError = Boolean(errorContexto) && !contexto;

  return (
    <>
      <EncabezadoPagina titulo="Asistente" subtitulo="Consulta el marco normativo del programa." />

      {configError ? <Fallo mensaje={errorContexto} onReintentar={recargar} /> : null}
      {!contexto && !configError ? <Cargando texto="Cargando configuración…" /> : null}

      {contexto && !habilitado ? (
        <section className="tarjeta tarjeta-estado">
          <span className="badge badge-neutro">No disponible</span>
          <p>{rag?.motivo ?? 'El asistente no está habilitado en este entorno.'}</p>
        </section>
      ) : null}

      {contexto && habilitado ? (
        <>
          <section className="tarjeta">
            <CabeceraTarjeta titulo="Nueva consulta" />
            <form className="formulario-consulta" onSubmit={(evento) => void onSubmit(evento)} noValidate>
              <div className="campo">
                <label htmlFor="asistente-pregunta">Pregunta</label>
                <textarea
                  ref={refPregunta}
                  id="asistente-pregunta"
                  rows={3}
                  maxLength={1000}
                  value={pregunta}
                  onChange={(evento) => setPregunta(evento.target.value)}
                  placeholder="¿Qué debe registrar el tutor en el seguimiento?"
                  aria-invalid={Boolean(errores.pregunta)}
                  aria-describedby={errores.pregunta ? 'error-asistente-pregunta' : undefined}
                />
                {errores.pregunta ? (
                  <p className="campo-error" id="error-asistente-pregunta" role="alert">
                    {errores.pregunta}
                  </p>
                ) : null}
              </div>
              <div className="campo campo-id">
                <label htmlFor="asistente-id">Ficha opcional</label>
                <input
                  id="asistente-id"
                  value={idAnonimo}
                  placeholder="EST-0001"
                  onChange={(evento) => setIdAnonimo(evento.target.value.toUpperCase())}
                  aria-invalid={Boolean(errores.id)}
                  aria-describedby={errores.id ? 'error-asistente-id' : undefined}
                />
                {errores.id ? (
                  <p className="campo-error" id="error-asistente-id" role="alert">
                    {errores.id}
                  </p>
                ) : null}
              </div>
              <button
                className="boton"
                type="submit"
                disabled={enviando}
                aria-busy={enviando}
              >
                {enviando ? 'Consultando…' : 'Consultar'}
              </button>
            </form>
          </section>

          {errorConsulta ? (
            <p className="aviso-error" role="alert">
              {errorConsulta}
            </p>
          ) : null}

          {respuesta ? (
            <section className="tarjeta">
              <CabeceraTarjeta titulo="Respuesta" />
              {respuesta.abstencion ? (
                <p className="estado-vacio">{respuesta.explicacion}</p>
              ) : (
                <>
                  <p className="respuesta-texto">{respuesta.explicacion}</p>
                  <p className="respuesta-texto">{respuesta.evidencia}</p>
                  <p className="respuesta-accion">{respuesta.accion_sugerida}</p>
                  <ChipsFuentes fuentes={respuesta.fuentes_rag} />
                </>
              )}
              <p className="nota respuesta-limites">
                {respuesta.limitaciones}
                {respuesta.validacion_humana_requerida ? ' Requiere validación humana.' : ''}
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {contexto && historial.length > 0 ? (
        <section className="tarjeta">
          <CabeceraTarjeta
            titulo="Consultas recientes"
            detalle={`Mostrando ${historial.length} de ${totalHistorial}`}
          />
          {cargandoHistorial ? <Cargando texto="Cargando historial…" /> : null}
          {errorHistorial && !cargandoHistorial ? (
            <p className="aviso-error" role="alert">
              {errorHistorial}
            </p>
          ) : null}
          <ul className="lista-consultas">
            {historial.map((item) => (
              <li key={item.id}>
                <details>
                  <summary>
                    <span>{fechaLegible(item.creado_en)}</span>
                    <span className="nota">
                      {item.abstencion ? 'Sin evidencia' : 'Con fuentes'}
                      {item.id_anonimo ? ` · ${item.id_anonimo}` : ''}
                    </span>
                    <span className="consulta-pregunta">{item.pregunta}</span>
                  </summary>
                  {item.respuesta?.explicacion ? (
                    <p className="respuesta-texto">{item.respuesta.explicacion}</p>
                  ) : null}
                  {item.respuesta?.fuentes_rag?.length ? (
                    <ChipsFuentes fuentes={item.respuesta.fuentes_rag} />
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!contexto && configError ? null : (
        <p className="nota asistente-pie">
          <Link to="/inicio">Volver al inicio</Link>
        </p>
      )}
    </>
  );
}

function ChipsFuentes({ fuentes }: { fuentes: FuenteRag[] }) {
  if (fuentes.length === 0) return null;
  return (
    <div className="chips chips-fuentes" aria-label="Fuentes consultadas">
      {fuentes.map((fuente, indice) => (
        <span className="chip chip-fuente" key={`${fuente.documento}-${indice}`}>
          <strong>{fuente.documento}</strong>
          {fuente.version ? <span> · v{fuente.version}</span> : null}
          {fuente.pagina ? <span> · pág. {fuente.pagina}</span> : null}
          {fuente.vigencia_verificada === false ? (
            <span className="chip chip-suave">vigencia por validar</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
