# Instalar el prototipo

Queda una API en NestJS y una interfaz en React. La base es PostgreSQL de Supabase, con pgvector. No hace falta Docker.

## 1. Supabase

Crea el proyecto. En Database → Connection string elige el pooler en modo transacción (puerto 6543). La API desactiva prepared statements para poder usar ese modo.

pgvector ya viene en Supabase. La migración ejecuta `create extension if not exists vector with schema extensions`.

## 2. Variables

En `backend/.env`:

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Pooler de Supabase. No la pongas en el frontend. |
| `JWT_SECRET` | Firma la cookie de sesión. Mínimo 16 caracteres. |
| `OPENROUTER_API_KEY` | Solo la ingesta y la consulta normativa. |
| `OPENROUTER_CHAT_MODEL` | DeepSeek o MiMo, por ejemplo `deepseek/deepseek-chat`. |
| `OPENROUTER_EMBEDDING_MODEL` | Debe devolver 1536 dimensiones. El valor de ejemplo es `openai/text-embedding-3-small`. |
| `RAG_UMBRAL_SIMILITUD` | Si el mejor fragmento queda debajo, el asistente se abstiene. |

## 3. Comandos

Desde `backend/`:

```bash
npm install
npm run migrate
npm run seed
npm run start:dev
```

Desde `frontend/`:

```bash
npm install
npm run dev
```

La interfaz llama a `/api` y Vite lo reenvía a `http://localhost:3000`. La sesión va en una cookie `HttpOnly`, no en `localStorage`.

## 4. Corpus

`backend/corpus/fuentes-rag.json` es la lista de fuentes habilitadas. Solo admite nombres de PDF dentro de `backend/corpus/`; el título y emisor de cada fuente se muestran en las citas. Las leyendas de título aclaran si una fuente es antecedente o si su vigencia para ITTLA está por validar.

Primero revisa la extracción y el número de fragmentos sin llamar a OpenRouter ni modificar la base:

```bash
npm run ingest -- --dry-run
```

La ingesta real genera embeddings y reemplaza, en una transacción, únicamente las fuentes incluidas en el manifiesto. Llama a OpenRouter y escribe en la base configurada; no la ejecutes en cada arranque.

## 5. Pruebas sin base

```bash
cd backend && npm test
```

Cubren el semáforo, la comparación de modelos y la abstención del asistente. No llaman a OpenRouter.
