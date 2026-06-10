"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RabbitmqConsumer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqConsumer = void 0;
const common_1 = require("@nestjs/common");
const amqplib_1 = require("amqplib");
const telegram_service_1 = require("./telegram.service");
const EXCHANGE_NAME = 'tasks.events';
const QUEUE_NAME = 'tasks.events';
const ROUTING_PATTERN = 'task.*';
let RabbitmqConsumer = RabbitmqConsumer_1 = class RabbitmqConsumer {
    constructor(telegramService) {
        this.telegramService = telegramService;
        this.logger = new common_1.Logger(RabbitmqConsumer_1.name);
        this.connection = null;
        this.channel = null;
    }
    async onModuleInit() {
        const url = process.env.RABBITMQ_URL;
        if (!url) {
            this.logger.warn('RABBITMQ_URL is not configured, consumer is disabled');
            return;
        }
        this.connection = await (0, amqplib_1.connect)(url);
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
            }
            catch (error) {
                this.logger.error('Failed to process RabbitMQ message', error);
                this.channel?.nack(message, false, true);
            }
        });
        this.logger.log(`RabbitMQ consumer is listening to ${QUEUE_NAME}`);
    }
    async onModuleDestroy() {
        await this.channel?.close();
        await this.connection?.close();
    }
    async handleMessage(message) {
        const payload = JSON.parse(message.content.toString());
        const event = this.formatAction(payload.event || message.fields.routingKey);
        const title = payload.task?.title || 'Без названия';
        const priority = payload.task?.priority || 'unknown';
        const status = payload.task?.status || 'unknown';
        const text = `[${event}] Задача: ${title} | Приоритет: ${priority} | Статус: ${status}`;
        await this.telegramService.sendTaskNotification(text);
        this.logger.log(`Notification sent for task "${title}"`);
    }
    formatAction(raw) {
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
};
exports.RabbitmqConsumer = RabbitmqConsumer;
exports.RabbitmqConsumer = RabbitmqConsumer = RabbitmqConsumer_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService])
], RabbitmqConsumer);
//# sourceMappingURL=rabbitmq.consumer.js.map