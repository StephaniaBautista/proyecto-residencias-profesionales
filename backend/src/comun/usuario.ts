export const ROLES = ['tutor', 'coordinacion', 'asesoria', 'admin_tecnico'] as const;
export type Rol = (typeof ROLES)[number];

export type UsuarioSesion = {
  id: number;
  correo: string;
  nombre: string;
  rol: Rol;
};

export function esRol(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor);
}
