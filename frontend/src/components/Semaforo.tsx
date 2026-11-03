import { ETIQUETA_NIVEL, esNivel, humanizarEnum } from '../texto';

/**
 * Marca del semáforo. Acepta cualquier nivel del contrato y, si llegara un
 * valor desconocido, lo humaniza en gris en lugar de pintar el enum crudo.
 */
export function Semaforo({ nivel }: { nivel: string }) {
  const conocido = esNivel(nivel) ? nivel : null;
  return (
    <span className={`marca ${conocido ?? 'neutro'}`}>
      {conocido ? ETIQUETA_NIVEL[conocido] : humanizarEnum(nivel)}
    </span>
  );
}
