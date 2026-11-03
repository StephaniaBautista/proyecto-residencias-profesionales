import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Última barrera de la interfaz: si una pantalla falla al pintarse muestra una
 * salida digna en lugar de una página en blanco. No enseña detalles técnicos.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Ayuda al diagnóstico en la consola del navegador; nunca se muestra al usuario.
    console.error('Error de renderizado', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="pantalla-error">
        <div className="aviso" role="alert">
          <h1>Algo falló al mostrar esta pantalla</h1>
          <p>
            Puedes volver al inicio y seguir trabajando. Si el problema continúa, avisa al equipo
            de soporte del prototipo.
          </p>
          <p className="acciones-error">
            <a className="boton" href="/inicio">
              Volver al inicio
            </a>
            <button
              type="button"
              className="boton boton-secundario"
              onClick={() => window.location.reload()}
            >
              Recargar la página
            </button>
          </p>
        </div>
      </div>
    );
  }
}
