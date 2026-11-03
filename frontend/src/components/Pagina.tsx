import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Cabecera homogénea de página: título corto, subtítulo de una línea y
 * acciones opcionales a la derecha.
 */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  acciones,
  volver,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  volver?: { to: string; texto: string };
}) {
  return (
    <header className="pagina-cabecera">
      <div className="pagina-titulo">
        {volver ? (
          <Link className="pagina-volver" to={volver.to}>
            <span aria-hidden="true">←</span> {volver.texto}
          </Link>
        ) : null}
        <h1>{titulo}</h1>
        {subtitulo ? <p>{subtitulo}</p> : null}
      </div>
      {acciones ? <div className="pagina-acciones">{acciones}</div> : null}
    </header>
  );
}

/** Tarjeta base del sistema visual interior. */
export function Tarjeta({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`tarjeta ${className}`.trim()}>{children}</section>;
}

/** Cabecera de tarjeta con título y metadatos a la derecha. */
export function CabeceraTarjeta({
  titulo,
  detalle,
  acciones,
}: {
  titulo: string;
  detalle?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="tarjeta-cabecera">
      <h2>{titulo}</h2>
      <div className="tarjeta-cabecera-derecha">
        {detalle ? <span className="nota">{detalle}</span> : null}
        {acciones}
      </div>
    </header>
  );
}
