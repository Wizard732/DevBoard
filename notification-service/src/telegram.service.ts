import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;
  private readonly bot: Telegraf | null;

  constructor() {
    this.bot = this.token ? new Telegraf(this.token) : null;
  }

  async sendTaskNotification(message: string): Promise<void> {
    if (!this.bot || !this.chatId) {
      this.logger.warn('Telegram credentials are not configured, notification is skipped');
      return;
    }

    await this.bot.telegram.sendMessage(this.chatId, message);
  }
}
