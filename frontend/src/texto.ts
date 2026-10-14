export type Nivel = 'verde' | 'amarillo' | 'rojo';
export type Rol = 'tutor' | 'coordinacion' | 'asesoria' | 'admin_tecnico';

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  verde: 'Verde',
  amarillo: 'Amarillo',
  rojo: 'Rojo',
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  tutor: 'Tutor',
  coordinacion: 'Coordinación',
  asesoria: 'Asesoría',
  admin_tecnico: 'Administración técnica',
};

export const ETIQUETA_ACCION: Record<string, string> = {
  entrevista_tutorial: 'Entrevista tutorial',
  asesoria_disciplinar: 'Asesoría disciplinar',
  taller: 'Taller de regularización',
  canalizacion_academica: 'Canalización académica',
  seguimiento: 'Seguimiento de acuerdos',
};

export const ETIQUETA_REVISION: Record<string, string> = {
  aprobada: 'Aprobada',
  requiere_ajuste: 'Requiere ajuste',
  informacion_insuficiente: 'Información insuficiente',
};

export const ETIQUETA_RIESGO: Record<string, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
};

export function fechaLegible(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = new Date(valor.length <= 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(fecha);
}

export function decimal(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(valor);
}
