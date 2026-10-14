export function fragmentarPaginas(
  paginas: string[],
  palabras = 380,
  solape = 60,
): Array<{ pagina: number; texto: string }> {
  const salida: Array<{ pagina: number; texto: string }> = [];
  const paso = Math.max(1, palabras - solape);
  paginas.forEach((pagina, indice) => {
    const tokens = pagina.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (tokens.length < 40) return;
    for (let inicio = 0; inicio < tokens.length; inicio += paso) {
      const texto = tokens.slice(inicio, inicio + palabras).join(' ');
      if (texto.split(' ').length > 40) {
        salida.push({ pagina: indice + 1, texto });
      }
      if (inicio + palabras >= tokens.length) break;
    }
  });
  return salida;
}
