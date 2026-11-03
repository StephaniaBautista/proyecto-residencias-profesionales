import { useEffect, useRef, useState } from 'react';
import { api, mensajeError } from '../api';
import { BotonConfirmacion } from '../components/BotonConfirmacion';
import { Cargando, Fallo } from '../components/Estados';
import { CabeceraTarjeta, EncabezadoPagina } from '../components/Pagina';
import { Semaforo } from '../components/Semaforo';
import {
  ETIQUETA_ALGORITMO,
  ETIQUETA_ENTIDAD,
  ETIQUETA_OPERACION,
  decimal,
  entero,
  etiqueta,
  etiquetaTipoModelo,
  fechaLegible,
} from '../texto';

type Metricas = {
  exactitud?: number | null;
  precision_macro?: number | null;
  recall_macro?: number | null;
  soporte?: number | null;
  matriz?: number[][] | null;
  clases?: string[] | null;
};

type MetricasComparadas = {
  arbol?: Metricas;
  bosque?: Metricas;
  regresion_logistica?: Metricas;
  linea_base?: Metricas;
};

type Modelo = {
  disponible: boolean;
  tipo?: string | null;
  version?: string | null;
  algoritmo?: string | null;
  motivo?: string | null;
  etiqueta_definicion?: string | null;
  leyenda?: string | null;
  advertencia?: string | null;
  metricas?: MetricasComparadas | null;
  registros_entrenamiento?: number | null;
  registros_prueba?: number | null;
  entrenado_en?: string | null;
};

type Regla = {
  codigo: string;
  version: string;
  prioridad: number;
  nivel: string;
  titulo: string;
  descripcion?: string;
  accion: string;
  vigencia_desde?: string;
  vigencia_hasta?: string | null;
  activa?: boolean;
  aprobada_por?: string | null;
};

type Reglas = { version: string; aprobadas: boolean; reglas: Regla[] };

type Documento = {
  titulo: string;
  emisor?: string;
  version?: string | null;
  vigencia_verificada?: boolean;
  fragmentos: number;
  ingestado_en: string | null;
};

type Registro = {
  id: number | string;
  operacion: string;
  entidad: string;
  correo: string | null;
  nombre?: string | null;
  creado_en: string;
};

type Corpus = { documentos: Documento[]; total?: number };
type Bitacora = { registros: Registro[]; total?: number };

type Tab = 'modelo' | 'reglas' | 'corpus' | 'bitacora';

const TABS: Array<{ clave: Tab; texto: string }> = [
  { clave: 'modelo', texto: 'Modelo' },
  { clave: 'reglas', texto: 'Reglas' },
  { clave: 'corpus', texto: 'Corpus' },
  { clave: 'bitacora', texto: 'Bitácora' },
];

