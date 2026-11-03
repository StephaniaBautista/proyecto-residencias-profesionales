import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../auth';
import { useContexto, type Contexto } from '../contexto';
import { ETIQUETA_ROL } from '../texto';
import {
  IconoAdministracion,
  IconoAlertas,
  IconoAsistente,
  IconoCerrar,
  IconoEstudiantes,
  IconoInicio,
  IconoMenu,
  IconoSalir,
} from './Iconos';

const TITULOS: Record<string, string> = {
  '/inicio': 'Inicio',
  '/estudiantes': 'Estudiantes',
  '/alertas': 'Alertas',
  '/asistente': 'Asistente',
  '/administracion': 'Administración',
};

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = palabras.slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase());
  return letras.join('') || 'AT';
}

function Navegacion({ esAdmin, alNavegar }: { esAdmin: boolean; alNavegar?: () => void }) {
  const clase = ({ isActive }: { isActive: boolean }) =>
    `nav-enlace${isActive ? ' activo' : ''}`;
  return (
    <nav className="app-nav" aria-label="Navegación principal">
      <NavLink to="/inicio" onClick={alNavegar} className={clase}>
        <IconoInicio />
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/estudiantes" onClick={alNavegar} className={clase}>
        <IconoEstudiantes />
        <span>Estudiantes</span>
      </NavLink>
      <NavLink to="/alertas" onClick={alNavegar} className={clase}>
        <IconoAlertas />
        <span>Alertas</span>
      </NavLink>
      <NavLink to="/asistente" onClick={alNavegar} className={clase}>
        <IconoAsistente />
        <span>Asistente</span>
      </NavLink>
      {esAdmin ? (
        <NavLink to="/administracion" onClick={alNavegar} className={clase}>
          <IconoAdministracion />
          <span>Administración</span>
        </NavLink>
      ) : null}
    </nav>
  );
}

function Acerca({ contexto }: { contexto: Contexto | null }) {
  const motivoAsistente = contexto?.rag.habilitado
    ? 'Disponible.'
    : (contexto?.rag.motivo ?? 'No disponible en este entorno.');
  return (
    <details className="acerca">
      <summary>Prototipo · datos sintéticos</summary>
      <div className="acerca-panel">
        <h2>Acerca de este prototipo</h2>
        <p>
          Demostración del apoyo tutorial. No usa expedientes reales ni sustituye decisiones
          institucionales.
        </p>
        <dl>
          <dt>Institución</dt>
          <dd>{contexto?.institucion.nombre ?? 'No disponible'}</dd>
          <dt>Periodo activo</dt>
          <dd>{contexto?.periodo_activo ?? '—'}</dd>
          <dt>Reglas del semáforo</dt>
          <dd>
            {contexto?.version_reglas ?? '—'} · experimentales, no aprobadas por ITTLA.
          </dd>
          <dt>Cómo se calcula el color</dt>
          <dd>{contexto?.leyendas.semaforo ?? '—'}</dd>
          <dt>Modelo de apoyo</dt>
          <dd>{contexto?.leyendas.modelo ?? '—'}</dd>
          <dt>Asistente normativo</dt>
          <dd>{motivoAsistente}</dd>
          <dt>Aviso</dt>
          <dd>{contexto?.banner ?? 'Datos sintéticos con fines de demostración.'}</dd>
        </dl>
      </div>
    </details>
  );
}

