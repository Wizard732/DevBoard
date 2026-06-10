import json
import os
from typing import Any

import aio_pika

EXCHANGE_NAME = "tasks.events"


class RabbitMQPublisher:
    def __init__(self) -> None:
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.Channel | None = None
        self._exchange: aio_pika.Exchange | None = None

    async def connect(self) -> None:
        url = os.getenv("RABBITMQ_URL", "amqp://devboard:devboard@localhost:5672/")
        self._connection = await aio_pika.connect_robust(url)
        self._channel = await self._connection.channel()
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )

    async def disconnect(self) -> None:
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            self._channel = None
            self._exchange = None

    async def publish(self, routing_key: str, payload: dict[str, Any]) -> None:
        if self._exchange is None:
            return
        message = aio_pika.Message(
            body=json.dumps(payload, default=str).encode(),
            content_type="application/json",
        )
        await self._exchange.publish(message, routing_key=routing_key)


rabbitmq = RabbitMQPublisher()
