# Apoyo tutorial · IT Tlalnepantla

Prototipo para que un tutor vea trayectoria académica sintética, un semáforo explicable, alertas, seguimiento y un asistente que solo responde con el Programa de Tutorías del TecNM.

El color lo calculan reglas fijas. El modelo de riesgo y el asistente no deciden.

## Arranque

1. Crea un proyecto en Supabase y copia el connection string del pooler (puerto 6543).
2. En `backend/`, copia `.env.example` a `.env` y completa `DATABASE_URL`, `JWT_SECRET` y, para el asistente, `OPENROUTER_API_KEY`.
3. Instala y prepara la base:

```bash
cd backend
npm install
npm run migrate
npm run seed
```

4. Levanta la API y la interfaz, en dos terminales:

```bash
cd backend && npm run start:dev
cd frontend && npm install && npm run dev
```

5. Abre `http://localhost:5173`. La contraseña de las cuentas de demostración es `Semaforo-demo-2026`.

La ingesta lee los PDF habilitados en `backend/corpus/fuentes-rag.json`. Primero puedes comprobar extracción y fragmentación sin servicios externos:

```bash
cd backend && npm run ingest -- --dry-run
```

La ingesta real llama a OpenRouter y escribe en la base configurada; tiene costo. Ejecútala cuando la clave y el destino de base estén confirmados:

```bash
cd backend && npm run ingest
```

El detalle está en [docs/instalacion.md](docs/instalacion.md). Las reglas del color están en [docs/reglas-semaforo.md](docs/reglas-semaforo.md).