export function Administracion() {
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [tab, setTab] = useState<Tab>('modelo');
  const [reentrenando, setReentrenando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const refsTabs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let vivo = true;
    setError('');
    Promise.all([
      api<Modelo>('/api/admin/modelo'),
      api<Reglas>('/api/admin/reglas'),
      api<Corpus>('/api/admin/corpus'),
      api<Bitacora>('/api/admin/bitacora'),
    ])
      .then(([modeloDatos, reglasDatos, corpus, bitacora]) => {
        if (!vivo) return;
        setModelo(modeloDatos);
        setReglas(reglasDatos);
        setDocumentos(corpus.documentos);
        setTotalDocumentos(corpus.total ?? corpus.documentos.length);
        setRegistros(bitacora.registros);
        setTotalRegistros(bitacora.total ?? bitacora.registros.length);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(mensajeError(causa, 'No se pudo cargar la administración.'));
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  async function reentrenar() {
    setReentrenando(true);
    setMensaje(null);
    try {
      await api('/api/admin/modelo/entrenar', { method: 'POST' });
      setMensaje({ tipo: 'ok', texto: 'Modelo reentrenado y métricas actualizadas.' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setMensaje({ tipo: 'error', texto: mensajeError(causa, 'No se pudo reentrenar el modelo.') });
    } finally {
      setReentrenando(false);
    }
  }

  async function recalcular() {
    setRecalculando(true);
    setMensaje(null);
    try {
      await api('/api/admin/semaforo/recalcular', { method: 'POST' });
      setMensaje({ tipo: 'ok', texto: 'Semáforo recalculado y datos actualizados.' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setMensaje({
        tipo: 'error',
        texto: mensajeError(causa, 'No se pudo recalcular el semáforo.'),
      });
    } finally {
      setRecalculando(false);
    }
  }

  function alPresionarTab(evento: React.KeyboardEvent<HTMLButtonElement>, indice: number) {
    let siguiente = -1;
    if (evento.key === 'ArrowRight') siguiente = (indice + 1) % TABS.length;
    else if (evento.key === 'ArrowLeft') siguiente = (indice - 1 + TABS.length) % TABS.length;
    else if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = TABS.length - 1;
    if (siguiente < 0) return;
    evento.preventDefault();
    const nueva = TABS[siguiente].clave;
    setTab(nueva);
    refsTabs.current[siguiente]?.focus();
  }

  if (error && !modelo) return <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />;
  if (!modelo || !reglas || !documentos || !registros) {
    return <Cargando texto="Cargando administración…" />;
  }

  const metricas = modelo.metricas?.arbol ?? null;
  const matrix = metricas?.matriz ?? null;
  const clases = metricas?.clases ?? null;
  const nombreTipo = etiquetaTipoModelo(modelo.tipo);

  return (
    <>
      <EncabezadoPagina titulo="Administración" subtitulo="Modelo, reglas, corpus y bitácora." />

      {error ? (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      ) : null}
      {mensaje ? (
        <p
          className={mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}
          role={mensaje.tipo === 'ok' ? 'status' : 'alert'}
        >
          {mensaje.texto}
        </p>
      ) : null}

      <section className="tarjeta">
        <div className="tabs" role="tablist" aria-label="Secciones de administración">
          {TABS.map((item, indice) => (
            <button
              key={item.clave}
              ref={(elemento) => {
                refsTabs.current[indice] = elemento;
              }}
              type="button"
              role="tab"
              id={`tab-${item.clave}`}
              aria-selected={tab === item.clave}
              aria-controls={`panel-${item.clave}`}
              tabIndex={tab === item.clave ? 0 : -1}
              className={`tab${tab === item.clave ? ' activo' : ''}`}
              onClick={() => setTab(item.clave)}
              onKeyDown={(evento) => alPresionarTab(evento, indice)}
            >
              {item.texto}
            </button>
          ))}
        </div>

        {tab === 'modelo' ? (
          <div role="tabpanel" id="panel-modelo" aria-labelledby="tab-modelo" className="tab-panel">
            <CabeceraTarjeta
              titulo="Modelo vigente"
              detalle={
                <>
                  {nombreTipo}
                  {modelo.version ? ` · ${modelo.version}` : ''}
                </>
              }
              acciones={
                <BotonConfirmacion
                  etiqueta="Reentrenar"
                  pregunta="¿Reentrenar el modelo con los datos actuales?"
                  etiquetaConfirmar="Sí, reentrenar"
                  onConfirmar={() => void reentrenar()}
                  cargando={reentrenando}
                  variante="primario"
                />
              }
            />
            {!modelo.disponible ? (
              <p className="estado-vacio">Todavía no hay un modelo entrenado.</p>
            ) : (
              <>
                <p className="meta-linea">
                  <span className="badge badge-info">{nombreTipo}</span>
                  {modelo.algoritmo ? (
                    <span>{etiqueta(ETIQUETA_ALGORITMO, modelo.algoritmo)}</span>
                  ) : null}
                  <span>Entrenado: {fechaLegible(modelo.entrenado_en)}</span>
                  <span>
                    {entero(modelo.registros_entrenamiento)} entrenamiento ·{' '}
                    {entero(modelo.registros_prueba)} prueba
                  </span>
                </p>
                <div className="tabla-scroll">
                  <table className="tabla">
                    <caption>Comparación de algoritmos del último entrenamiento</caption>
                    <thead>
                      <tr>
                        <th scope="col">Algoritmo</th>
                        <th scope="col">Exactitud</th>
                        <th scope="col">Precisión</th>
                        <th scope="col">Recall</th>
                        <th scope="col">Soporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Árbol de decisión</td>
                        <td>{decimal(modelo.metricas?.arbol?.exactitud)}</td>
                        <td>{decimal(modelo.metricas?.arbol?.precision_macro)}</td>
                        <td>{decimal(modelo.metricas?.arbol?.recall_macro)}</td>
                        <td>{entero(modelo.metricas?.arbol?.soporte)}</td>
                      </tr>
                      <tr>
                        <td>Bosque aleatorio</td>
                        <td>{decimal(modelo.metricas?.bosque?.exactitud)}</td>
                        <td>{decimal(modelo.metricas?.bosque?.precision_macro)}</td>
                        <td>{decimal(modelo.metricas?.bosque?.recall_macro)}</td>
                        <td>{entero(modelo.metricas?.bosque?.soporte)}</td>
                      </tr>
                      <tr>
                        <td>Regresión logística</td>
                        <td>{decimal(modelo.metricas?.regresion_logistica?.exactitud)}</td>
                        <td>{decimal(modelo.metricas?.regresion_logistica?.precision_macro)}</td>
                        <td>{decimal(modelo.metricas?.regresion_logistica?.recall_macro)}</td>
                        <td>{entero(modelo.metricas?.regresion_logistica?.soporte)}</td>
                      </tr>
                      <tr>
                        <td>Línea base</td>
                        <td>{decimal(modelo.metricas?.linea_base?.exactitud)}</td>
                        <td>{decimal(modelo.metricas?.linea_base?.precision_macro)}</td>
                        <td>{decimal(modelo.metricas?.linea_base?.recall_macro)}</td>
                        <td>{entero(modelo.metricas?.linea_base?.soporte)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {matrix && clases && clases.length > 0 ? (
                  <>
                    <h3 className="subtitulo-bloque">Matriz de confusión del árbol</h3>
                    <div className="tabla-scroll">
                      <table className="tabla tabla-matriz">
                        <caption>
                          Filas: clase real; columnas: clase predicha.
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Real \ Predicha</th>
                            {clases.map((clase) => (
                              <th key={clase} scope="col">
                                {clase}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrix.map((fila, indice) => {
                            const clase = clases[indice] ?? `Clase ${indice + 1}`;
                            return (
                              <tr key={clase}>
                                <th scope="row">{clase}</th>
                                {fila.map((valor, columna) => (
                                  <td key={`${clase}-${columna}`}>{valor}</td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
                <details className="detalle-tecnico">
                  <summary>Ficha del modelo</summary>
                  {modelo.motivo ? <p>{modelo.motivo}</p> : null}
                  {modelo.etiqueta_definicion ? <p>{modelo.etiqueta_definicion}</p> : null}
                  {modelo.advertencia ? <p className="nota">{modelo.advertencia}</p> : null}
                  {modelo.leyenda ? <p className="nota">{modelo.leyenda}</p> : null}
                </details>
              </>
            )}
          </div>
        ) : null}

        {tab === 'reglas' ? (
          <div role="tabpanel" id="panel-reglas" aria-labelledby="tab-reglas" className="tab-panel">
            <CabeceraTarjeta
              titulo="Reglas del semáforo"
              detalle={
                <>
                  {reglas.version} ·{' '}
                  <span className={reglas.aprobadas ? 'badge badge-verde' : 'badge badge-amarillo'}>
                    {reglas.aprobadas ? 'Aprobadas' : 'Experimentales'}
                  </span>
                </>
              }
              acciones={
                <BotonConfirmacion
                  etiqueta="Recalcular semáforo"
                  pregunta="¿Recalcular el semáforo del periodo activo?"
                  etiquetaConfirmar="Sí, recalcular"
                  onConfirmar={() => void recalcular()}
                  cargando={recalculando}
                />
              }
            />
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Nivel</th>
                    <th scope="col">Prioridad</th>
                    <th scope="col">Título</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {reglas.reglas.map((regla) => (
                    <tr key={regla.codigo}>
                      <td>
                        <span className="chip">{regla.codigo}</span>
                      </td>
                      <td>
                        <Semaforo nivel={regla.nivel} />
                      </td>
                      <td>{regla.prioridad}</td>
                      <td>{regla.titulo}</td>
                      <td>{regla.accion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === 'corpus' ? (
          <div role="tabpanel" id="panel-corpus" aria-labelledby="tab-corpus" className="tab-panel">
            <CabeceraTarjeta
              titulo="Corpus normativo"
              detalle={`Mostrando ${documentos.length} de ${totalDocumentos}`}
            />
            {documentos.length === 0 ? (
              <p className="estado-vacio">Todavía no hay fuentes normativas cargadas.</p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Documento</th>
                      <th scope="col">Emisor</th>
                      <th scope="col">Versión</th>
                      <th scope="col">Vigencia</th>
                      <th scope="col">Fragmentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((documento, indice) => (
                      <tr key={`${documento.titulo}-${indice}`}>
                        <td>{documento.titulo}</td>
                        <td>{documento.emisor ?? '—'}</td>
                        <td>{documento.version ?? '—'}</td>
                        <td>
                          <span
                            className={
                              documento.vigencia_verificada
                                ? 'badge badge-verde'
                                : 'badge badge-amarillo'
                            }
                          >
                            {documento.vigencia_verificada ? 'Verificada' : 'Por validar'}
                          </span>
                        </td>
                        <td>
                          {documento.fragmentos} · {fechaLegible(documento.ingestado_en)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'bitacora' ? (
          <div role="tabpanel" id="panel-bitacora" aria-labelledby="tab-bitacora" className="tab-panel">
            <CabeceraTarjeta
              titulo="Bitácora"
              detalle={`Mostrando ${registros.length} de ${totalRegistros}`}
            />
            {registros.length === 0 ? (
              <p className="estado-vacio">Sin registros de bitácora.</p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Operación</th>
                      <th scope="col">Entidad</th>
                      <th scope="col">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((registro) => (
                      <tr key={registro.id}>
                        <td>{fechaLegible(registro.creado_en)}</td>
                        <td>{etiqueta(ETIQUETA_OPERACION, registro.operacion)}</td>
                        <td>{etiqueta(ETIQUETA_ENTIDAD, registro.entidad)}</td>
                        <td>{registro.correo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
