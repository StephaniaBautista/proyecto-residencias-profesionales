import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useSesion } from './auth';
import { Shell } from './components/Shell';
import { Cargando } from './components/Estados';
import { Acceso } from './pages/Acceso';
import { Administracion } from './pages/Administracion';
import { Alertas } from './pages/Alertas';
import { Asistente } from './pages/Asistente';
import { Estudiantes } from './pages/Estudiantes';
import { Ficha } from './pages/Ficha';
import { Inicio } from './pages/Inicio';
import { Recuperar } from './pages/Recuperar';
import { Registro } from './pages/Registro';
import { Restablecer } from './pages/Restablecer';

export function App() {
  return (
    <Routes>
      <Route path="/ingreso" element={<Acceso />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/restablecer" element={<Restablecer />} />

      <Route element={<RutaPrivada />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/estudiantes" element={<Estudiantes />} />
        <Route path="/estudiantes/:id" element={<Ficha />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/asistente" element={<Asistente />} />
        <Route path="/administracion" element={<SoloAdmin />} />
      </Route>

      {/* Rutas anteriores: redirigen conservando la cadena de consulta. */}
      <Route path="/tablero" element={<Redirigir a="/inicio" />} />
      <Route path="/tutorados" element={<Redirigir a="/estudiantes" />} />
      <Route path="/tutorados/:id" element={<RedirigirFicha />} />
      <Route path="/consulta" element={<Redirigir a="/asistente" />} />
      <Route path="/tecnica" element={<Redirigir a="/administracion" />} />

      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}

function RutaPrivada() {
  const { usuario, listo } = useSesion();
  if (!listo) return <Cargando texto="Revisando la sesión…" />;
  if (!usuario) return <Navigate to="/ingreso" replace />;
  return <Shell />;
}

function SoloAdmin() {
  const { usuario } = useSesion();
  if (usuario?.rol !== 'admin_tecnico') return <Navigate to="/inicio" replace />;
  return <Administracion />;
}

function Redirigir({ a }: { a: string }) {
  const { search } = useLocation();
  return <Navigate to={`${a}${search}`} replace />;
}

function RedirigirFicha() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/estudiantes/${encodeURIComponent(id)}${search}`} replace />;
}
