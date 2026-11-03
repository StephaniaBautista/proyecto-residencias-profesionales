export type Entorno = {
  databaseUrl: string;
  jwtSecret: string;
  origen: string;
  origenes: string[];
  puerto: number;
  openRouterKey: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensiones: number;
  umbralSimilitud: number;
  ragTopK: number;
  nodeEnv: string;
  demoMode: boolean;
  esProduccion: boolean;
  sesionHoras: number;
  trustProxy: boolean;
};

export function urlBaseDatos(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. Copia backend/.env.example a backend/.env y configura el PostgreSQL local o el pooler de Supabase.',
    );
  }
  return url;
}

export function leerEntorno(): Entorno {
  const nodeEnv = (process.env.NODE_ENV?.trim() || 'development').toLowerCase();
  const esProduccion = nodeEnv === 'production';
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  const minimoSecreto = esProduccion ? 32 : 16;
  if (jwtSecret.length < minimoSecreto) {
    throw new Error(`JWT_SECRET debe tener al menos ${minimoSecreto} caracteres en ${nodeEnv}.`);
  }
  const dimensiones = Number(process.env.EMBEDDING_DIMENSIONES ?? '1536');
  const umbral = Number(process.env.RAG_UMBRAL_SIMILITUD ?? '0.32');
  const ragTopK = Number(process.env.RAG_TOP_K ?? '4');
  const sesionHoras = Number(process.env.SESSION_HOURS ?? '8');
  if (!Number.isFinite(dimensiones) || dimensiones < 1) {
    throw new Error('EMBEDDING_DIMENSIONES no es válido.');
  }
  if (!Number.isFinite(umbral) || umbral < 0 || umbral > 1) {
    throw new Error('RAG_UMBRAL_SIMILITUD debe estar entre 0 y 1.');
  }
  if (!Number.isFinite(ragTopK) || ragTopK < 1 || ragTopK > 20) {
    throw new Error('RAG_TOP_K debe estar entre 1 y 20.');
  }
  if (!Number.isFinite(sesionHoras) || sesionHoras < 1 || sesionHoras > 72) {
    throw new Error('SESSION_HOURS debe estar entre 1 y 72.');
  }
  const demoEnv = process.env.DEMO_MODE?.trim().toLowerCase();
  const demoMode = demoEnv ? demoEnv === 'true' || demoEnv === '1' : !esProduccion;

  const origenesConfigurados = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((valor) => valor.trim())
    .filter(Boolean);
  const origen = origenesConfigurados[0] || 'http://localhost:5173';
  const origenes = new Set(origenesConfigurados.length ? origenesConfigurados : [origen]);
  if (!esProduccion) {
    // En desarrollo se acepta el mismo Vite por localhost, 127.0.0.1 e IPv6.
    for (const puerto of ['5173', '5174']) {
      origenes.add(`http://localhost:${puerto}`);
      origenes.add(`http://127.0.0.1:${puerto}`);
      origenes.add(`http://[::1]:${puerto}`);
    }
  }

  return {
    databaseUrl: urlBaseDatos(),
    jwtSecret,
    origen,
    origenes: [...origenes],
    puerto: Number(process.env.PORT ?? '3000'),
    openRouterKey: process.env.OPENROUTER_API_KEY?.trim() ?? '',
    chatModel: process.env.OPENROUTER_CHAT_MODEL?.trim() || 'deepseek/deepseek-chat',
    embeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || 'openai/text-embedding-3-small',
    embeddingDimensiones: dimensiones,
    umbralSimilitud: umbral,
    ragTopK,
    nodeEnv,
    demoMode,
    esProduccion,
    sesionHoras,
    trustProxy: process.env.TRUST_PROXY?.trim() === 'true' || esProduccion,
  };
}