export function Shell() {
  const { usuario, salir } = useSesion();
  const { contexto, error, recargar } = useContexto();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const refAbrir = useRef<HTMLButtonElement>(null);
  const refCerrar = useRef<HTMLButtonElement>(null);

  const nombreCorto = contexto?.institucion.nombre_corto ?? 'Apoyo tutorial';
  const nombreInstitucion = contexto?.institucion.nombre ?? nombreCorto;
  const nombreInstitucionVisible = contexto?.institucion.nombre_corto ?? nombreInstitucion;
  const esAdmin = usuario?.rol === 'admin_tecnico';

  useEffect(() => {
    const titulo = pathname.startsWith('/estudiantes/')
      ? 'Ficha de estudiante'
      : (TITULOS[pathname] ?? 'Apoyo tutorial');
    document.title = `${titulo} · ${nombreCorto}`;
  }, [pathname, nombreCorto]);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    refCerrar.current?.focus();
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
        refAbrir.current?.focus();
        return;
      }
      if (evento.key !== 'Tab') return;
      const contenedor = document.getElementById('menu-lateral');
      if (!contenedor) return;
      const enfocables = Array.from(
        contenedor.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, input, select, textarea',
        ),
      ).filter((elemento) => elemento.offsetParent !== null);
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alPresionar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [menuAbierto]);

  function cerrarMenu() {
    setMenuAbierto(false);
    refAbrir.current?.focus();
  }

  const tarjetaUsuario = (compacta = false) => (
    <div className={`tarjeta-usuario${compacta ? ' compacta' : ''}`}>
      <span className="avatar" aria-hidden="true">
        {iniciales(usuario?.nombre ?? 'Apoyo tutorial')}
      </span>
      <div className="usuario-datos">
        <strong title={usuario?.nombre}>{usuario?.nombre}</strong>
        <span>{usuario ? ETIQUETA_ROL[usuario.rol] : ''}</span>
        <span className="usuario-correo" title={usuario?.correo}>{usuario?.correo}</span>
      </div>
      <button
        type="button"
        className="boton-salir"
        onClick={() => void salir()}
        aria-label="Salir de la sesión"
      >
        <IconoSalir />
        <span>Salir</span>
      </button>
    </div>
  );

  return (
    <div className="app">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="sidebar" aria-label="Barra lateral">
        <div className="sidebar-marca">
          <span className="sidebar-logo" aria-hidden="true">
            AT
          </span>
          <div className="sidebar-marca-texto">
            <strong>Apoyo tutorial</strong>
            <span title={nombreInstitucion}>{nombreInstitucionVisible}</span>
          </div>
        </div>
        <Navegacion esAdmin={esAdmin} />
        <div className="sidebar-pie">
          {tarjetaUsuario()}
          <Acerca contexto={contexto} />
        </div>
      </aside>

      <header className="topbar">
        <button
          ref={refAbrir}
          type="button"
          className="menu-boton"
          onClick={() => setMenuAbierto(true)}
          aria-expanded={menuAbierto}
          aria-controls="menu-lateral"
        >
          <IconoMenu />
          <span>Menú</span>
        </button>
        <div className="topbar-marca">
          <strong>Apoyo tutorial</strong>
          <span>{contexto?.institucion.nombre_corto ?? ''}</span>
        </div>
      </header>

      {menuAbierto ? (
        <div className="drawer-capa">
          <div className="drawer-fondo" onClick={cerrarMenu} aria-hidden="true" />
          <aside
            id="menu-lateral"
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div className="drawer-cabecera">
              <strong>Apoyo tutorial</strong>
              <button
                ref={refCerrar}
                type="button"
                className="boton-icono"
                onClick={cerrarMenu}
                aria-label="Cerrar menú"
              >
                <IconoCerrar />
              </button>
            </div>
            <Navegacion esAdmin={esAdmin} alNavegar={cerrarMenu} />
            <div className="sidebar-pie">
              {tarjetaUsuario(true)}
              <Acerca contexto={contexto} />
            </div>
          </aside>
        </div>
      ) : null}

      <main id="contenido" className="app-contenido">
        <div className="app-contenido-interior">
          {error && !contexto ? (
            <div className="aviso-config" role="alert">
              <span>No se pudo cargar la configuración institucional.</span>
              <button type="button" className="boton boton-secundario" onClick={recargar}>
                Reintentar
              </button>
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
