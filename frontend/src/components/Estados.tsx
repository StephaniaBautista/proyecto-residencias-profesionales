export function Cargando({ texto }: { texto: string }) {
  return <p role="status">{texto}</p>;
}

export function Fallo({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="aviso" role="alert">
      <p>{mensaje}</p>
      <button type="button" className="boton secundario oscuro" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="aviso neutro">{texto}</p>;
}
