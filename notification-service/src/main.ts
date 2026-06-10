import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 3001);

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');

  Logger.log(`Notification service is listening on port ${port}`, 'Bootstrap');
}

bootstrap();
