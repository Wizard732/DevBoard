from fastapi import APIRouter
from pydantic import BaseModel
from cryptography.hazmat.primitives.asymmetric.ec import (
    ECDH,
    SECP256R1,
    generate_private_key,
    EllipticCurvePublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    load_der_public_key,
)
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os

router = APIRouter()

# храним сессионный ключ в памяти (для одной сессии)
# в проде — использовать Redis с TTL
session_store: dict[str, bytes] = {}


class SessionInitRequest(BaseModel):
    public_key: str  # base64 DER публичный ключ от фронта


class SessionInitResponse(BaseModel):
    public_key: str   # base64 DER публичный ключ бэка
    session_id: str   # идентификатор сессии


@router.post("/session/init", response_model=SessionInitResponse)
def session_init(body: SessionInitRequest):

    # if send test return session_id = test-session
    if body.public_key == "test":
        session_store["test-session"] = b"0" * 32  # key for testing 
        return {"public_key": "test", "session_id": "test-session"} # return default dictionary 
    
    


    # 1. декодируем публичный ключ фронта
    frontend_public_bytes = base64.b64decode(body.public_key)
    frontend_public_key: EllipticCurvePublicKey = load_der_public_key(frontend_public_bytes)

    # 2. генерируем свою ECDH-пару
    backend_private_key = generate_private_key(SECP256R1())
    backend_public_key = backend_private_key.public_key()

    # 3. вычисляем shared secret
    shared_secret = backend_private_key.exchange(ECDH(), frontend_public_key)

    # 4. выводим AES-256 ключ через HKDF
    aes_key = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=None,
        info=b"devboard-session",
    ).derive(shared_secret)

    # 5. сохраняем ключ по session_id
    session_id = base64.b64encode(os.urandom(16)).decode()
    session_store[session_id] = aes_key

    # 6. отдаём публичный ключ бэка фронту
    backend_public_bytes = backend_public_key.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)

    return SessionInitResponse(
        public_key=base64.b64encode(backend_public_bytes).decode(),
        session_id=session_id,
    )


def decrypt_description(session_id: str, encrypted: str) -> str:
    """Расшифровывает description задачи. Вызывается из роута tasks."""
    aes_key = session_store.get(session_id)
    if not aes_key:
        raise ValueError("Сессия не найдена")

    # формат: base64(iv + ciphertext)
    raw = base64.b64decode(encrypted)
    iv = raw[:12]
    ciphertext = raw[12:]

    aesgcm = AESGCM(aes_key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode()


def encrypt_description(session_id: str, plaintext: str) -> str:
    """Шифрует description задачи при отдаче клиенту."""
    aes_key = session_store.get(session_id)
    if not aes_key:
        return plaintext  # если сессии нет — отдаём как есть

    iv = os.urandom(12)
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode(), None)
    return base64.b64encode(iv + ciphertext).decode()