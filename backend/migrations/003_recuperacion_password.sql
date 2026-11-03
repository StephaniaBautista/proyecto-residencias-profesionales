-- Migración 003: recuperación de contraseña con tokens de un solo uso.
-- El token se guarda sólo como SHA-256; la contraseña nueva se hashea con bcrypt.
-- En producción el envío del enlace requiere un proveedor de correo (pendiente).

create table recuperacion_password (
  id bigint generated always as identity primary key,
  usuario_id bigint not null references usuario (id) on delete cascade,
  token_hash text not null unique,
  expira_en timestamptz not null,
  usado boolean not null default false,
  ip text,
  creado_en timestamptz not null default now()
);

create index recuperacion_password_usuario_idx
  on recuperacion_password (usuario_id, creado_en desc);

create index recuperacion_password_expira_idx
  on recuperacion_password (expira_en);

alter table recuperacion_password enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table recuperacion_password from anon, authenticated;
    revoke all on sequence recuperacion_password_id_seq from anon, authenticated;
  end if;
end $$;
