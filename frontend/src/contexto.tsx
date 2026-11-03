import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, mensajeError } from './api';

export type Institucion = {
  clave: string;
  nombre: string;
  nombre_corto: string;
};

export type PeriodoAcademico = {
  clave: string;
  nombre: string;
  activo: boolean;
  cerrado: boolean;
};

export type Grupo = {
  clave: string;
  nombre: string;
};

export type Carrera = {
  clave: string;
  nombre: string;
};

export type ConfiguracionAuth = {
  registro: boolean;
  recuperacion: boolean;
};

export type Contexto = {
  institucion: Institucion;
  periodo_activo: string;
  periodos: PeriodoAcademico[];
  grupos: Grupo[];
  carreras: Carrera[];
  demo: boolean;
  prototipo: boolean;
  version_reglas: string | null;
  banner: string;
  auth?: ConfiguracionAuth;
  rag: { habilitado: boolean; motivo: string | null };
  leyendas: { semaforo: string; modelo: string };
};

/** Mientras el backend no publique banderas, se ofrecen ambos flujos. */
export const AUTH_POR_DEFECTO: ConfiguracionAuth = { registro: true, recuperacion: true }; 

type EstadoContexto = {
  contexto: Contexto | null;
  cargando: boolean;
  error: string;
  recargar: () => void;
};

const ContextoApp = createContext<EstadoContexto | null>(null);

export function ProveedorContexto({ children }: { children: ReactNode }) {
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    api<Contexto>('/api/contexto')
      .then((datos) => {
        if (vivo) setContexto(datos);
      })
      .catch((causa: unknown) => {
        if (vivo) setError(mensajeError(causa, 'No se pudo cargar la configuración institucional.'));
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  const valor = useMemo<EstadoContexto>(
    () => ({ contexto, cargando, error, recargar }),
    [contexto, cargando, error, recargar],
  );

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>;
}

export function useContexto(): EstadoContexto {
  const valor = useContext(ContextoApp);
  if (!valor) throw new Error('Falta el proveedor de contexto institucional.');
  return valor;
}

/** Periodo de la URL si existe en el catálogo; si no, el periodo activo. */
export function periodoValido(contexto: Contexto | null, valor: string | null): string {
  if (!contexto) return '';
  const periodos = contexto.periodos ?? [];
  if (valor && periodos.some((periodo) => periodo.clave === valor)) return valor;
  return contexto.periodo_activo;
}

/** Grupo de la URL si existe en el catálogo; si no, sin filtro. */
export function grupoValido(contexto: Contexto | null, valor: string | null): string {
  if (!contexto || !valor) return '';
  const grupos = contexto.grupos ?? [];
  return grupos.some((grupo) => grupo.clave === valor) ? valor : '';
}

export function nombrePeriodo(contexto: Contexto | null, clave: string): string {
  const periodo = contexto?.periodos?.find((item) => item.clave === clave);
  return periodo?.nombre || clave;
}
