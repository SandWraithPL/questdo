from datetime import date, datetime, timedelta
from typing import List


def calculate_easter(year: int) -> date:
    """Calculate Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm."""
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
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def get_fixed_holidays(year: int) -> List[dict]:
    """Get fixed holidays for a given year."""
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
    """Get movable holidays for a given year (based on Easter)."""
    easter = calculate_easter(year)
    return [
        {"date": easter, "name": "Wielkanoc (Niedziela)", "day_type": "holiday"},
        {"date": easter + timedelta(days=1), "name": "Poniedziałek Wielkanocny", "day_type": "holiday"},
        {"date": easter + timedelta(days=49), "name": "Zielone Świątki", "day_type": "holiday"},
        {"date": easter + timedelta(days=60), "name": "Boże Ciało", "day_type": "holiday"},
    ]


def get_all_holidays(year: int) -> List[dict]:
    """Get all holidays (fixed and movable) for a given year."""
    holidays = get_fixed_holidays(year) + get_movable_holidays(year)
    return sorted(holidays, key=lambda x: x["date"])


def generate_holidays_for_year(year: int, user_id: int, db) -> int:
    """Generate holidays for a given year and add them to the database."""
    import models
    
    holidays = get_all_holidays(year)
    added_count = 0
    
    for holiday in holidays:
        existing = db.query(models.FreeDay).filter(
            models.FreeDay.owner_id == user_id,
            models.FreeDay.date == holiday["date"],
            models.FreeDay.day_type == "holiday"
        ).first()
        
        if not existing:
            free_day = models.FreeDay(
                owner_id=user_id,
                date=holiday["date"],
                day_type="holiday",
                notes=holiday["name"]
            )
            db.add(free_day)
            added_count += 1
    
    if added_count > 0:
        db.commit()
    
    return added_count
