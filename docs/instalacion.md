# Instalación

Guía para dejar el prototipo corriendo en una máquina de desarrollo con **PostgreSQL 17 + pgvector local**, sin Docker y sin depender de Supabase. Al final se incluyen la variante con Supabase, la preparación de producción y los problemas comunes.

## 1. Requisitos

- **Node.js 22 o superior** (`node -v`) y npm.
- **PostgreSQL 17** con la extensión **pgvector**. El proyecto trae comandos para administrar un clúster local en `.local-pg/`, pero necesita los binarios de PostgreSQL en el `PATH`.
- Espacio en disco para el clúster local (unos cientos de MB) y para `node_modules`.
- Opcional: una clave de **OpenRouter** si vas a usar la consulta normativa o la ingesta del corpus.
- Opcional: un proyecto de **Supabase** si prefieres una base administrada en lugar del clúster local.

### macOS con Homebrew

```bash
brew install postgresql@17 pgvector
```

`postgresql@17` es una fórmula *keg-only*: si `pg_ctl`, `psql`, `initdb` o `createdb` no aparecen en el `PATH`, agrégalos:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Comprueba que la extensión vectorial está disponible para esa instalación:

```bash
pg_config --version
ls "$(pg_config --sharedir)/extension" | grep vector
```

Si `grep vector` no devuelve nada, `pgvector` no corresponde a la misma versión de PostgreSQL; reinstálalo (`brew reinstall pgvector`) antes de continuar.

### Linux

Instala PostgreSQL 17 y la extensión desde los paquetes de tu distribución. En Debian/Ubuntu, por ejemplo, `postgresql-17` y `postgresql-17-pgvector` (si tu repositorio no la incluye, compila pgvector contra la versión 17). Asegúrate de que `pg_ctl` esté en el `PATH`.

> Alternativa con Docker: usa la imagen `pgvector/pgvector:pg17`, publica el puerto `54330` y ajusta `DATABASE_URL`. La CI de GitHub Actions usa exactamente esa imagen.

## 2. Dependencias del proyecto

Desde la raíz del repositorio:

```bash
cd backend
npm install
cp .env.example .env

cd ../frontend
npm install
```

## 3. Variables de entorno

Edita `backend/.env` (no lo versiones: está en `.gitignore`). El archivo de ejemplo ya apunta a la base local.

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `NODE_ENV` | Sí | `development`, `test` o `production`. En producción se bloquea la semilla y se exigen secretos más largos. |
| `DEMO_MODE` | No (solo QA) | Solo para QA interno: habilita `GET /api/auth/demo` y `POST /api/auth/ingreso-demo`, que la interfaz ya no usa. En producción debe ser `false`. Si se omite, es `true` fuera de producción. |
| `DEMO_PASSWORD` | No | Solo desarrollo: contraseña que `npm run seed` asigna a las cuentas sembradas. Si se omite, la semilla genera una aleatoria y la imprime una sola vez. No publiques el valor ni lo reutilices en producción. |
| `DATABASE_URL` | Sí | Cadena de conexión. Local: `postgresql://postgres@127.0.0.1:54330/apoyo_tutorial`. Supabase: pooler en modo transacción (puerto 6543). |
| `JWT_SECRET` | Sí | Firma la cookie de sesión. Mínimo 16 caracteres en desarrollo y 32 en producción. Genera uno por entorno con `openssl rand -base64 32`. |
| `FRONTEND_ORIGIN` | Sí | Origen(es) permitido(s) para CORS y cookie. Acepta lista separada por comas; en desarrollo se aceptan automáticamente `localhost:5173`, `127.0.0.1:5173` e `[::1]:5173`. |
| `PORT` | No | Puerto de la API. Por defecto `3000`. |
| `SESSION_HOURS` | No | Duración de la sesión en horas (1–72). Por defecto `8`. |
| `OPENROUTER_API_KEY` | No | Habilita la consulta normativa y la ingesta real. Sin ella, la pantalla de consulta se deshabilita con su motivo. |
| `OPENROUTER_CHAT_MODEL` | No | Modelo de chat para redactar respuestas citadas. |
| `OPENROUTER_EMBEDDING_MODEL` | No | Modelo de embeddings de la ingesta. |
| `EMBEDDING_DIMENSIONES` | No | Dimensión del vector; debe coincidir con la migración (`1536`). |
| `RAG_UMBRAL_SIMILITUD` | No | Umbral 0–1 bajo el cual el asistente se abstiene. |
| `RAG_TOP_K` | No | Fragmentos recuperados por consulta (1–20). Por defecto `4`. |
| `TRUST_PROXY` | No | `true` solo detrás de un proxy inverso. En producción se activa automáticamente. |

## 4. Base de datos local

