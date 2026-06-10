import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.cache import task_cache
from app.services.field_crypto import decrypt_at_rest, encrypt_at_rest
from app.services.rabbitmq import rabbitmq
from app.routers.session import decrypt_description, encrypt_description

router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self.session_by_connection: dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.session_by_connection:
            del self.session_by_connection[websocket]

    def set_session(self, websocket: WebSocket, session_id: str) -> None:
        self.session_by_connection[websocket] = session_id

    async def broadcast(self, payload: dict) -> None:
        for connection in list(self.active_connections):
            try:
                item = payload
                session_id = self.session_by_connection.get(connection)
                if session_id and payload.get("task") and payload["task"].get("description"):
                    item = {
                        **payload,
                        "task": {
                            **payload["task"],
                            "description": encrypt_description(
                                session_id, payload["task"]["description"]
                            ),
                        },
                    }
                await connection.send_text(json.dumps(item, default=str))
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


def task_to_dict(task: Task) -> dict:
    if task.description:
        try:
            description_plain = decrypt_at_rest(task.description)
        except Exception:
            description_plain = task.description
    else:
        description_plain = ""
    return {
        "id": str(task.id),
        "title": task.title,
        "description": description_plain,
        "priority": task.priority.value,
        "status": task.status.value,
        "created_at": task.created_at.isoformat(),
    }


async def publish_and_broadcast(event: str, routing_key: str, task: Task) -> None:
    payload = {"event": event, "task": task_to_dict(task)}
    await rabbitmq.publish(routing_key, payload)
    await manager.broadcast(payload)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if isinstance(msg, dict) and msg.get("type") == "session" and msg.get("session_id"):
                manager.set_session(websocket, str(msg["session_id"]))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    x_session_id: str | None = Header(default=None),
) -> list[TaskResponse]:
    async def fetcher() -> list[dict]:
        result = await db.execute(select(Task).order_by(Task.created_at.desc()))
        tasks = result.scalars().all()
        return [task_to_dict(task) for task in tasks]

    plain = await task_cache.get_or_set_tasks(fetcher)
    if plain is None:
        plain = await fetcher()

    if x_session_id:
        encrypted = []
        for item in plain:
            encrypted.append(
                {
                    **item,
                    "description": encrypt_description(x_session_id, item.get("description") or ""),
                }
            )
        return [TaskResponse.model_validate(item) for item in encrypted]

    return [TaskResponse.model_validate(item) for item in plain]


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    x_session_id: str | None = Header(default=None),
) -> TaskResponse:
    description = task_in.description

    if x_session_id and description:
        description = decrypt_description(x_session_id, description)

    encrypted_for_db = encrypt_at_rest(description or "")

    new_task = Task(
        title=task_in.title,
        description=encrypted_for_db,
        priority=task_in.priority,
        status=task_in.status,
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)

    await task_cache.invalidate()
    await publish_and_broadcast("task_created", "task.created", new_task)
    if x_session_id:
        payload = task_to_dict(new_task)
        payload["description"] = encrypt_description(x_session_id, payload.get("description") or "")
        return TaskResponse.model_validate(payload)
    return TaskResponse.model_validate(task_to_dict(new_task))


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    x_session_id: str | None = Header(default=None),
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.status = task_in.status
    await db.commit()
    await db.refresh(task)

    await task_cache.invalidate()
    await publish_and_broadcast("task_updated", "task.updated", task)
    payload = task_to_dict(task)
    if x_session_id:
        payload["description"] = encrypt_description(x_session_id, payload.get("description") or "")
    return TaskResponse.model_validate(payload)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await db.delete(task)
    await db.commit()

    await task_cache.invalidate()
    await publish_and_broadcast("task_deleted", "task.deleted", task)
