const marcas = new Map<string, number[]>();

export function permitir(clave: string, maximo: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const recientes = (marcas.get(clave) ?? []).filter((marca) => ahora - marca < ventanaMs);
  if (recientes.length >= maximo) {
    marcas.set(clave, recientes);
    return false;
  }
  recientes.push(ahora);
  marcas.set(clave, recientes);
  return true;
}
