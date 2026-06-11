DevBoard

1. Клонировать репозиторий:
   git clone https://github.com/Wizard732/DevBoard.git && cd DevBoard


2. Создать .env и вписать токены Telegram:
   Возьмите токен у botfather в telegram - https://t.me/botfather
   создайте .env.example .env
   Затем введите токен своего бота и url активного backend сервера


3. Запустить:
   docker compose up --build -d

Открыть в браузере: **http://localhost:8080**

# Адреса сервисов

Канбан доска = http://localhost:8080 
Статистика = http://localhost:8080/status 
API (Swagger) = http://localhost:8080/api/docs 
RabbitMQ UI = http://localhost:15673 — devboard/devboard 
PostgreSQL = localhost:5433 

# Стек

Backend - FastAPI, SQLAlchemy 2.0 Async, PostgreSQL 15 

Security - ECDH + AES-256-GCM (Web Crypto API + cryptography) 

Messaging - RabbitMQ topic exchange, asyncio 

Cache - Redis 7, distributed mutex, TTL 30s 

Notifications - NestJS 11, Telegraf 

Bot - Telegraf (Node.js), команды /add /list /done /delete 

Frontend - Next.js 15, React 19, Three.js, WebSocket 

Stats page - Vanilla JS, Chart.js — без фреймворков 

Infra - Docker Compose, Nginx reverse proxy 
