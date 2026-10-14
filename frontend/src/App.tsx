import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './auth';
import { Shell } from './components/Shell';
import { Cargando } from './components/Estados';
import { Acceso } from './pages/Acceso';
import { Alertas } from './pages/Alertas';
import { Consulta } from './pages/Consulta';
import { Ficha } from './pages/Ficha';
import { Tablero } from './pages/Tablero';
import { Tecnica } from './pages/Tecnica';
import { Tutorados } from './pages/Tutorados';

export function App() {
  return (
    <Routes>
      <Route path="/ingreso" element={<Acceso />} />
      <Route element={<RutaPrivada />}>
        <Route path="/tablero" element={<Tablero />} />
        <Route path="/tutorados" element={<Tutorados />} />
        <Route path="/tutorados/:id" element={<Ficha />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/consulta" element={<Consulta />} />
        <Route path="/tecnica" element={<SoloAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/tablero" replace />} />
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
  if (usuario?.rol !== 'admin_tecnico') return <Navigate to="/tablero" replace />;
  return <Tecnica />;
}
