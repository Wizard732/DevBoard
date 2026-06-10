import { Controller, Get, Module } from '@nestjs/common';

import { RabbitmqModule } from './rabbitmq.module';
import { TelegramModule } from './telegram.module';

@Controller()
class HealthController {
  @Get()
  getStatus() {
    return { service: 'notification-service', status: 'ok' };
  }
}

@Module({
  imports: [RabbitmqModule, TelegramModule],
  controllers: [HealthController],
})
export class AppModule {}
