from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers.tasks import router as tasks_router
from app.routers.session import router as session_router
from app.services.cache import task_cache
from app.services.rabbitmq import rabbitmq


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await task_cache.connect()
    await rabbitmq.connect()
    yield
    await task_cache.disconnect()
    await rabbitmq.disconnect()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(session_router)
