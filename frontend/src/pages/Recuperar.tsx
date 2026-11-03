import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, erroresDeCampos, mensajeError } from '../api';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_POR_DEFECTO, useContexto } from '../contexto';
import { limpiarErrores, validarCorreo } from '../validacion';

type RespuestaRecuperacion = {
  mensaje?: string;
  token?: string;
  expira_en_minutos?: number;
};

type Resultado = {
  mensaje: string;
  token?: string;
  expira?: number;
};

export function Recuperar() {
  const { contexto } = useContexto();
  const [correo, setCorreo] = useState('');
  const [errores, setErrores] = useState<{ correo?: string }>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const refCorreo = useRef<HTMLInputElement>(null);
  const auth = contexto?.auth ?? AUTH_POR_DEFECTO;

  if (!auth.recuperacion) {
    return (
      <AuthLayout
        titulo="Recuperar contraseña"
        descripcion="La recuperación la controla la institución."
        tituloDocumento="Recuperar contraseña"
      >
        <p className="aviso neutro">
          La recuperación de contraseña no está habilitada por la institución en este momento.
        </p>
        <p>
          <Link to="/ingreso">Volver al ingreso</Link>
        </p>
      </AuthLayout>
    );
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    const nuevos = limpiarErrores({ correo: validarCorreo(correo) });
    setErrores(nuevos);
    if (nuevos.correo) {
      refCorreo.current?.focus();
      return;
    }

    setEnviando(true);
    try {
      const datos = await api<RespuestaRecuperacion>('/api/auth/recuperar', {
        method: 'POST',
        body: JSON.stringify({ correo: correo.trim() }),
      });
      setResultado({
        mensaje: datos.mensaje || 'Si el correo está registrado, enviamos instrucciones.',
        token: datos.token,
        expira: datos.expira_en_minutos,
      });
    } catch (causa) {
      const deCampos = erroresDeCampos(causa);
      if (deCampos.correo) {
        setErrores({ correo: deCampos.correo });
        refCorreo.current?.focus();
      } else {
        setError(
          mensajeError(
            causa,
            'No se pudieron enviar las instrucciones. Intenta de nuevo en unos minutos.',
          ),
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      titulo="Recuperar contraseña"
      descripcion="Escribe tu correo y te enviamos las instrucciones para elegir una nueva contraseña."
      tituloDocumento="Recuperar contraseña"
    >
      {resultado ? (
        <div className="auth-exito" aria-live="polite">
          <p className="aviso ok" role="status">
            {resultado.mensaje}
          </p>
          {resultado.token ? (
            <>
              <p className="auth-ayuda">
                El enlace para cambiar la contraseña vence en {resultado.expira ?? 30} minutos.
              </p>
              <Link
                className="boton"
                to={`/restablecer?token=${encodeURIComponent(resultado.token)}`}
              >
                Continuar con el cambio de contraseña
              </Link>
            </>
          ) : (
            <p className="auth-ayuda">
              Revisa tu correo y sigue las instrucciones. Si no llega en unos minutos, contacta a
              coordinación.
            </p>
          )}
          <div className="auth-enlaces">
            <Link to="/ingreso">Volver al ingreso</Link>
          </div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={(evento) => void onSubmit(evento)} noValidate>
          <div aria-live="polite" className="auth-mensajes">
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
              autoComplete="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              aria-invalid={Boolean(errores.correo)}
              aria-describedby={errores.correo ? 'error-recuperar-correo' : undefined}
            />
            {errores.correo ? (
              <p className="campo-error" id="error-recuperar-correo" role="alert">
                {errores.correo}
              </p>
            ) : null}
          </label>
          <button
            className="boton"
            type="submit"
            disabled={enviando}
            data-state={enviando ? 'loading' : 'default'}
            aria-busy={enviando}
          >
            {enviando ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
          <div className="auth-enlaces">
            <Link to="/ingreso">Volver al ingreso</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
