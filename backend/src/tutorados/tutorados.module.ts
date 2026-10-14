import { Module } from '@nestjs/common';
import { ModeloModule } from '../ml/modelo.module';
import { TutoradosController } from './tutorados.controller';
import { TutoradosService } from './tutorados.service';

@Module({
  imports: [ModeloModule],
  controllers: [TutoradosController],
  providers: [TutoradosService],
  exports: [TutoradosService],
})
export class TutoradosModule {}
