import { useEffect, type ReactNode } from 'react';
import { useContexto } from '../contexto';

const NOTA_PROTOTIPO =
  'Prototipo de residencia profesional · Datos sintéticos · Reglas experimentales no aprobadas por ITTLA';

/**
 * Cascarón público de las pantallas de acceso: marca institucional a la
 * izquierda, tarjeta del formulario a la derecha y nota de prototipo al pie.
 */
export function AuthLayout({
  titulo,
  descripcion,
  tituloDocumento,
  children,
}: {
  titulo: string;
  descripcion?: string;
  tituloDocumento: string;
  children: ReactNode;
}) {
  const { contexto } = useContexto();
  const nombreCorto = contexto?.institucion.nombre_corto ?? 'Apoyo tutorial';
  const nombreInstitucion = contexto?.institucion.nombre ?? 'TecNM';

  useEffect(() => {
    document.title = `${tituloDocumento} · ${nombreCorto}`;
  }, [tituloDocumento, nombreCorto]);

  return (
    <div className="pantalla-auth">
      <div className="auth-contenido">
        <section className="auth-presentacion" aria-label="Presentación institucional">
          <p className="auth-kicker">TecNM · {nombreInstitucion}</p>
          <div className="auth-gancho">
            <h1>Apoyo para leer la trayectoria y decidir el acompañamiento.</h1>
            <p>Reglas explicables, alertas y seguimiento tutorial con datos sintéticos.</p>
          </div>
          <p className="auth-marca">Uso exclusivo del personal autorizado</p>
        </section>
        <section className="auth-tarjeta" aria-labelledby="auth-titulo">
          <header className="auth-cabecera">
            <h2 id="auth-titulo">{titulo}</h2>
            {descripcion ? <p>{descripcion}</p> : null}
          </header>
          {children}
        </section>
      </div>
      <footer className="auth-pie">
        <p className="nota-prototipo">{NOTA_PROTOTIPO}</p>
      </footer>
    </div>
  );
}

export { NOTA_PROTOTIPO };
