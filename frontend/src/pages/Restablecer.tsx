import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorApi, api, erroresDeCampos, mensajeError } from '../api';
import { AuthLayout } from '../components/AuthLayout';
import { CampoPassword } from '../components/CampoPassword';
import {
  POLITICA_PASSWORD,
  limpiarErrores,
  validarConfirmacion,
  validarPassword,
} from '../validacion';

type ErroresRestablecer = { password?: string; password_confirmacion?: string };

export function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<ErroresRestablecer>({});
  const [error, setError] = useState('');
  const [errorToken, setErrorToken] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refPassword = useRef<HTMLInputElement>(null);
  const refConfirmacion = useRef<HTMLInputElement>(null);

  if (!token) {
    return (
      <AuthLayout
        titulo="Restablecer contraseña"
        descripcion="Necesitas un enlace vigente para elegir una nueva contraseña."
        tituloDocumento="Restablecer contraseña"
      >
        <p className="aviso" role="alert">
          El enlace no incluye un token válido o ya se usó. Solicita uno nuevo para continuar.
        </p>
        <div className="auth-enlaces">
          <Link className="boton" to="/recuperar">
            Solicitar un enlace nuevo
          </Link>
          <Link to="/ingreso">Volver al ingreso</Link>
        </div>
      </AuthLayout>
    );
  }

  if (exito) {
    return (
      <AuthLayout
        titulo="Restablecer contraseña"
        descripcion="Tu contraseña se actualizó."
        tituloDocumento="Restablecer contraseña"
      >
        <div className="auth-exito" aria-live="polite">
          <p className="aviso ok" role="status">
            {exito}
          </p>
          <Link className="boton" to="/ingreso">
            Volver al ingreso
          </Link>
        </div>
      </AuthLayout>
    );
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setErrorToken(false);
    const nuevos = limpiarErrores({
      password: validarPassword(password),
      password_confirmacion: validarConfirmacion(password, confirmacion),
    });
    setErrores(nuevos);
    if (nuevos.password) refPassword.current?.focus();
    else if (nuevos.password_confirmacion) refConfirmacion.current?.focus();
    if (Object.keys(nuevos).length > 0) return;

    setEnviando(true);
    try {
      const datos = await api<{ ok?: boolean; mensaje?: string }>('/api/auth/restablecer', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password,
          password_confirmacion: confirmacion,
        }),
      });
      setExito(datos.mensaje || 'Tu contraseña se actualizó. Ya puedes iniciar sesión.');
    } catch (causa) {
      const deCampos = erroresDeCampos(causa);
      if (deCampos.token) {
        // El enlace no sirve: se muestra el estado de token inválido con salida a /recuperar.
        setError(deCampos.token);
        setErrorToken(true);
        return;
      }
      const porCampo: ErroresRestablecer = {};
      if (deCampos.password) porCampo.password = deCampos.password;
      if (deCampos.password_confirmacion) {
        porCampo.password_confirmacion = deCampos.password_confirmacion;
      }
      if (Object.keys(porCampo).length > 0) {
        setErrores(porCampo);
        if (porCampo.password) refPassword.current?.focus();
        else refConfirmacion.current?.focus();
      } else {
        setError(mensajeError(causa, 'No se pudo restablecer la contraseña. Intenta de nuevo.'));
        if (causa instanceof ErrorApi && causa.status === 400) setErrorToken(true);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      titulo="Restablecer contraseña"
      descripcion="Elige una contraseña nueva para tu cuenta."
      tituloDocumento="Restablecer contraseña"
    >
      <form className="auth-form" onSubmit={(evento) => void onSubmit(evento)} noValidate>
        <div aria-live="polite" className="auth-mensajes">
          {error ? (
            <p className="aviso" role="alert">
              {error}
            </p>
          ) : null}
          {errorToken ? (
            <p>
              <Link to="/recuperar">Solicitar un enlace nuevo</Link>
            </p>
          ) : null}
        </div>
        <CampoPassword
          id="restablecer-password"
          etiqueta="Nueva contraseña"
          valor={password}
          onChange={setPassword}
          autoComplete="new-password"
          ayuda={POLITICA_PASSWORD}
          error={errores.password}
          inputRef={refPassword}
        />
        <CampoPassword
          id="restablecer-confirmacion"
          etiqueta="Confirmar contraseña"
          valor={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
          error={errores.password_confirmacion}
          inputRef={refConfirmacion}
        />
        <button
          className="boton"
          type="submit"
          disabled={enviando}
          data-state={enviando ? 'loading' : 'default'}
          aria-busy={enviando}
        >
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <div className="auth-enlaces">
          <Link to="/ingreso">Volver al ingreso</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
