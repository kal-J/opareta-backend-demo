import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Global()
@Module({
  imports: [],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class CommonModule {}
