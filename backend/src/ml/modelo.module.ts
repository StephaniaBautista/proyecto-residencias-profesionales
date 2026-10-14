import { Module } from '@nestjs/common';
import { ModeloService } from './modelo.service';

@Module({
  providers: [ModeloService],
  exports: [ModeloService],
})
export class ModeloModule {}
