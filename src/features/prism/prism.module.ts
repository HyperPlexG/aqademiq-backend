import { Module } from '@nestjs/common';
import { PrismController } from './prism.controller';
import { PrismService } from './prism.service';

@Module({ controllers: [PrismController], providers: [PrismService], exports: [PrismService] })
export class PrismModule {}
