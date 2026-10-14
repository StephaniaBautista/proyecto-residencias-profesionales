import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSesion, type Usuario } from '../auth';

const PASSWORD_DEMO = 'Semaforo-demo-2026';
const CUENTAS = [
  ['Tutor A y B', 'tutor@ittla.demo'],
  ['Tutor C', 'tutor.c@ittla.demo'],
  ['Coordinación', 'coordinacion@ittla.demo'],
  ['Asesoría', 'asesoria@ittla.demo'],
  ['Administración técnica', 'admin@ittla.demo'],
] as const;

export function Acceso() {
  const { usuario, listo, entrar } = useSesion();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('tutor@ittla.demo');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!listo) return <p className="acceso-form" role="status">Revisando la sesión…</p>;
  if (usuario) return <Navigate to="/tablero" replace />;

  async function entrarCon(cuenta: string, clave: string) {
    setEnviando(true);
    setError('');
    try {
      const datos = await api<{ usuario: Usuario }>('/api/auth/ingreso', {
        method: 'POST',
        body: JSON.stringify({ correo: cuenta, password: clave }),
      });
      entrar(datos.usuario);
      navigate('/tablero');
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo entrar.');
    } finally {
      setEnviando(false);
    }
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    await entrarCon(correo, password);
  }

  return (
    <div className="rejilla-acceso">
      <section className="acceso-texto">
        <p className="kicker">TecNM · Instituto Tecnológico de Tlalnepantla</p>
        <h1>Apoyo para leer la trayectoria y decidir el acompañamiento.</h1>
        <p>
          El semáforo sale de reglas escritas. El modelo y el asistente normativo proponen; la decisión queda en el tutor.
          Esta demostración usa solo registros ficticios.
        </p>
      </section>
      <form className="acceso-form" onSubmit={(evento) => void onSubmit(evento)}>
        <h2>Entrar</h2>
        {error ? (
          <p className="aviso" role="alert">
            {error}
          </p>
        ) : null}
        <label className="campo">
          <span>Correo</span>
          <input type="email" autoComplete="username" value={correo} onChange={(evento) => setCorreo(evento.target.value)} required />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            required
          />
        </label>
        <button className="boton" type="submit" disabled={enviando} data-state={enviando ? 'loading' : 'default'}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <div>
          <h3>Cuentas de demostración</h3>
          <div className="cuentas">
            {CUENTAS.map(([nombre, cuenta]) => (
              <div key={cuenta}>
                <span>{nombre}</span>
                <button type="button" className="boton secundario oscuro" disabled={enviando} onClick={() => void entrarCon(cuenta, PASSWORD_DEMO)}>
                  {nombre}
                </button>
              </div>
            ))}
          </div>
          <p>Contraseña compartida de la semilla: {PASSWORD_DEMO}</p>
        </div>
      </form>
    </div>
  );
}
