import { Module } from '@nestjs/common';
import { ModeloModule } from '../ml/modelo.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ModeloModule],
  controllers: [AdminController],
})
export class AdminModule {}
