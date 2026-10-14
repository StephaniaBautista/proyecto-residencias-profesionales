import { Global, Module } from '@nestjs/common';
import { BaseDatos } from './base-datos.service';

@Global()
@Module({
  providers: [BaseDatos],
  exports: [BaseDatos],
})
export class BaseDatosModule {}
