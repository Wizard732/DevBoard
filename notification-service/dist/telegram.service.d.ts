export declare class TelegramService {
    private readonly logger;
    private readonly token;
    private readonly chatId;
    private readonly bot;
    constructor();
    sendTaskNotification(message: string): Promise<void>;
}
