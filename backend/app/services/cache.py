import asyncio
import json
import os
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import redis.asyncio as redis

CACHE_KEY = "tasks:list"
CACHE_TTL = 30
LOCK_KEY = "lock:tasks:cache"
LOCK_TTL = 5
LOCK_WAIT_RETRIES = 20
LOCK_WAIT_INTERVAL = 0.05
UNLOCK_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"


class TaskCache:
    def __init__(self) -> None:
        self._redis: redis.Redis | None = None

    async def connect(self) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = redis.from_url(url, decode_responses=True)

    async def disconnect(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def get_tasks(self) -> list[dict[str, Any]] | None:
        if self._redis is None:
            return None
        data = await self._redis.get(CACHE_KEY)
        if data is None:
            return None
        return json.loads(data)

    async def set_tasks(self, tasks: list[dict[str, Any]]) -> None:
        if self._redis is None:
            return
        await self._redis.set(CACHE_KEY, json.dumps(tasks, default=str), ex=CACHE_TTL)

    async def get_or_set_tasks(
        self, fetcher: Callable[[], Awaitable[list[dict[str, Any]]]]
    ) -> list[dict[str, Any]] | None:
        if self._redis is None:
            return None

        cached = await self.get_tasks()
        if cached is not None:
            return cached

        token = str(uuid.uuid4())
        acquired = await self._redis.set(LOCK_KEY, token, nx=True, ex=LOCK_TTL)
        if acquired:
            try:
                cached = await self.get_tasks()
                if cached is not None:
                    return cached
                tasks = await fetcher()
                await self.set_tasks(tasks)
                return tasks
            finally:
                await self._redis.eval(UNLOCK_SCRIPT, 1, LOCK_KEY, token)

        for _ in range(LOCK_WAIT_RETRIES):
            await asyncio.sleep(LOCK_WAIT_INTERVAL)
            cached = await self.get_tasks()
            if cached is not None:
                return cached

        tasks = await fetcher()
        await self.set_tasks(tasks)
        return tasks

    async def invalidate(self) -> None:
        if self._redis is None:
            return

        token = str(uuid.uuid4())
        acquired = await self._redis.set(LOCK_KEY, token, nx=True, ex=LOCK_TTL)
        if acquired:
            try:
                await self._redis.delete(CACHE_KEY)
            finally:
                await self._redis.eval(UNLOCK_SCRIPT, 1, LOCK_KEY, token)
            return

        for _ in range(LOCK_WAIT_RETRIES):
            await asyncio.sleep(LOCK_WAIT_INTERVAL)
            if not await self._redis.exists(LOCK_KEY):
                return


task_cache = TaskCache()
