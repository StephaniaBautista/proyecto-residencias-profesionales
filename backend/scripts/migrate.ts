import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { crearSql } from '../src/base-datos/conexion';

async function main() {
  const sql = crearSql();
  try {
    await sql`
      create table if not exists schema_migrations (
        id text primary key,
        aplicado_en timestamptz not null default now()
      )
    `;
    const carpeta = path.join(process.cwd(), 'migrations');
    const archivos = (await readdir(carpeta)).filter((nombre) => nombre.endsWith('.sql')).sort();
    for (const archivo of archivos) {
      const ya = await sql`select id from schema_migrations where id = ${archivo}`;
      if (ya.length) {
        console.log(`Sin cambios: ${archivo}`);
        continue;
      }
      const contenido = await readFile(path.join(carpeta, archivo), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(contenido);
        await tx`insert into schema_migrations (id) values (${archivo})`;
      });
      console.log(`Aplicada: ${archivo}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
