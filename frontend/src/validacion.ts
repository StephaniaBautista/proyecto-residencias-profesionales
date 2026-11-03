const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

export const POLITICA_PASSWORD = 'Mínimo 10 caracteres, con al menos una letra y un número.';

export function correoValido(valor: string): boolean {
  return PATRON_CORREO.test(valor.trim());
}

export function validarCorreo(valor: string): string | null {
  if (!valor.trim()) return 'Escribe tu correo.';
  return correoValido(valor) ? null : 'Escribe un correo válido.';
}

export function validarNombre(valor: string): string | null {
  const limpio = valor.trim();
  if (limpio.length < 3) return 'Escribe tu nombre completo (mínimo 3 caracteres).';
  if (limpio.length > 120) return 'El nombre admite como máximo 120 caracteres.';
  return null;
}

export function validarPassword(valor: string): string | null {
  if (!valor) return 'Escribe una contraseña.';
  if (valor.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (!PATRON_LETRA.test(valor)) return 'La contraseña debe incluir al menos una letra.';
  if (!/\d/.test(valor)) return 'La contraseña debe incluir al menos un número.';
  return null;
}

export function validarConfirmacion(password: string, confirmacion: string): string | null {
  if (!confirmacion) return 'Confirma la contraseña.';
  if (password !== confirmacion) return 'Las contraseñas no coinciden.';
  return null;
}

/** Quita los errores vacíos para decidir si hay algo que pintar. */
export function limpiarErrores(errores: Record<string, string | null | undefined>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [campo, detalle] of Object.entries(errores)) {
    if (detalle) salida[campo] = detalle;
  }
  return salida;
}
