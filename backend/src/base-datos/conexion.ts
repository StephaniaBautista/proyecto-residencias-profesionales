import postgres, { type Sql } from 'postgres';
import { urlBaseDatos } from '../entorno';

export type { Sql };

export function crearSql(): Sql {
  const databaseUrl = urlBaseDatos();
  const supabase = databaseUrl.includes('supabase.com') || databaseUrl.includes('pooler.supabase');
  return postgres(databaseUrl, {
    max: supabase ? 5 : 1,
    prepare: false,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 15,
    ssl: supabase ? 'require' : undefined,
    connection: {
      application_name: 'apoyo_tutorial_ittla',
    },
  });
}
