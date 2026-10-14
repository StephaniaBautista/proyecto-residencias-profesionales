import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { crearSql, type Sql } from './conexion';

@Injectable()
export class BaseDatos implements OnModuleInit, OnModuleDestroy {
  readonly sql: Sql = crearSql();

  async onModuleInit(): Promise<void> {
    await this.sql`select 1 as ok`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
