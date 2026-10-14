import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AlertasModule } from './alertas/alertas.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { BaseDatosModule } from './base-datos/base-datos.module';
import { FiltroErrores } from './comun/filtro-errores';
import { RagModule } from './rag/rag.module';
import { SaludController } from './salud.controller';
import { TutoradosModule } from './tutorados/tutorados.module';

@Module({
  imports: [BaseDatosModule, AuthModule, TutoradosModule, AlertasModule, RagModule, AdminModule],
  controllers: [SaludController],
  providers: [
    { provide: APP_FILTER, useClass: FiltroErrores },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
