export type Nivel = 'verde' | 'amarillo' | 'rojo' | 'informacion_insuficiente' | 'inconsistencia';
export type Rol = 'tutor' | 'coordinacion' | 'asesoria' | 'admin_tecnico';

export const NIVELES: readonly Nivel[] = [
  'verde',
  'amarillo',
  'rojo',
  'informacion_insuficiente',
  'inconsistencia',
];

export function esNivel(valor: string | null | undefined): valor is Nivel {
  return valor !== null && valor !== undefined && (NIVELES as readonly string[]).includes(valor);
}

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  verde: 'Verde',
  amarillo: 'Amarillo',
  rojo: 'Rojo',
  informacion_insuficiente: 'Información insuficiente',
  inconsistencia: 'Inconsistencia',
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

export const ETIQUETA_ESTATUS_ACCION: Record<string, string> = {
  en_seguimiento: 'En seguimiento',
  cumplida: 'Cumplida',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

export const ETIQUETA_ACUERDO: Record<string, string> = {
  pendiente: 'Pendiente',
  cumplido: 'Cumplido',
  vencido: 'Vencido',
};

export const ETIQUETA_PRIORIDAD: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
};

export const ETIQUETA_SENAL_CORTA: Record<string, string> = {
  'RA-01': 'Todo acreditado',
  'RA-02': '1 reprobada',
  'RA-03': '2 reprobadas',
  'RA-04': '3+ reprobadas',
  'RA-05': 'Parciales',
  'RA-06': 'Curso especial',
  'RA-07': 'Sin datos',
  'RA-08': 'Antecedente',
  'SIS-INC': 'Inconsistencia',
};

export const ETIQUETA_ALERTA_TIPO: Record<string, string> = {
  rojo_sin_revision: 'Rojo sin revisión',
  accion_por_vencer: 'Compromiso por vencer',
  datos_incompletos: 'Datos incompletos',
  inconsistencia_datos: 'Inconsistencia de datos',
};

export const ETIQUETA_RESULTADO: Record<string, string> = {
  aprobado: 'Aprobado',
  reprobado: 'Reprobado',
  sin_registro: 'Sin registro',
};

export const ETIQUETA_TIPO_APOYO: Record<string, string> = {
  asesoria: 'Asesoría',
  taller: 'Taller',
  curso_especial: 'Curso especial',
  canalizacion: 'Canalización',
  orientacion: 'Orientación',
  tutoria: 'Tutoría',
  acompanamiento: 'Acompañamiento',
};

export const ETIQUETA_FUENTE: Record<string, string> = {
  sintetico: 'Sintético',
  generado_sinteticamente: 'Generado sintéticamente',
  manual: 'Captura manual',
  importado: 'Importado',
  institucional: 'Institucional',
};

export const ETIQUETA_ALGORITMO: Record<string, string> = {
  arbol: 'Árbol de decisión',
  bosque: 'Bosque aleatorio',
  regresion_logistica: 'Regresión logística',
};

export const ETIQUETA_OPERACION: Record<string, string> = {
  ingreso: 'Ingreso',
  ingreso_demo: 'Ingreso de demostración',
  salir: 'Cierre de sesión',
  crear_accion: 'Alta de acción',
  cerrar_accion: 'Cierre de acción',
  revisar_ficha: 'Revisión de ficha',
  consultar_rag: 'Consulta normativa',
  entrenar_modelo: 'Entrenamiento del modelo',
  atender_alerta: 'Alerta atendida',
};

export const ETIQUETA_ENTIDAD: Record<string, string> = {
  usuario: 'Usuario',
  accion_tutorial: 'Acción tutorial',
  revision_ficha: 'Revisión de ficha',
  consulta_rag: 'Consulta normativa',
  modelo_riesgo: 'Modelo de riesgo',
  alerta: 'Alerta',
  trayectoria_periodo: 'Trayectoria del periodo',
};

export const ETIQUETA_ESTADO_DATOS: Record<string, string> = {
  clasificado: 'Datos clasificados',
  informacion_insuficiente: 'Información insuficiente',
  inconsistencia: 'Inconsistencia de datos',
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

/** Escribe un valor de dominio con nombre legible; nunca deja ver un enum crudo. */
export function etiqueta(
  mapa: Record<string, string>,
  valor: string | null | undefined,
  respaldo = '—',
): string {
  if (valor === null || valor === undefined || valor.trim() === '') return respaldo;
  return mapa[valor] ?? humanizarEnum(valor);
}

export function humanizarEnum(valor: string): string {
  const texto = valor.replace(/_/g, ' ').trim();
  if (!texto) return '—';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function etiquetaTipoModelo(tipo: string | null | undefined): string {
  if (tipo === 'predictivo') return 'Modelo predictivo';
  if (tipo === 'explicador') return 'Explicador de reglas (demostración)';
  return 'Modelo de apoyo';
}

export function fechaLegible(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = new Date(valor.length <= 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(fecha);
}

/** Número decimal con guion cuando el dato no existe: nunca se inventa un cero. */
export function decimal(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(valor);
}

/** Cantidad entera con guion cuando el dato no existe. */
export function entero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('es-MX').format(valor);
}
