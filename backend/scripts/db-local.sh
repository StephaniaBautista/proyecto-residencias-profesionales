#!/usr/bin/env bash
# PostgreSQL local con pgvector para el prototipo de apoyo tutorial.
# Uso: bash scripts/db-local.sh {start|stop|status|reset|psql}
# Requiere PostgreSQL 17 (Homebrew: brew install postgresql@17 pgvector).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATOS="${PGDATA_DIR:-$RAIZ/.local-pg/data}"
LOG="$RAIZ/.local-pg/postgres.log"
PUERTO="${PGPORT_LOCAL:-54330}"
BASE="${PGDATABASE_LOCAL:-apoyo_tutorial}"
USUARIO="${PGUSER_LOCAL:-postgres}"
HOST="127.0.0.1"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

comando="${1:-status}"

inicializar() {
  if [[ ! -d "$DATOS" ]]; then
    echo "Inicializando clúster local en $DATOS"
    mkdir -p "$(dirname "$DATOS")"
    initdb -D "$DATOS" -U "$USUARIO" --auth-local=trust --auth-host=trust \
      --encoding=UTF8 --locale=C >/dev/null
  fi
}

esta_corriendo() {
  pg_isready -h "$HOST" -p "$PUERTO" -U "$USUARIO" >/dev/null 2>&1
}

arrancar() {
  inicializar
  if esta_corriendo; then
    echo "PostgreSQL ya está escuchando en $HOST:$PUERTO"
  else
    pg_ctl -D "$DATOS" -l "$LOG" -o "-p $PUERTO -c listen_addresses=$HOST" start >/dev/null
    for _ in $(seq 1 30); do
      esta_corriendo && break
      sleep 0.3
    done
    if ! esta_corriendo; then
      echo "No se pudo arrancar PostgreSQL. Revisa $LOG" >&2
      exit 1
    fi
    echo "PostgreSQL escuchando en $HOST:$PUERTO"
  fi
  if ! psql -h "$HOST" -p "$PUERTO" -U "$USUARIO" -d postgres -tAc \
    "select 1 from pg_database where datname='$BASE'" | grep -q 1; then
    createdb -h "$HOST" -p "$PUERTO" -U "$USUARIO" "$BASE"
    echo "Base $BASE creada"
  fi
  psql -h "$HOST" -p "$PUERTO" -U "$USUARIO" -d "$BASE" -tAc \
    "create schema if not exists extensions; create extension if not exists vector with schema extensions;" \
    >/dev/null
  echo "Listo. DATABASE_URL=postgresql://$USUARIO@$HOST:$PUERTO/$BASE"
}

detener() {
  if [[ -d "$DATOS" ]]; then
    pg_ctl -D "$DATOS" stop -m fast >/dev/null 2>&1 || true
    echo "PostgreSQL local detenido"
  else
    echo "No hay clúster local en $DATOS"
  fi
}

estado() {
  if esta_corriendo; then
    echo "PostgreSQL local activo en $HOST:$PUERTO (base $BASE)"
    psql -h "$HOST" -p "$PUERTO" -U "$USUARIO" -d "$BASE" -tAc "select version();" | head -1
  else
    echo "PostgreSQL local detenido (esperado en $HOST:$PUERTO)"
    exit 1
  fi
}

reiniciar_base() {
  echo "ATENCIÓN: se borrará la base $BASE de $HOST:$PUERTO."
  if [[ "${CONFIRMAR:-}" != "si" && "${2:-}" != "--si" ]]; then
    echo "Vuelve a ejecutar con CONFIRMAR=si o con --si." >&2
    exit 1
  fi
  arrancar
  dropdb -h "$HOST" -p "$PUERTO" -U "$USUARIO" --if-exists "$BASE"
  createdb -h "$HOST" -p "$PUERTO" -U "$USUARIO" "$BASE"
  psql -h "$HOST" -p "$PUERTO" -U "$USUARIO" -d "$BASE" -tAc \
    "create schema if not exists extensions; create extension if not exists vector with schema extensions;" \
    >/dev/null
  echo "Base $BASE reiniciada. Ejecuta: npm run migrate && npm run seed -- --reemplazar"
}

case "$comando" in
  start) arrancar ;;
  stop) detener ;;
  status) estado ;;
  reset) reiniciar_base "$@" ;;
  psql) psql -h "$HOST" -p "$PUERTO" -U "$USUARIO" -d "$BASE" ;;
  *)
    echo "Uso: bash scripts/db-local.sh {start|stop|status|reset|psql}" >&2
    exit 1
    ;;
esac
