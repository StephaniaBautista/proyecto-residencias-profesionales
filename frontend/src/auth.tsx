import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, registrarSesionVencida } from './api';
import type { Rol } from './texto';

export type Usuario = {
  id: number | string;
  correo: string;
  nombre: string;
  rol: Rol;
};

type Sesion = {
  usuario: Usuario | null;
  listo: boolean;
  aviso: string;
  entrar: (usuario: Usuario) => void;
  salir: () => Promise<void>;
  limpiarAviso: () => void;
};

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState('');
  const usuarioRef = useRef<Usuario | null>(null);
  const saliendoRef = useRef(false);
  usuarioRef.current = usuario;

  const manejarVencimiento = useCallback(() => {
    // Si no había sesión (por ejemplo un 401 del propio ingreso) no hay nada que vencer.
    if (!usuarioRef.current) return;
    setUsuario(null);
    if (!saliendoRef.current) {
      setAviso('Tu sesión venció. Vuelve a entrar para continuar.');
    }
  }, []);

  useEffect(() => {
    registrarSesionVencida(manejarVencimiento);
    return () => registrarSesionVencida(null);
  }, [manejarVencimiento]);

  useEffect(() => {
    let vivo = true;
    api<{ usuario: Usuario }>('/api/auth/yo')
      .then((datos) => {
        if (vivo) setUsuario(datos.usuario);
      })
      .catch(() => {
        if (vivo) setUsuario(null);
      })
      .finally(() => {
        if (vivo) setListo(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const valor = useMemo<Sesion>(
    () => ({
      usuario,
      listo,
      aviso,
      entrar: (nuevo) => {
        setUsuario(nuevo);
        setAviso('');
      },
      salir: async () => {
        saliendoRef.current = true;
        try {
          await api('/api/auth/salir', { method: 'POST' });
        } catch {
          /* la cookie pudo haber vencido: de todos modos se cierra la sesión local */
        } finally {
          saliendoRef.current = false;
        }
        setUsuario(null);
        setAviso('');
      },
      limpiarAviso: () => setAviso(''),
    }),
    [usuario, listo, aviso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('Falta el proveedor de sesión.');
  return valor;
}
