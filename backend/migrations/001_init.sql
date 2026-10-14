-- Esquema del sistema de apoyo tutorial.
-- Pensado para Supabase: pgvector vive en el esquema extensions.
-- El rol postgres (dueño) omite RLS; anon y authenticated no tienen acceso.
-- La autorización de tutores la aplica la API.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table usuario (
  id bigint generated always as identity primary key,
  correo text not null unique,
  nombre text not null,
  rol text not null check (rol in ('tutor', 'coordinacion', 'asesoria', 'admin_tecnico')),
  hash_password text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table estudiante (
  id bigint generated always as identity primary key,
  id_anonimo text not null unique check (id_anonimo ~ '^EST_[0-9]{3}$'),
  carrera text not null check (carrera in ('Sistemas', 'Industrial', 'Administración', 'Mecatrónica')),
  semestre smallint not null check (semestre between 1 and 12),
  generacion text not null,
  plan_estudios text not null,
  modalidad text not null,
  grupo text not null check (grupo in ('GRP-A', 'GRP-B', 'GRP-C')),
  estatus_academico text not null,
  tutor_id bigint not null references usuario (id),
  fuente_sintetica text not null default 'generado_sinteticamente',
  version_dataset text not null default 'v1.0',
  fecha_generacion date not null default current_date,
  creado_en timestamptz not null default now()
);

create index estudiante_tutor_id_idx on estudiante (tutor_id);
create index estudiante_grupo_idx on estudiante (grupo);

create table trayectoria_periodo (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  periodo text not null,
  creditos_aprobados numeric(6,1) not null check (creditos_aprobados >= 0),
  creditos_pendientes numeric(6,1) not null check (creditos_pendientes >= 0),
  promedio_periodo numeric(5,2) not null check (promedio_periodo between 0 and 100),
  materias_reprobadas integer not null check (materias_reprobadas >= 0),
  porcentaje_asistencia numeric(5,2) not null check (porcentaje_asistencia between 0 and 100),
  avance_curricular numeric(5,2) not null check (avance_curricular between 0 and 100),
  acuerdos_vencidos integer not null check (acuerdos_vencidos >= 0),
  puntos_alerta integer not null check (puntos_alerta >= 0),
  nivel_alerta text not null check (nivel_alerta in ('verde', 'amarillo', 'rojo')),
  riesgo_objetivo text not null check (riesgo_objetivo in ('bajo', 'medio', 'alto')),
  senales text[] not null default '{}',
  accion_sugerida text not null,
  actualizado_en timestamptz not null default now(),
  unique (estudiante_id, periodo)
);

create index trayectoria_periodo_periodo_nivel_idx
  on trayectoria_periodo (periodo, nivel_alerta);

create table asignatura_resultado (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  periodo text not null,
  clave_asignatura text not null,
  nombre_asignatura text not null,
  creditos smallint not null check (creditos > 0),
  calificacion numeric(5,2) check (calificacion is null or calificacion between 0 and 100),
  resultado text not null check (resultado in ('aprobado', 'reprobado')),
  oportunidad smallint not null default 1 check (oportunidad >= 1)
);

create index asignatura_resultado_estudiante_id_idx
  on asignatura_resultado (estudiante_id);

create table sesion_tutorial (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  tutor_id bigint not null references usuario (id),
  fecha_sesion date not null,
  tipo_sesion text not null,
  motivo text not null,
  acuerdos text not null,
  fecha_compromiso date,
  estatus_acuerdo text not null check (estatus_acuerdo in ('pendiente', 'cumplido', 'vencido')),
  observacion text not null default ''
);

create index sesion_tutorial_estudiante_id_idx on sesion_tutorial (estudiante_id);
create index sesion_tutorial_tutor_id_idx on sesion_tutorial (tutor_id);

create table intervencion_apoyo (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  tipo_apoyo text not null,
  taller text,
  area_responsable text not null,
  fecha_inicio date not null,
  fecha_cierre date,
  asistencia_apoyo numeric(5,2) check (asistencia_apoyo is null or asistencia_apoyo between 0 and 100),
  resultado text,
  cambio_semaforo text
);

create index intervencion_apoyo_estudiante_id_idx
  on intervencion_apoyo (estudiante_id);

create table accion_tutorial (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  tutor_id bigint not null references usuario (id),
  tipo text not null check (tipo in (
    'entrevista_tutorial',
    'asesoria_disciplinar',
    'taller',
    'canalizacion_academica',
    'seguimiento'
  )),
  fecha_compromiso date not null,
  estatus text not null check (estatus in ('en_seguimiento', 'cumplida', 'vencida', 'cancelada')),
  observacion text not null default '',
  creado_en timestamptz not null default now()
);

create index accion_tutorial_estudiante_id_idx on accion_tutorial (estudiante_id);
create index accion_tutorial_tutor_id_idx on accion_tutorial (tutor_id);
create index accion_tutorial_estatus_fecha_idx
  on accion_tutorial (estatus, fecha_compromiso);

create table revision_ficha (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  periodo text not null,
  revisor_id bigint not null references usuario (id),
  estatus text not null check (estatus in ('aprobada', 'requiere_ajuste', 'informacion_insuficiente')),
  comentario text not null default '',
  creado_en timestamptz not null default now()
);

create index revision_ficha_estudiante_id_idx on revision_ficha (estudiante_id);
create index revision_ficha_revisor_id_idx on revision_ficha (revisor_id);

create table alerta (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  periodo text not null,
  tipo text not null check (tipo in ('rojo_sin_revision', 'accion_por_vencer')),
  mensaje text not null,
  prioridad text not null check (prioridad in ('alta', 'media')),
  estado text not null check (estado in ('pendiente', 'atendida')),
  referencia_id bigint,
  creado_en timestamptz not null default now(),
  atendida_en timestamptz
);

create index alerta_estudiante_id_idx on alerta (estudiante_id);
create index alerta_estado_periodo_idx on alerta (estado, periodo);

create unique index alerta_roja_pendiente_idx
  on alerta (estudiante_id, periodo)
  where estado = 'pendiente' and tipo = 'rojo_sin_revision';

create unique index alerta_accion_pendiente_idx
  on alerta (referencia_id)
  where estado = 'pendiente' and tipo = 'accion_por_vencer';

create table documento_rag (
  id bigint generated always as identity primary key,
  titulo text not null,
  emisor text not null,
  nombre_archivo text not null,
  vigente boolean not null default true,
  fragmentos integer not null default 0,
  ingestado_en timestamptz
);

create table fragmento_rag (
  id bigint generated always as identity primary key,
  documento_id bigint not null references documento_rag (id) on delete cascade,
  numero integer not null check (numero > 0),
  pagina integer check (pagina is null or pagina > 0),
  texto text not null,
  embedding extensions.vector(1536),
  unique (documento_id, numero)
);

create index fragmento_rag_documento_id_idx on fragmento_rag (documento_id);

create index fragmento_rag_embedding_hnsw
  on fragmento_rag
  using hnsw (embedding extensions.vector_cosine_ops);

create table consulta_rag (
  id bigint generated always as identity primary key,
  usuario_id bigint not null references usuario (id),
  estudiante_id bigint references estudiante (id),
  pregunta text not null,
  respuesta jsonb not null,
  abstencion boolean not null,
  creado_en timestamptz not null default now()
);

create index consulta_rag_usuario_id_idx on consulta_rag (usuario_id);
create index consulta_rag_creado_en_idx on consulta_rag (creado_en desc);

create table bitacora (
  id bigint generated always as identity primary key,
  usuario_id bigint references usuario (id),
  operacion text not null,
  entidad text not null,
  entidad_id bigint,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index bitacora_creado_en_idx on bitacora (creado_en desc);
create index bitacora_usuario_id_idx on bitacora (usuario_id);

create table modelo_riesgo (
  id bigint generated always as identity primary key,
  version text not null,
  algoritmo text not null,
  motivo text not null,
  metricas jsonb not null,
  modelo jsonb not null,
  entrenado_en timestamptz not null default now()
);

-- Sin políticas para anon/authenticated: la API de datos de Supabase no lee estas tablas.
-- El dueño (conexión de la API) omite RLS. No se fuerza RLS porque el rol postgres
-- de Supabase igual la omite, y las migraciones deben poder escribir.

alter table usuario enable row level security;
alter table estudiante enable row level security;
alter table trayectoria_periodo enable row level security;
alter table asignatura_resultado enable row level security;
alter table sesion_tutorial enable row level security;
alter table intervencion_apoyo enable row level security;
alter table accion_tutorial enable row level security;
alter table revision_ficha enable row level security;
alter table alerta enable row level security;
alter table documento_rag enable row level security;
alter table fragmento_rag enable row level security;
alter table consulta_rag enable row level security;
alter table bitacora enable row level security;
alter table modelo_riesgo enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;
