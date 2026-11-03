import { useRef, useState, type RefObject } from 'react';
import { IconoOjo, IconoOjoTachado } from './Iconos';

/**
 * Campo de contraseña con máscara, autocompletado correcto y botón
 * accesible para mostrar u ocultar el valor.
 */
export function CampoPassword({
  id,
  etiqueta,
  valor,
  onChange,
  autoComplete,
  error,
  ayuda,
  inputRef,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  ayuda?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const refInterno = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? refInterno;
  const descrito =
    [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-password">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete={autoComplete}
          value={valor}
          onChange={(evento) => onChange(evento.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={descrito}
        />
        <button
          type="button"
          className="campo-ver"
          onClick={() => setVisible((actual) => !actual)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <IconoOjoTachado /> : <IconoOjo />}
        </button>
      </div>
      {ayuda ? (
        <span className="campo-ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </span>
      ) : null}
      {error ? (
        <p className="campo-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
