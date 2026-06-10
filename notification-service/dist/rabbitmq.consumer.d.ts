import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TelegramService } from './telegram.service';
export declare class RabbitmqConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly telegramService;
    private readonly logger;
    private connection;
    private channel;
    constructor(telegramService: TelegramService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private handleMessage;
    private formatAction;
}