El proyecto administra un clúster PostgreSQL 17 propio dentro de `.local-pg/`, en el puerto **54330** y con autenticación local `trust` (solo escucha en `127.0.0.1`; no lo expongas a la red). Los datos quedan en `.local-pg/data` y el registro de arranque en `.local-pg/postgres.log`.

```bash
cd backend

npm run db:local          # crea el clúster si no existe, lo inicia y crea la base y pgvector
npm run db:local:status   # dice si está corriendo y la versión de PostgreSQL
npm run db:local:stop     # detiene el clúster sin borrar datos
npm run db:local:reset    # borra la base local y la deja vacía (pide confirmación)
```

Notas:

- `db:local` es idempotente: si el clúster ya existe, solo lo inicia; si la base `apoyo_tutorial` no existe, la crea; y siempre deja disponibles el esquema `extensions` y la extensión `vector`.
- `db:local:reset` **elimina los datos** para volver a empezar. Exige confirmación explícita: `CONFIRMAR=si npm run db:local:reset` o `npm run db:local:reset -- --si`. Después hay que repetir `npm run migrate` y `npm run seed`.
- Puedes cambiar el puerto, la base o el usuario con las variables de entorno `PGPORT_LOCAL`, `PGDATABASE_LOCAL`, `PGUSER_LOCAL` y `PGDATA_DIR`; si cambias el puerto, ajusta `DATABASE_URL` en `backend/.env`.
- Para abrir una consola SQL: `psql postgresql://postgres@127.0.0.1:54330/apoyo_tutorial`.
- La carpeta `.local-pg/` está ignorada por git.
- Si usas Supabase, salta este apartado y ajusta `DATABASE_URL`.

## 5. Migraciones y dataset

```bash
cd backend
npm run migrate
npm run seed
```

- `npm run migrate` aplica en orden `001_init.sql` (esquema base), `002_configuracion_institucional.sql` (configuración, reglas y calidad de datos) y `003_recuperacion_password.sql` (tokens de recuperación de contraseña), y registra cada archivo en `schema_migrations`. Se puede volver a ejecutar sin efecto sobre lo ya aplicado; para verificar el esquema usa `psql` o `npm run db:local:status`.
- `npm run seed` carga la configuración institucional (institución, periodos, catálogos, reglas RA, parámetros), el dataset sintético de 30 estudiantes, 3 periodos y 540 registros, recalcula el semáforo de los 3 periodos, marca el riesgo observado y entrena el modelo de demostración. Es determinista.
- La semilla se protege: si la base ya tiene estudiantes, se detiene y hay que repetir `npm run seed -- --reemplazar`. Antes de escribir, `npm run seed -- --dry-run` valida el dataset sin tocar la base.
- Al terminar, `seed` imprime una sola vez los correos de las cuentas sembradas (tutoría, coordinación, asesoría y administración técnica) y la contraseña compartida: la de `DEMO_PASSWORD` o una aleatoria si no la defines. Ese valor es solo para desarrollo y no se guarda en el repositorio.
- `seed` se niega a ejecutarse con `NODE_ENV=production` salvo que se fuerce explícitamente; no lo fuerces en una base operativa.
- Si actualizas una base sembrada de una versión anterior, `npm run migrate` aplica `003_recuperacion_password.sql`; para cargar las nuevas claves de configuración en desarrollo puedes volver a sembrar con `npm run seed -- --reemplazar` (destructivo).
- El dataset se genera en `backend/datos/` con `backend/datos/extraer.py` a partir del libro de casos; el contrato, los conteos, los casos deliberados y los supuestos están en `backend/datos/CONTRATO.md`.
- Si sólo necesitas regenerar el JSON del dataset (sin cargar la base), sigue las instrucciones de `backend/datos/CONTRATO.md`.

## 6. Levantar la aplicación

En dos terminales:

```bash
# terminal 1 · API
cd backend && npm run start:dev

# terminal 2 · interfaz
cd frontend && npm run dev
```

- API: <http://127.0.0.1:3000> (prefijo `/api`; salud en `/api/salud`).
- Interfaz: <http://localhost:5173>. Vite hace proxy de `/api` al puerto de la API.
- La sesión viaja en una cookie `HttpOnly`; no se guardan tokens en `localStorage`.
- Pantallas de la app: **Inicio** (`/inicio`), **Estudiantes** (`/estudiantes` y `/estudiantes/:id`), **Alertas**, **Asistente** (`/asistente`) y **Administración** (`/administracion`, solo administración técnica). Las rutas anteriores redirigen: `/tablero` → `/inicio`, `/tutorados` → `/estudiantes`, `/tutorados/:id` → `/estudiantes/:id`, `/consulta` → `/asistente` y `/tecnica` → `/administracion`.

