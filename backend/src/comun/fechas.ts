export function fechaCorta(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

export function numero(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
}
