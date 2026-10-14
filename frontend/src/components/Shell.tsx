import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from '../auth';
import { ETIQUETA_ROL } from '../texto';

const ENLACES = [
  ['/tablero', 'Tablero'],
  ['/tutorados', 'Tutorados'],
  ['/alertas', 'Alertas'],
  ['/consulta', 'Consulta'],
] as const;

export function Shell() {
  const { usuario, salir } = useSesion();
  return (
    <div className="cascaron">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="barra-app">
        <div className="marca-inst">
          <strong>Apoyo tutorial</strong>
          <span>Instituto Tecnológico de Tlalnepantla</span>
        </div>
        <nav className="nav-app" aria-label="Secciones">
          {ENLACES.map(([ruta, etiqueta]) => (
            <NavLink key={ruta} to={ruta}>
              {etiqueta}
            </NavLink>
          ))}
          {usuario?.rol === 'admin_tecnico' ? <NavLink to="/tecnica">Técnica</NavLink> : null}
        </nav>
        <div className="sesion-app">
          <span>{usuario ? ETIQUETA_ROL[usuario.rol] : ''}</span>
          <button type="button" className="boton secundario" onClick={() => void salir()}>
            Salir
          </button>
        </div>
      </header>
      <main id="contenido" className="contenido">
        <Outlet />
      </main>
      <p className="nota-pie">Datos sintéticos. La sugerencia no sustituye la decisión del tutor.</p>
    </div>
  );
}
