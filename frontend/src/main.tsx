import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProveedorSesion } from './auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProveedorContexto } from './contexto';
import './styles.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No está el nodo root.');

createRoot(raiz).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ProveedorContexto>
          <ProveedorSesion>
            <App />
          </ProveedorSesion>
        </ProveedorContexto>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
