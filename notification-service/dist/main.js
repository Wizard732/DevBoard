"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const port = Number(process.env.PORT || 3001);
    app.enableShutdownHooks();
    await app.listen(port, '0.0.0.0');
    common_1.Logger.log(`Notification service is listening on port ${port}`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map