### 6.1 Primer acceso y cuentas

- **Iniciar sesión:** en la pantalla de acceso usa correo y contraseña (`POST /api/auth/ingreso`). No hay cuentas ni contraseñas publicadas en el repositorio.
- **Cuentas sembradas:** la semilla crea cuentas de tutoría, coordinación, asesoría y administración técnica. Los correos y la contraseña se imprimen **una sola vez** al terminar `npm run seed` (la contraseña es la de `DEMO_PASSWORD` o una aleatoria). Úsalas solo en desarrollo.
- **Crear cuenta:** el enlace «Crear cuenta» del acceso llama a `POST /api/auth/registro` (`nombre`, `correo`, `password`, `password_confirmacion`). La cuenta se crea activa con rol **tutoría**, la sesión se abre automáticamente y la contraseña debe tener al menos **10 caracteres con una letra y un número**. El correo debe ser único. Una cuenta nueva de tutoría **no verá estudiantes asignados** hasta que coordinación se los asigne (estado vacío explícito).
- **Registro y recuperación configurables:** el registro se controla con `permitir_registro` y la recuperación con `recuperacion_habilitada` en la tabla `configuracion`. `GET /api/contexto` expone `auth.registro` y `auth.recuperacion` para que la interfaz muestre u oculte los enlaces. Ambas claves se siembran con `npm run seed` y, si faltan en una base anterior, el valor por defecto es `true`.
- **Recuperar contraseña:** `POST /api/auth/recuperar` (`correo`) responde siempre de forma genérica (no revela si el correo existe) y, si la cuenta existe, crea un token de un solo uso por **30 minutos** en `recuperacion_password`. En desarrollo/demo la respuesta incluye el `token` para probar el flujo; en producción **no** se devuelve y el envío por correo requiere un proveedor externo (pendiente).
- **Restablecer contraseña:** `POST /api/auth/restablecer` (`token`, `password`, `password_confirmacion`) valida el token vigente y no usado, cambia la contraseña, revoca las sesiones anteriores y marca el token como usado.

### 6.2 Demo interno (QA)

`DEMO_MODE=true` mantiene disponibles `GET /api/auth/demo` y `POST /api/auth/ingreso-demo` para pruebas internas, pero **la interfaz ya no los usa** y no son la forma normal de entrar. En producción usa `DEMO_MODE=false`.

## 7. RAG: comprobar y, si aplica, ingestar

Primero comprueba extracción y fragmentación de los PDF sin llamar a ningún servicio externo ni escribir en la base:

```bash
cd backend
npm run ingest -- --dry-run
```

La ingesta real genera embeddings con OpenRouter, **tiene costo** y escribe en la base configurada. Necesita `OPENROUTER_API_KEY`; si falta, la ingesta se detiene con un mensaje claro y la pantalla de consulta queda deshabilitada.

```bash
cd backend
npm run ingest
```

- El corpus se declara en `backend/corpus/fuentes-rag.json` con versión, fecha, institución aplicable, vigencia verificada y permisos.
- Las fuentes actuales tienen **vigencia para ITTLA por validar**; la interfaz lo advierte en las citas.
- Cambiar de modelo de embeddings exige actualizar `EMBEDDING_DIMENSIONES`, la columna `vector(n)` y volver a ingestear.

## 8. Supabase (opcional)

1. Crea el proyecto en Supabase.
2. En *Database → Connection string*, copia el pooler en **modo transacción (puerto 6543)**.
3. En `backend/.env`, comenta el `DATABASE_URL` local y usa el de Supabase.
4. Ejecuta `npm run migrate` y, si es un entorno de prueba, `npm run seed`.
5. pgvector ya viene disponible en Supabase; la migración lo crea en el esquema `extensions`.
6. Revisa que `FRONTEND_ORIGIN` sea el origen real de tu frontend y que `DEMO_MODE` esté en `false` si la base no es de demostración (los endpoints de QA quedan deshabilitados).

La API desactiva sentencias preparadas para poder usar el pooler en modo transacción. No pongas la cadena de conexión en el frontend ni en variables de build.

## 9. Producción

Checklist mínimo:

- `NODE_ENV=production`, `DEMO_MODE=false`, `JWT_SECRET` de 32+ caracteres, `FRONTEND_ORIGIN` real y TLS terminado en un proxy inverso (`TRUST_PROXY` se activa en producción).
- No ejecutes `npm run seed` en producción: está bloqueado y la base operativa no debe llenarse con datos sintéticos.
- **Registro:** queda bajo `permitir_registro` en `configuracion`; en una instalación real conviene vincularlo con el alta institucional antes de abrirlo.
- **Recuperación de contraseña:** el flujo con token funciona, pero el envío del enlace por correo requiere integrar un proveedor (SMTP/servicio transaccional). Mientras no exista, la recuperación en producción queda incompleta; no publiques tokens por canales inseguros.
- Compila y arranca:

  ```bash
  cd backend && npm run build && npm run start:prod
  cd frontend && npm run build   # sirve dist/ con tu servidor web
  ```

