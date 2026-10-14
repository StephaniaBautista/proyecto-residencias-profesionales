import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Fallo, Vacio } from '../components/Estados';
import { fechaLegible } from '../texto';

type Metricas = {
  exactitud: number;
  precision_macro: number;
  recall_macro: number;
  matriz: number[][];
  clases: string[];
};

type Modelo = {
  disponible: boolean;
  version?: string;
  algoritmo?: string;
  motivo?: string;
  metricas?: {
    regresion_logistica: Metricas;
    arbol: Metricas;
    bosque: Metricas;
  };
  entrenado_en?: string;
};

type Documento = { titulo: string; fragmentos: number; ingestado_en: string | null };
type Registro = { id: number; operacion: string; entidad: string; correo: string | null; creado_en: string };

export function Tecnica() {
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [entrenando, setEntrenando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      api<Modelo>('/api/admin/modelo'),
      api<{ documentos: Documento[] }>('/api/admin/corpus'),
      api<{ registros: Registro[] }>('/api/admin/bitacora'),
    ])
      .then(([modeloDatos, corpus, bitacora]) => {
        if (!vivo) return;
        setModelo(modeloDatos);
        setDocumentos(corpus.documentos);
        setRegistros(bitacora.registros);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(causa instanceof Error ? causa.message : 'No se pudo cargar la vista técnica.');
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  async function entrenar() {
    setEntrenando(true);
    setError('');
    try {
      await api('/api/admin/modelo/entrenar', { method: 'POST' });
      setIntento((n) => n + 1);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo entrenar.');
    } finally {
      setEntrenando(false);
    }
  }

  if (error && !modelo) return <Fallo mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />;
  if (!modelo || !documentos || !registros) return <Cargando texto="Cargando la vista técnica…" />;

  return (
    <>
      <header className="encabezado-pagina">
        <div>
          <h1>Vista técnica</h1>
          <p>El árbol es el modelo que se muestra al tutor. Los otros dos solo se comparan.</p>
        </div>
        <button className="boton" type="button" onClick={() => void entrenar()} disabled={entrenando}>
          {entrenando ? 'Entrenando…' : 'Volver a entrenar'}
        </button>
      </header>
      {error ? <p className="aviso" role="alert">{error}</p> : null}
      {!modelo.disponible || !modelo.metricas ? (
        <Vacio texto="Todavía no hay un modelo guardado." />
      ) : (
        <section className="bloque">
          <h2>{modelo.algoritmo} · {modelo.version}</h2>
          <p>{modelo.motivo}</p>
          <p>Entrenado: {fechaLegible(modelo.entrenado_en)}</p>
          <div className="tabla-contenedor subida">
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Exactitud</th>
                  <th>Precisión</th>
                  <th>Recall</th>
                </tr>
              </thead>
              <tbody>
                <Fila nombre="Regresión logística" metricas={modelo.metricas.regresion_logistica} />
                <Fila nombre="Árbol de decisión" metricas={modelo.metricas.arbol} />
                <Fila nombre="Bosque aleatorio" metricas={modelo.metricas.bosque} />
              </tbody>
            </table>
          </div>
          <h3 className="subida">Matriz del árbol (filas reales, columnas predichas)</h3>
          <div className="matriz">
            <span></span>
            {modelo.metricas.arbol.clases.map((clase) => (
              <span key={clase}>{clase}</span>
            ))}
            {modelo.metricas.arbol.matriz.map((fila, indice) => (
              <FragmentoFila key={modelo.metricas!.arbol.clases[indice]} clase={modelo.metricas!.arbol.clases[indice]} fila={fila} />
            ))}
          </div>
        </section>
      )}
      <section className="bloque">
        <h2>Corpus</h2>
        {documentos.length === 0 ? (
          <Vacio texto="Aún no hay documentos. Desde backend ejecuta npm run ingest cuando la clave de OpenRouter esté lista." />
        ) : (
          <ul className="lista-senales">
            {documentos.map((documento) => (
              <li key={documento.titulo}>
                {documento.titulo} · {documento.fragmentos} fragmentos · {fechaLegible(documento.ingestado_en)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="bloque">
        <h2>Bitácora</h2>
        <ul className="lista-senales">
          {registros.map((registro) => (
            <li key={registro.id}>
              {fechaLegible(registro.creado_en)} · {registro.operacion} · {registro.entidad}
              {registro.correo ? ` · ${registro.correo}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Fila({ nombre, metricas }: { nombre: string; metricas: Metricas }) {
  return (
    <tr>
      <td>{nombre}</td>
      <td>{metricas.exactitud}</td>
      <td>{metricas.precision_macro}</td>
      <td>{metricas.recall_macro}</td>
    </tr>
  );
}

function FragmentoFila({ clase, fila }: { clase: string; fila: number[] }) {
  return (
    <>
      <span>{clase}</span>
      {fila.map((valor, indice) => (
        <span key={`${clase}-${indice}`}>{valor}</span>
      ))}
    </>
  );
}
