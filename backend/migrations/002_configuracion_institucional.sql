-- Migración 002: configuración institucional, catálogos, reglas versionadas,
-- calidad de datos, evaluaciones parciales, metadatos del RAG y operación.
-- Todo lo que antes era constante de código pasa a tablas editables.
-- Los datos de arranque (institución, periodos, catálogos, reglas, configuración)
-- los inserta `npm run seed` desde backend/datos/*.json.

-- ---------------------------------------------------------------------------
-- 1. Institución, periodos y catálogos
-- ---------------------------------------------------------------------------
create table institucion (
  id bigint generated always as identity primary key,
  clave text not null unique,
  nombre text not null,
  nombre_corto text not null,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table periodo (
  id bigint generated always as identity primary key,
  institucion_id bigint not null references institucion (id) on delete cascade,
  clave text not null,
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean not null default false,
  cerrado boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (institucion_id, clave),
  check (fecha_fin >= fecha_inicio)
);

-- Sólo un periodo activo por institución.
create unique index periodo_activo_unico_idx
  on periodo (institucion_id)
  where activo;

create table catalogo_carrera (
  id bigint generated always as identity primary key,
  institucion_id bigint not null references institucion (id) on delete cascade,
  clave text not null,
  nombre text not null,
  activo boolean not null default true,
  unique (institucion_id, clave)
);

create table catalogo_grupo (
  id bigint generated always as identity primary key,
  institucion_id bigint not null references institucion (id) on delete cascade,
  clave text not null,
  nombre text not null,
  activo boolean not null default true,
  unique (institucion_id, clave)
);

create table configuracion (
  clave text primary key,
  valor jsonb not null,
  descripcion text not null default '',
  visible_ui boolean not null default false,
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Reglas del semáforo: catálogo versionado y aprobable
-- ---------------------------------------------------------------------------
create table regla_semaforo (
  id bigint generated always as identity primary key,
  institucion_id bigint not null references institucion (id) on delete cascade,
  codigo text not null,
  version text not null,
  prioridad smallint not null check (prioridad between 1 and 100),
  nivel text not null check (nivel in (
    'verde', 'amarillo', 'rojo', 'informacion_insuficiente', 'inconsistencia'
  )),
  titulo text not null,
  descripcion text not null default '',
  condicion jsonb not null,
  accion text not null,
  vigencia_desde date not null,
  vigencia_hasta date,
  activa boolean not null default true,
  aprobada_por text,
  aprobada_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (institucion_id, codigo, version),
  check (vigencia_hasta is null or vigencia_hasta >= vigencia_desde)
);

create index regla_semaforo_vigente_idx
  on regla_semaforo (institucion_id, version, activa);

-- ---------------------------------------------------------------------------
-- 3. Calidad de datos, evaluaciones parciales y curso especial
-- ---------------------------------------------------------------------------
create table evaluacion_parcial (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  periodo text not null,
  clave_asignatura text not null,
  nombre_asignatura text,
  numero smallint not null check (numero between 1 and 10),
  calificacion numeric(5,2) check (calificacion is null or calificacion between 0 and 100),
  exigible boolean not null default true,
  acreditada boolean,
  fuente text not null default 'sintetico',
  creado_en timestamptz not null default now(),
  unique (estudiante_id, periodo, clave_asignatura, numero)
);

create index evaluacion_parcial_estudiante_idx
  on evaluacion_parcial (estudiante_id, periodo);

create table curso_especial (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  periodo text not null,
  clave_asignatura text not null,
  nombre_asignatura text,
  registrado boolean not null default true,
  fuente text not null default 'sintetico',
  creado_en timestamptz not null default now(),
  unique (estudiante_id, periodo, clave_asignatura)
);

create index curso_especial_estudiante_idx
  on curso_especial (estudiante_id, periodo);

-- Resultado de evaluar las reglas para un estudiante y un periodo.
create table evaluacion_riesgo (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  institucion_id bigint not null references institucion (id),
  periodo text not null,
  periodo_referencia text,
  version_reglas text not null,
  estado_datos text not null check (estado_datos in (
    'clasificado', 'informacion_insuficiente', 'inconsistencia'
  )),
  nivel text check (nivel in (
    'verde', 'amarillo', 'rojo', 'informacion_insuficiente', 'inconsistencia'
  )),
  puntos integer not null default 0 check (puntos >= 0),
  reglas_activadas jsonb not null default '[]'::jsonb,
  cobertura_datos jsonb not null default '{}'::jsonb,
  calculado_en timestamptz not null default now(),
  unique (estudiante_id, periodo, version_reglas)
);

create index evaluacion_riesgo_periodo_idx
  on evaluacion_riesgo (periodo, estado_datos, nivel);

-- ---------------------------------------------------------------------------
-- 4. Acompañamiento: asesorías, necesidades de apoyo, canalizaciones y solicitudes
--    (dimensiones separadas del semáforo académico, sin diagnósticos)
-- ---------------------------------------------------------------------------
create table servicio_asesoria (
  id bigint generated always as identity primary key,
  institucion_id bigint not null references institucion (id) on delete cascade,
  area text not null,
  asignatura text,
  modalidad text,
  dia text,
  horario text,
  vigencia text not null default 'por_confirmar',
  estado text not null default 'por_validar',
  fuente text not null default 'sintetico',
  validado_en date,
  nota text not null default '',
  creado_en timestamptz not null default now()
);

create table necesidad_apoyo (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  categoria text not null,
  necesidad text not null,
  origen text not null default 'declaracion_sintetica',
  documento_presentado text not null default 'No se almacena',
  estado text not null default 'sin_atender',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table canalizacion (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  categoria text not null,
  area_sugerida text not null,
  institucion_destino text not null default 'por_verificar',
  estatus text not null default 'pendiente',
  fecha_confirmacion date,
  nota text not null default '',
  creado_en timestamptz not null default now()
);

create table solicitud (
  id bigint generated always as identity primary key,
  estudiante_id bigint not null references estudiante (id) on delete cascade,
  tipo text not null,
  estado text not null default 'pendiente',
  area text not null default 'por_confirmar',
  nota text not null default '',
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Límites de acceso persistentes (reemplazan el mapa en memoria)
-- ---------------------------------------------------------------------------
create table limite_acceso (
  id bigint generated always as identity primary key,
  clave text not null,
  marca timestamptz not null default now()
);

create index limite_acceso_clave_marca_idx on limite_acceso (clave, marca);

-- ---------------------------------------------------------------------------
-- 6. Ajustes a tablas existentes
-- ---------------------------------------------------------------------------

-- Estudiante: institución y sin catálogos incrustados.
alter table estudiante
  add column institucion_id bigint references institucion (id) on delete set null;

alter table estudiante drop constraint if exists estudiante_id_anonimo_check;
alter table estudiante drop constraint if exists estudiante_carrera_check;
alter table estudiante drop constraint if exists estudiante_grupo_check;

create index estudiante_institucion_idx on estudiante (institucion_id);

-- Usuario: institución y revocación de sesión.
alter table usuario
  add column institucion_id bigint references institucion (id) on delete set null,
  add column token_version integer not null default 0 check (token_version >= 0);

-- Trayectoria: estados de calidad de datos y reglas activadas.
alter table trayectoria_periodo
  add column version_reglas text,
  add column periodo_referencia text,
  add column estado_datos text not null default 'clasificado'
    check (estado_datos in ('clasificado', 'informacion_insuficiente', 'inconsistencia')),
  add column reglas_activadas jsonb not null default '[]'::jsonb,
  add column cobertura_datos jsonb not null default '{}'::jsonb,
  add column riesgo_observado text check (riesgo_observado in ('bajo', 'medio', 'alto'));

alter table trayectoria_periodo
  drop constraint if exists trayectoria_periodo_nivel_alerta_check;
alter table trayectoria_periodo
  add constraint trayectoria_periodo_nivel_alerta_check check (nivel_alerta in (
    'verde', 'amarillo', 'rojo', 'informacion_insuficiente', 'inconsistencia'
  ));
alter table trayectoria_periodo alter column riesgo_objetivo drop not null;

-- Resultados de asignatura: el dato puede no existir o no ser exigible.
alter table asignatura_resultado
  drop constraint if exists asignatura_resultado_resultado_check;
alter table asignatura_resultado
  add constraint asignatura_resultado_resultado_check check (resultado in (
    'aprobado', 'reprobado', 'sin_registro'
  ));

-- Alertas: los estados de datos también generan alertas.
alter table alerta drop constraint if exists alerta_tipo_check;
alter table alerta
  add constraint alerta_tipo_check check (tipo in (
    'rojo_sin_revision', 'accion_por_vencer', 'datos_incompletos', 'inconsistencia_datos'
  ));

create unique index alerta_calidad_pendiente_idx
  on alerta (estudiante_id, periodo, tipo)
  where estado = 'pendiente' and tipo in ('datos_incompletos', 'inconsistencia_datos');

-- Modelo: tipo, etiqueta y trazabilidad del entrenamiento.
alter table modelo_riesgo
  add column institucion_id bigint references institucion (id) on delete set null,
  add column tipo text not null default 'predictivo'
    check (tipo in ('predictivo', 'explicador')),
  add column etiqueta_definicion text,
  add column registros_entrenamiento integer,
  add column registros_prueba integer,
  add column advertencia text;

-- Documento RAG: metadatos de procedencia y vigencia.
alter table documento_rag
  add column institucion_id bigint references institucion (id) on delete set null,
  add column version text,
  add column fecha_documento date,
  add column institucion_aplicable text,
  add column vigencia_verificada boolean not null default false,
  add column permisos text not null default 'uso interno',
  add column paginas integer,
  add column url text,
  add column aprobada_por text,
  add column aprobada_en timestamptz;

-- ---------------------------------------------------------------------------
-- 7. RLS: las tablas nuevas también quedan cerradas a anon/authenticated.
-- ---------------------------------------------------------------------------
alter table institucion enable row level security;
alter table periodo enable row level security;
alter table catalogo_carrera enable row level security;
alter table catalogo_grupo enable row level security;
alter table configuracion enable row level security;
alter table regla_semaforo enable row level security;
alter table evaluacion_parcial enable row level security;
alter table curso_especial enable row level security;
alter table evaluacion_riesgo enable row level security;
alter table servicio_asesoria enable row level security;
alter table necesidad_apoyo enable row level security;
alter table canalizacion enable row level security;
alter table solicitud enable row level security;
alter table limite_acceso enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;
