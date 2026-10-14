import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Rol } from './texto';

export type Usuario = {
  id: number;
  correo: string;
  nombre: string;
  rol: Rol;
};

type Sesion = {
  usuario: Usuario | null;
  listo: boolean;
  entrar: (usuario: Usuario) => void;
  salir: () => Promise<void>;
};

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);

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
      entrar: setUsuario,
      salir: async () => {
        try {
          await api('/api/auth/salir', { method: 'POST' });
        } catch {
          /* la cookie puede haber vencido */
        }
        setUsuario(null);
      },
    }),
    [usuario, listo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('Falta el proveedor de sesión.');
  return valor;
}
