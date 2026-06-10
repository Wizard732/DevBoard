import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _load_key() -> bytes:
    key_b64 = os.getenv("DB_ENCRYPTION_KEY")
    if not key_b64:
        raise RuntimeError("DB_ENCRYPTION_KEY is required")
    return base64.b64decode(key_b64)


def encrypt_at_rest(plaintext: str) -> str:
    key = _load_key()
    aesgcm = AESGCM(key)
    iv = os.urandom(12)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode(), None)
    return base64.b64encode(iv + ciphertext).decode()


def decrypt_at_rest(ciphertext_b64: str) -> str:
    key = _load_key()
    raw = base64.b64decode(ciphertext_b64)
    iv = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode()
