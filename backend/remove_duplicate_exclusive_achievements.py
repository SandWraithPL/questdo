#!/usr/bin/env python3
"""
Skrypt do usuwania duplikatów w player_exclusive_achievements.
Zachowuje najstarszy wpis dla każdej pary (user_id, exclusive_achievement_id).
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Używamy tej samej konfiguracji co aplikacja
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://questdo:questdo@db:5432/questdo")

def remove_duplicates():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Znajdź duplikaty
        result = session.execute(text("""
            SELECT user_id, exclusive_achievement_id, COUNT(*) as cnt
            FROM player_exclusive_achievements
            GROUP BY user_id, exclusive_achievement_id
            HAVING COUNT(*) > 1
        """))
        
        duplicates = result.fetchall()
        
        if not duplicates:
            print("Brak duplikatów w player_exclusive_achievements")
            return
        
        print(f"Znaleziono {len(duplicates)} par z duplikatami")
        
        # Usuń duplikaty, zachowując najstarszy (najmniejsze id)
        for user_id, achievement_id, count in duplicates:
            # Pobierz wszystkie wpisy dla tej pary, posortowane po id
            result = session.execute(text("""
                SELECT id
                FROM player_exclusive_achievements
                WHERE user_id = :user_id AND exclusive_achievement_id = :achievement_id
                ORDER BY id ASC
            """), {"user_id": user_id, "achievement_id": achievement_id})
            
            ids = [row[0] for row in result.fetchall()]
            
            # Zachowaj pierwszy, usuń resztę
            keep_id = ids[0]
            delete_ids = ids[1:]
            
            print(f"  User {user_id}, Achievement {achievement_id}: usuwam {len(delete_ids)} duplikatów (zachowuję id={keep_id})")
            
            for delete_id in delete_ids:
                session.execute(text("DELETE FROM player_exclusive_achievements WHERE id = :id"), {"id": delete_id})
        
        session.commit()
        print("Duplikaty usunięte pomyślnie")
        
    except Exception as e:
        session.rollback()
        print(f"Błąd: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    remove_duplicates()
