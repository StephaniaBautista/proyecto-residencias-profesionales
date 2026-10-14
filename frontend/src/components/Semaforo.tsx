import { ETIQUETA_NIVEL, type Nivel } from '../texto';

export function Semaforo({ nivel }: { nivel: Nivel }) {
  return <span className={`marca ${nivel}`}>{ETIQUETA_NIVEL[nivel]}</span>;
}
