import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, erroresDeCampos, mensajeError } from '../api';
import { useSesion, type Usuario } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { CampoPassword } from '../components/CampoPassword';
import { Cargando } from '../components/Estados';
import { AUTH_POR_DEFECTO, useContexto } from '../contexto';
import { limpiarErrores, validarCorreo } from '../validacion';

type ErroresAcceso = { correo?: string; password?: string };

export function Acceso() {
  const { usuario, listo, entrar, aviso, limpiarAviso } = useSesion();
  const { contexto } = useContexto();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<ErroresAcceso>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const refCorreo = useRef<HTMLInputElement>(null);
  const refPassword = useRef<HTMLInputElement>(null);

  if (!listo) {
    return (
      <div className="pantalla-auth pantalla-auth-espera">
        <Cargando texto="Revisando la sesión…" />
      </div>
    );
  }
  if (usuario) return <Navigate to="/inicio" replace />;

  const auth = contexto?.auth ?? AUTH_POR_DEFECTO;

  function enfocarError(nuevos: ErroresAcceso) {
    if (nuevos.correo) refCorreo.current?.focus();
    else if (nuevos.password) refPassword.current?.focus();
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    limpiarAviso();
    setError('');
    const nuevos = limpiarErrores({
      correo: validarCorreo(correo),
      password: password ? null : 'Escribe tu contraseña.',
    });
    setErrores(nuevos);
    enfocarError(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setEnviando(true);
    try {
      const datos = await api<{ usuario: Usuario }>('/api/auth/ingreso', {
        method: 'POST',
        body: JSON.stringify({ correo: correo.trim(), password }),
      });
      entrar(datos.usuario);
      navigate('/inicio');
    } catch (causa) {
      const deCampos = erroresDeCampos(causa);
      const porCampo: ErroresAcceso = {};
      if (deCampos.correo) porCampo.correo = deCampos.correo;
      if (deCampos.password) porCampo.password = deCampos.password;
      if (Object.keys(porCampo).length > 0) {
        setErrores(porCampo);
        enfocarError(porCampo);
      } else {
        setError(mensajeError(causa, 'No se pudo iniciar sesión. Revisa tus datos e intenta de nuevo.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      titulo="Iniciar sesión"
      descripcion="Accede con tu cuenta para revisar la trayectoria y el seguimiento tutorial."
      tituloDocumento="Iniciar sesión"
    >
      <form className="auth-form" onSubmit={(evento) => void onSubmit(evento)} noValidate>
        <div aria-live="polite" className="auth-mensajes">
          {aviso ? (
            <p className="aviso" role="alert">
              {aviso}
            </p>
          ) : null}
          {error ? (
            <p className="aviso" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <label className="campo">
          <span>Correo institucional</span>
          <input
            ref={refCorreo}
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            aria-invalid={Boolean(errores.correo)}
            aria-describedby={errores.correo ? 'error-acceso-correo' : undefined}
          />
          {errores.correo ? (
            <p className="campo-error" id="error-acceso-correo" role="alert">
              {errores.correo}
            </p>
          ) : null}
        </label>
        <CampoPassword
          id="acceso-password"
          etiqueta="Contraseña"
          valor={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={errores.password}
          inputRef={refPassword}
        />
        <button
          className="boton"
          type="submit"
          disabled={enviando}
          data-state={enviando ? 'loading' : 'default'}
          aria-busy={enviando}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        {auth.recuperacion || auth.registro ? (
          <div className="auth-enlaces">
            {auth.recuperacion ? <Link to="/recuperar">¿Olvidaste tu contraseña?</Link> : null}
            {auth.registro ? <Link to="/registro">Crear cuenta</Link> : null}
          </div>
        ) : null}
      </form>
    </AuthLayout>
  );
}
