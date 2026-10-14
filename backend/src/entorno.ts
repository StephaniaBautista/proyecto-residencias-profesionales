export type Entorno = {
  databaseUrl: string;
  jwtSecret: string;
  origen: string;
  puerto: number;
  openRouterKey: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensiones: number;
  umbralSimilitud: number;
};

export function urlBaseDatos(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Falta DATABASE_URL. Copia backend/.env.example a backend/.env y completa el pooler de Supabase.');
  }
  return url;
}

export function leerEntorno(): Entorno {
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET debe tener al menos 16 caracteres.');
  }
  const dimensiones = Number(process.env.EMBEDDING_DIMENSIONES ?? '1536');
  const umbral = Number(process.env.RAG_UMBRAL_SIMILITUD ?? '0.32');
  if (!Number.isFinite(dimensiones) || dimensiones < 1) {
    throw new Error('EMBEDDING_DIMENSIONES no es válido.');
  }
  if (!Number.isFinite(umbral) || umbral < 0 || umbral > 1) {
    throw new Error('RAG_UMBRAL_SIMILITUD debe estar entre 0 y 1.');
  }
  return {
    databaseUrl: urlBaseDatos(),
    jwtSecret,
    origen: process.env.FRONTEND_ORIGIN?.trim() || 'http://localhost:5173',
    puerto: Number(process.env.PORT ?? '3000'),
    openRouterKey: process.env.OPENROUTER_API_KEY?.trim() ?? '',
    chatModel: process.env.OPENROUTER_CHAT_MODEL?.trim() || 'deepseek/deepseek-chat',
    embeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || 'openai/text-embedding-3-small',
    embeddingDimensiones: dimensiones,
    umbralSimilitud: umbral,
  };
}
