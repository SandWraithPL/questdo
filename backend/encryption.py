import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

_fernet: Fernet | None = None


def _derive_key() -> bytes:
    raw = os.getenv("DATA_ENCRYPTION_KEY") or os.getenv("SECRET_KEY", "supersecretkey123")
    return base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest())


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_derive_key())
    return _fernet


def encrypt_field(value: str) -> str:
    if value is None:
        return ""
    text = str(value)
    if not text:
        return ""
    return _get_fernet().encrypt(text.encode()).decode()


def decrypt_field(value: str) -> str:
    if value is None:
        return ""
    text = str(value)
    if not text:
        return ""
    try:
        return _get_fernet().decrypt(text.encode()).decode()
    except (InvalidToken, ValueError):
        return text


def encrypt_optional(value: str | None) -> str:
    return encrypt_field(value or "")


def decrypt_optional(value: str | None) -> str:
    return decrypt_field(value or "")
