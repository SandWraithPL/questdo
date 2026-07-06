# Importy do pracy z bazą danych
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# URL do bazy danych PostgreSQL (z opcją domyślną na localhost)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://questdo:questdo@db:5432/questdo")

# Tworzymy silnik bazy danych
engine = create_engine(DATABASE_URL)

# Tworzymy session factory - używamy do tworzenia sesji z bazą
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base do definiowania modeli (tabele będą dziedziczyć z tego)
Base = declarative_base()


def get_db():
    """Funkcja tworzy sesję z bazą i zwraca ją. Po użyciu automatycznie zamyka."""
    db = SessionLocal()
    try:
        yield db
    finally:
        # Zamykamy połączenie po zakończeniu
        db.close()