# Importy do pracy z datami i typami
from datetime import date, datetime, timedelta
from typing import List


def calculate_easter(year: int) -> date:
    """Oblicza datę Wielkanocy na podstawie algorytmu Meeus/Jones/Butcher."""
    # Wszystkie poniższe kroki to algorytm astronomiczny do obliczenia Wielkanocy
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    # Ostateczne obliczenie miesiąca i dnia
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def get_fixed_holidays(year: int) -> List[dict]:
    """Zwraca listę świąt stałych (zawsze w tym samym dniu)."""
    return [
        {"date": date(year, 1, 1), "name": "Nowy Rok", "day_type": "holiday"},
        {"date": date(year, 1, 6), "name": "Trzech Króli", "day_type": "holiday"},
        {"date": date(year, 5, 1), "name": "Święto Pracy", "day_type": "holiday"},
        {"date": date(year, 5, 3), "name": "Konstytucja 3 Maja", "day_type": "holiday"},
        {"date": date(year, 8, 15), "name": "Wniebowzięcie NMP", "day_type": "holiday"},
        {"date": date(year, 11, 1), "name": "Wszystkich Świętych", "day_type": "holiday"},
        {"date": date(year, 11, 11), "name": "Święto Niepodległości", "day_type": "holiday"},
        {"date": date(year, 12, 25), "name": "Boże Narodzenie (1. dzień)", "day_type": "holiday"},
        {"date": date(year, 12, 26), "name": "Boże Narodzenie (2. dzień)", "day_type": "holiday"},
    ]


def get_movable_holidays(year: int) -> List[dict]:
    """Zwraca listę świąt ruchomych (zależą od daty Wielkanocy)."""
    easter = calculate_easter(year)
    return [
        {"date": easter, "name": "Wielkanoc (Niedziela)", "day_type": "holiday"},
        # Poniedziałek po Wielkanocy
        {"date": easter + timedelta(days=1), "name": "Poniedziałek Wielkanocny", "day_type": "holiday"},
        # Zielone Świątki = 49 dni po Wielkanocy
        {"date": easter + timedelta(days=49), "name": "Zielone Świątki", "day_type": "holiday"},
        # Boże Ciało = 60 dni po Wielkanocy
        {"date": easter + timedelta(days=60), "name": "Boże Ciało", "day_type": "holiday"},
    ]


def get_all_holidays(year: int) -> List[dict]:
    """Łączy święta stałe i ruchome, sortuje po dacie."""
    holidays = get_fixed_holidays(year) + get_movable_holidays(year)
    return sorted(holidays, key=lambda x: x["date"])


def generate_holidays_for_year(year: int, user_id: int, db) -> int:
    """Dodaje święta do kalendarza użytkownika na dany rok."""
    import models
    
    # Pobieramy wszystkie święta na rok
    holidays = get_all_holidays(year)
    added_count = 0
    
    # Iterujemy po każdym święcie
    for holiday in holidays:
        # Sprawdzamy czy to święto już istnieje w bazie
        existing = db.query(models.FreeDay).filter(
            models.FreeDay.owner_id == user_id,
            models.FreeDay.date == holiday["date"],
            models.FreeDay.day_type == "holiday"
        ).first()
        
        # Jeśli nie istnieje, dodajemy
        if not existing:
            free_day = models.FreeDay(
                owner_id=user_id,
                date=holiday["date"],
                day_type="holiday",
                notes=holiday["name"]
            )
            db.add(free_day)
            added_count += 1
    
    # Zapisujemy zmiany do bazy
    if added_count > 0:
        db.commit()
    
    return added_count
