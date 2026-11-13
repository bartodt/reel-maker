/** Aplica `fn` a cada elemento con como mucho `limite` a la vez. Devuelve los resultados en el orden original. */
export async function enParalelo<T, R>(items: T[], limite: number, fn: (item: T, indice: number) => Promise<R>): Promise<R[]> {
  const resultado: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultado[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, trabajador));
  return resultado;
}
