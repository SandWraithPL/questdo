# Importy do szyfrowania danych
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

# Przechowujemy zaszyfrowanie (Fernet) aby nie tworzyć go każdy raz
_fernet: Fernet | None = None


def _derive_key() -> bytes:
    """Generujemy klucz szyfrowania z zmiennej środowiskowej lub sekretu domyślnego."""
    # Bierzemy klucz z zmiennej lub używamy domyślny
    raw = os.getenv("DATA_ENCRYPTION_KEY") or os.getenv("SECRET_KEY", "supersecretkey123")
    # Klucz musi być w formacie base64, więc hashujemy go SHA256
    return base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest())


def _get_fernet() -> Fernet:
    """Zwraca instancję Fernet (tworzony tylko raz i cachowany)."""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_derive_key())
    return _fernet


def encrypt_field(value: str) -> str:
    """Szyfruje tekst i zwraca zaszyfrowany string."""
    if value is None:
        return ""
    text = str(value)
    if not text:
        return ""
    # Szyfrujemy tekst kluczem Fernet
    return _get_fernet().encrypt(text.encode()).decode()


def decrypt_field(value: str) -> str:
    """Odszyfrowuje tekst. Jeśli się nie uda, zwraca oryginalny tekst."""
    if value is None:
        return ""
    text = str(value)
    if not text:
        return ""
    try:
        # Próbujemy odszyfrować
        return _get_fernet().decrypt(text.encode()).decode()
    except (InvalidToken, ValueError):
        # Jeśli to nie zaszyfrowany tekst, zwracamy jaki jest
        return text


def encrypt_optional(value: str | None) -> str:
    """Szyfruje opcjonalny tekst (może być None)."""
    return encrypt_field(value or "")


def decrypt_optional(value: str | None) -> str:
    """Odszyfrowuje opcjonalny tekst (może być None)."""
    return decrypt_field(value or "")
