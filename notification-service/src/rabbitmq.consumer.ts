import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, Channel, Connection, ConsumeMessage } from 'amqplib';

import { TelegramService } from './telegram.service';

type TaskEventPayload = {
  event?: string;
  task?: {
    title?: string;
    priority?: string;
    status?: string;
  };
};

const EXCHANGE_NAME = 'tasks.events';
const QUEUE_NAME = 'tasks.events';
const ROUTING_PATTERN = 'task.*';

@Injectable()
export class RabbitmqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConsumer.name);
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor(private readonly telegramService: TelegramService) {}

  async onModuleInit(): Promise<void> {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      this.logger.warn('RABBITMQ_URL is not configured, consumer is disabled');
      return;
    }

    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await this.channel.assertQueue(QUEUE_NAME, { durable: true });
    await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_PATTERN);

    await this.channel.consume(QUEUE_NAME, async (message) => {
      if (!message) {
        return;
      }

      try {
        await this.handleMessage(message);
        this.channel?.ack(message);
      } catch (error) {
        this.logger.error('Failed to process RabbitMQ message', error as Error);
        this.channel?.nack(message, false, true);
      }
    });

    this.logger.log(`RabbitMQ consumer is listening to ${QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    const payload = JSON.parse(message.content.toString()) as TaskEventPayload;
    const event = this.formatAction(payload.event || message.fields.routingKey);
    const title = payload.task?.title || 'Без названия';
    const priority = payload.task?.priority || 'unknown';
    const status = payload.task?.status || 'unknown';

    const text = `[${event}] Задача: ${title} | Приоритет: ${priority} | Статус: ${status}`;
    await this.telegramService.sendTaskNotification(text);
    this.logger.log(`Notification sent for task "${title}"`);
  }

  private formatAction(raw: string): string {
    if (raw === 'task_created' || raw === 'task.created') {
      return 'СОЗДАНА';
    }
    if (raw === 'task_updated' || raw === 'task.updated') {
      return 'ОБНОВЛЕНА';
    }
    if (raw === 'task_deleted' || raw === 'task.deleted') {
      return 'УДАЛЕНА';
    }
    return raw.toUpperCase();
  }
}
