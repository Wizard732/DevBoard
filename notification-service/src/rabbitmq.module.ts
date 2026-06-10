import { Module } from '@nestjs/common';

import { RabbitmqConsumer } from './rabbitmq.consumer';
import { TelegramModule } from './telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [RabbitmqConsumer],
})
export class RabbitmqModule {}