- Revisa `/api/salud`, define respaldo y restauración de la base, y mantén el corpus y las reglas con aprobación institucional documentada.

## 10. Problemas comunes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `Falta DATABASE_URL...` | No hay `backend/.env` o está sin `DATABASE_URL`. | `cp .env.example .env` y revisa la cadena. |
| `JWT_SECRET debe tener al menos ...` | Secreto corto para el `NODE_ENV` actual. | Genera uno nuevo con `openssl rand -base64 32`. |
| `pg_ctl: command not found` | Binarios de PostgreSQL fuera del `PATH`. | Agrega `/opt/homebrew/opt/postgresql@17/bin` al `PATH`. |
| `db:local` no arranca el clúster | Otro proceso ocupa el puerto 54330 o el clúster quedó sucio. | `npm run db:local:status`; si el puerto está ocupado, libéralo; si el clúster está corrupto, `npm run db:local:reset` (con confirmación) y repite migraciones/semilla. |
| `extension "vector" is not available` | pgvector no está instalado para PostgreSQL 17. | `brew install pgvector` (o paquete equivalente) y reintenta `npm run migrate`. |
| `role "tuusuario" does not exist` al usar `psql` | Te conectaste sin usuario a la base local. | Usa la cadena completa: `psql postgresql://postgres@127.0.0.1:54330/apoyo_tutorial`. |
| `La base ya tiene estudiantes...` al correr `seed` | La semilla reemplaza todos los datos y detectó datos previos. | Si quieres reiniciar el dataset: `npm run seed -- --reemplazar`. Si solo querías validar: `npm run seed -- --dry-run`. |
| `seed` se niega a correr con `NODE_ENV=production` | Protección para no cargar datos sintéticos en una base operativa. | Usa `NODE_ENV=development`; no fuerces la semilla en producción. |
| `db:local:reset` pide confirmación y no borra | Es una protección contra pérdida de datos. | `CONFIRMAR=si npm run db:local:reset` o `npm run db:local:reset -- --si`. |
| No aparece el enlace «Crear cuenta» | El registro está desactivado con `permitir_registro=false` en `configuracion`. | Actívalo en la base (o vuelve a sembrar con `npm run seed -- --reemplazar` si es una base de prueba) y recarga la interfaz. |
| No recuerdo la contraseña de las cuentas sembradas | La contraseña se imprime una sola vez al correr `seed` y no se guarda. | En una base de prueba vuelve a sembrar con `DEMO_PASSWORD=<valor> npm run seed -- --reemplazar`; en bases con datos, restablece la contraseña por el flujo de recuperación. |
| La recuperación no me da un token | En producción el backend no devuelve tokens y aún no hay proveedor de correo integrado. | En desarrollo/demo usa el token que muestra la pantalla; en producción queda pendiente la integración del proveedor. |
| El registro rechaza la contraseña | Debe tener al menos 10 caracteres, con al menos una letra y un número. | Escribe una contraseña que cumpla la regla o revisa el mensaje de validación. |
| El navegador no puede iniciar sesión | `FRONTEND_ORIGIN` no coincide con el origen real. | Ajusta `FRONTEND_ORIGIN` y reinicia la API. |
| El puerto 3000 ya está ocupado por otro programa | Otra aplicación usa el puerto de la API. | Cambia `PORT` en `backend/.env` (por ejemplo `3100`) y arranca el frontend con `VITE_API_PORT=3100 npm run dev`. |
| La sesión expira de inmediato | Cookies bloqueadas o `JWT_SECRET` distinto entre reinicios. | Usa un secreto estable; revisa que estés en `http://localhost:5173` y no en otro origen. |
| La consulta normativa aparece deshabilitada | Falta `OPENROUTER_API_KEY` o el corpus no está ingestado. | Configura la clave y ejecuta `npm run ingest`; el motivo exacto se muestra en pantalla. |
| `npm run ingest` falla por dimensiones | El modelo de embeddings no devuelve `EMBEDDING_DIMENSIONES`. | Ajusta el modelo o la dimensión y vuelve a ingestear. |
| Migración a medias o esquema viejo | Base local de un prototipo anterior. | `npm run db:local:reset`, `npm run migrate`, `npm run seed`. |

Para verificar el estado general de la instalación:

```bash
cd backend
npm test
npm run build
curl -s http://127.0.0.1:3000/api/salud
```

Las pruebas unitarias no requieren base de datos ni llaman a OpenRouter.
