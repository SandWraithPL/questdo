#!/usr/bin/env python3
"""
Skrypt do przywrócenia osiągnięcia "Kolekcjoner Znajdziek I" jeśli użytkownik ma 5+ znajdziek.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://questdo:questdo@db:5432/questdo")

def restore_achievement():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Sprawdź ile znajdziek ma użytkownik
        result = session.execute(text('SELECT COUNT(*) FROM player_rare_drops'))
        drops_count = result.fetchone()[0]
        print(f'Liczba znajdziek: {drops_count}')
        
        if drops_count < 5:
            print('Za mało znajdziek do osiągnięcia (potrzeba 5+)')
            return
        
        # Znajdź ID osiągnięcia
        result = session.execute(text("SELECT id FROM exclusive_achievements WHERE slug = 'collector_tier_1'"))
        ach_row = result.fetchone()
        
        if not ach_row:
            print('Nie znaleziono osiągnięcia w bazie')
            return
        
        ach_id = ach_row[0]
        print(f'ID osiągnięcia: {ach_id}')
        
        # Sprawdź czy już nie ma przypisania
        result = session.execute(text('SELECT COUNT(*) FROM player_exclusive_achievements WHERE exclusive_achievement_id = :ach_id'), {'ach_id': ach_id})
        existing = result.fetchone()[0]
        print(f'Istniejące przypisania: {existing}')
        
        if existing > 0:
            print('Osiągnięcie już istnieje - nie trzeba przywracać')
            return
        
        # Dodaj przypisanie dla user_id=1 (zakładam że to twój user)
        session.execute(text('INSERT INTO player_exclusive_achievements (user_id, exclusive_achievement_id, unlocked_at) VALUES (1, :ach_id, :now)'), {'ach_id': ach_id, 'now': datetime.utcnow()})
        session.commit()
        print('✅ Przywrócono osiągnięcie "Kolekcjoner Znajdziek I"!')
        
    except Exception as e:
        session.rollback()
        print(f'Błąd: {e}')
    finally:
        session.close()

if __name__ == "__main__":
    restore_achievement()
