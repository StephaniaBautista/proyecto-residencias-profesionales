import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ErrorApi, api, erroresDeCampos, mensajeError } from '../api';
import { useSesion, type Usuario } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { CampoPassword } from '../components/CampoPassword';
import { Cargando } from '../components/Estados';
import { AUTH_POR_DEFECTO, useContexto } from '../contexto';
import {
  POLITICA_PASSWORD,
  limpiarErrores,
  validarConfirmacion,
  validarCorreo,
  validarNombre,
  validarPassword,
} from '../validacion';

type ErroresRegistro = {
  nombre?: string;
  correo?: string;
  password?: string;
  password_confirmacion?: string;
};

export function Registro() {
  const { usuario, listo, entrar } = useSesion();
  const { contexto } = useContexto();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const refNombre = useRef<HTMLInputElement>(null);
  const refCorreo = useRef<HTMLInputElement>(null);
  const refPassword = useRef<HTMLInputElement>(null);
  const refConfirmacion = useRef<HTMLInputElement>(null);

  if (!listo) {
    return (
      <div className="pantalla-auth pantalla-auth-espera">
        <Cargando texto="Revisando la sesión…" />
      </div>
    );
  }
  if (usuario) return <Navigate to="/inicio" replace />;

  const auth = contexto?.auth ?? AUTH_POR_DEFECTO;

  if (!auth.registro) {
    return (
      <AuthLayout
        titulo="Crear cuenta"
        descripcion="El alta de cuentas la controla la institución."
        tituloDocumento="Crear cuenta"
      >
        <p className="aviso neutro">
          El registro de cuentas no está habilitado por la institución en este momento.
        </p>
        <p>
          <Link to="/ingreso">Volver al ingreso</Link>
        </p>
      </AuthLayout>
    );
  }

  function enfocarError(nuevos: ErroresRegistro) {
    if (nuevos.nombre) refNombre.current?.focus();
    else if (nuevos.correo) refCorreo.current?.focus();
    else if (nuevos.password) refPassword.current?.focus();
    else if (nuevos.password_confirmacion) refConfirmacion.current?.focus();
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    const nuevos = limpiarErrores({
      nombre: validarNombre(nombre),
      correo: validarCorreo(correo),
      password: validarPassword(password),
      password_confirmacion: validarConfirmacion(password, confirmacion),
    });
    setErrores(nuevos);
    enfocarError(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setEnviando(true);
    try {
      const datos = await api<{ usuario: Usuario }>('/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          correo: correo.trim(),
          password,
          password_confirmacion: confirmacion,
        }),
      });
      entrar(datos.usuario);
      navigate('/inicio');
    } catch (causa) {
      const deCampos = erroresDeCampos(causa);
      const porCampo: ErroresRegistro = {};
      if (deCampos.nombre) porCampo.nombre = deCampos.nombre;
      if (deCampos.correo) porCampo.correo = deCampos.correo;
      if (deCampos.password) porCampo.password = deCampos.password;
      if (deCampos.password_confirmacion) {
        porCampo.password_confirmacion = deCampos.password_confirmacion;
      }
      if (Object.keys(porCampo).length > 0) {
        setErrores(porCampo);
        enfocarError(porCampo);
      } else if (causa instanceof ErrorApi && causa.status === 409) {
        setErrores({ correo: causa.message });
        refCorreo.current?.focus();
      } else {
        setError(
          mensajeError(causa, 'No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.'),
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      titulo="Crear cuenta"
      descripcion="Crea tu cuenta para revisar la trayectoria y el seguimiento tutorial."
      tituloDocumento="Crear cuenta"
    >
      <form className="auth-form" onSubmit={(evento) => void onSubmit(evento)} noValidate>
        <div aria-live="polite" className="auth-mensajes">
          {error ? (
            <p className="aviso" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <label className="campo">
          <span>Nombre completo</span>
          <input
            ref={refNombre}
            type="text"
            autoComplete="name"
            maxLength={120}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            aria-invalid={Boolean(errores.nombre)}
            aria-describedby={errores.nombre ? 'error-registro-nombre' : undefined}
          />
          {errores.nombre ? (
            <p className="campo-error" id="error-registro-nombre" role="alert">
              {errores.nombre}
            </p>
          ) : null}
        </label>
        <label className="campo">
          <span>Correo institucional</span>
          <input
            ref={refCorreo}
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            aria-invalid={Boolean(errores.correo)}
            aria-describedby={errores.correo ? 'error-registro-correo' : undefined}
          />
          {errores.correo ? (
            <p className="campo-error" id="error-registro-correo" role="alert">
              {errores.correo}
            </p>
          ) : null}
        </label>
        <CampoPassword
          id="registro-password"
          etiqueta="Contraseña"
          valor={password}
          onChange={setPassword}
          autoComplete="new-password"
          ayuda={POLITICA_PASSWORD}
          error={errores.password}
          inputRef={refPassword}
        />
        <CampoPassword
          id="registro-confirmacion"
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
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <div className="auth-enlaces">
          <Link to="/ingreso">Ya tengo cuenta</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
