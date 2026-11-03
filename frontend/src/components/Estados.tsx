import type { ReactNode } from 'react';

export function Cargando({ texto }: { texto: string }) {
  return (
    <p className="estado-cargando" role="status">
      {texto}
    </p>
  );
}

export function Fallo({
  mensaje,
  onReintentar,
  children,
}: {
  mensaje: string;
  onReintentar: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="estado-error" role="alert">
      <p>{mensaje}</p>
      <div>
        <button type="button" className="boton boton-secundario" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
      {children}
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="estado-vacio">{texto}</p>;
}
