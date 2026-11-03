import { useEffect, useRef, useState } from 'react';

/**
 * Botón con confirmación inline para acciones sensibles (reentrenar,
 * recalcular). Mantiene aria-expanded y estado de carga.
 */
export function BotonConfirmacion({
  etiqueta,
  pregunta,
  etiquetaConfirmar,
  onConfirmar,
  cargando = false,
  variante = 'secundario',
}: {
  etiqueta: string;
  pregunta: string;
  etiquetaConfirmar: string;
  onConfirmar: () => void;
  cargando?: boolean;
  variante?: 'primario' | 'secundario';
}) {
  const [confirmando, setConfirmando] = useState(false);
  const refConfirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmando) refConfirmar.current?.focus();
  }, [confirmando]);

  if (!confirmando) {
    return (
      <button
        type="button"
        className={variante === 'primario' ? 'boton' : 'boton boton-secundario'}
        onClick={() => setConfirmando(true)}
        disabled={cargando}
        aria-busy={cargando}
      >
        {cargando ? `${etiqueta}…` : etiqueta}
      </button>
    );
  }

  return (
    <div className="confirmacion" role="group" aria-label={pregunta}>
      <p className="confirmacion-pregunta">{pregunta}</p>
      <div className="confirmacion-acciones">
        <button
          ref={refConfirmar}
          type="button"
          className="boton"
          onClick={() => {
            setConfirmando(false);
            onConfirmar();
          }}
          disabled={cargando}
          aria-busy={cargando}
        >
          {cargando ? `${etiquetaConfirmar}…` : etiquetaConfirmar}
        </button>
        <button
          type="button"
          className="boton boton-secundario"
          onClick={() => setConfirmando(false)}
          disabled={cargando}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
