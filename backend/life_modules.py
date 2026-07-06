# Importy potrzebne do obsługi modułów życia (zakupy, praca, harmonogram)
from datetime import date, datetime
from typing import Optional

import models
from encryption import decrypt_field, encrypt_field
from sqlalchemy.orm import Session

# EXP przyznawane za zakupy i pracę (obecnie 0)
SHOPPING_EXP = 0
WORK_EXP = 0
# Dostępne kategorie zakupów
VALID_SHOPPING_CATEGORIES = {
    "veggies", "fruits", "dairy", "bread", "meat", "drinks", "chemicals", "sweets", "other",
}


# Parsuje czas w formacie HH:MM na godziny i minuty
def parse_time_hm(value: str) -> tuple[int, int]:
    parts = (value or "00:00").strip().split(":")
    if len(parts) != 2:
        raise ValueError("invalid time")
    hour = int(parts[0])
    minute = int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("invalid time")
    return hour, minute


# Oblicza liczbę godzin między dwoma czasami (obsługuje przejście przez północ)
def hours_between(start_time: str, end_time: str) -> float:
    sh, sm = parse_time_hm(start_time)
    eh, em = parse_time_hm(end_time)
    start_mins = sh * 60 + sm
    end_mins = eh * 60 + em
    if end_mins <= start_mins:
        end_mins += 24 * 60
    return round((end_mins - start_mins) / 60, 2)

# Konwertuje wpis harmonogramu na słownik (odszyfrowuje pola)
def schedule_to_dict(entry: models.ScheduleEntry) -> dict:
    """Przygotowuje dane harmonogramu do wysłania do frontendu."""
    return {
        "id": entry.id,
        # Odszyfrowujemy pole tytułu
        "title": decrypt_field(entry.title),
        # Odszyfrowujemy lokalizację
        "location": decrypt_field(entry.location),
        # Odszyfrowujemy nazwę prowadzącego
        "lecturer": decrypt_field(entry.lecturer),
        "day_of_week": entry.day_of_week,
        "entry_date": str(entry.entry_date) if entry.entry_date else None,
        "is_recurring": bool(entry.is_recurring),
        "start_time": entry.start_time,
        "end_time": entry.end_time,
        "created_at": str(entry.created_at),
        "completed": entry.completed,
        "start_date": str(entry.start_date) if entry.start_date else None,
        "end_date": str(entry.end_date) if entry.end_date else None,
    }


# Konwertuje przedmiot zakupowy na słownik (odszyfrowuje pola)
def shopping_to_dict(item: models.ShoppingItem) -> dict:
    """Przygotowuje dane zakupów do wysłania do frontendu."""
    return {
        "id": item.id,
        # Odszyfrowujemy nazwę produktu
        "name": decrypt_field(item.name),
        # Odszyfrowujemy ilość
        "quantity": decrypt_field(item.quantity),
        "unit": item.unit or "szt",
        "category": item.category,
        "bought": item.bought,
        "exp_awarded": item.exp_awarded,
        "price": item.price if hasattr(item, 'price') else 0.0,
        "created_at": str(item.created_at),
    }


# Pobiera stawkę godzinową z wpisu pracy (odszyfrowuje i parsuje)
def work_rate(entry: models.WorkEntry) -> float:
    """Zwraca stawkę godzinową jako liczbę zmiennoprzecinkową."""
    raw = decrypt_field(entry.hourly_rate)
    try:
        # Obsługujemy przecinki (polski format)
        return max(0.0, float(raw.replace(",", ".")))
    except ValueError:
        return 0.0


# Oblicza zarobki z wpisu pracy (brutto, podatek, netto)
def work_earnings(entry: models.WorkEntry) -> dict:
    """Oblicza wszystkie wartości zarobków na podstawie wpisu."""
    try:
        # Obliczamy liczbę godzin pracy
        hours = hours_between(entry.start_time, entry.end_time)
        # Pobieramy stawkę godzinową
        rate = work_rate(entry)
        # Brutto = godziny * stawka
        gross = round(hours * rate, 2)
        # Podatek = brutto * procent (jeśli włączony)
        tax = round(gross * (entry.tax_percent / 100), 2) if entry.tax_enabled else 0.0
        # Netto = brutto - podatek
        net = round(gross - tax, 2)
        return {"hours": hours, "gross": gross, "tax": tax, "net": net}
    except Exception as e:
        return {"hours": 0, "gross": 0, "tax": 0, "net": 0}


# Konwertuje wpis pracy na słownik z obliczonymi zarobkami
def work_to_dict(entry: models.WorkEntry) -> dict:
    """Przygotowuje dane pracy do wysłania do frontendu z obliczonymi zarobkami."""
    earnings = work_earnings(entry)
    return {
        "id": entry.id,
        "work_date": str(entry.work_date),
        "start_time": entry.start_time,
        "end_time": entry.end_time,
        "hourly_rate": work_rate(entry),
        "notes": decrypt_field(entry.notes),
        "tax_enabled": bool(entry.tax_enabled),
        "tax_percent": entry.tax_percent or 0.0,
        "completed": entry.completed,
        "exp_awarded": entry.exp_awarded,
        "created_at": str(entry.created_at),
        "is_recurring": entry.is_recurring,
        "day_of_week": entry.day_of_week,
        "end_date": str(entry.end_date) if entry.end_date else None,
        **earnings,
    }


# Sprawdza czy wpis harmonogramu pasuje do danej daty
def schedule_matches_date(entry: models.ScheduleEntry, target: date) -> bool:
    if entry.start_date and target < entry.start_date:
        return False
    if entry.end_date and target > entry.end_date:
        return False
    if entry.is_recurring:
        return entry.day_of_week == (target.weekday())
    return entry.entry_date == target


# Szyfruje pola wpisu harmonogramu przed zapisem do bazy
def encrypt_schedule_fields(title: str, location: str = "", lecturer: str = "") -> dict:
    return {
        "title": encrypt_field(title.strip()),
        "location": encrypt_field((location or "").strip()),
        "lecturer": encrypt_field((lecturer or "").strip()),
    }


# Szyfruje pola przedmiotu zakupowego przed zapisem do bazy
def encrypt_shopping_fields(name: str, quantity: str = "") -> dict:
    return {
        "name": encrypt_field(name.strip()),
        "quantity": encrypt_field((quantity or "").strip()),
    }


# Szyfruje pola wpisu pracy przed zapisem do bazy
def encrypt_work_fields(hourly_rate: float, notes: str = "") -> dict:
    return {
        "hourly_rate": encrypt_field(str(hourly_rate)),
        "notes": encrypt_field((notes or "").strip()),
    }


# Przyznaje EXP użytkownikowi i zwraca listę awansów na wyższe poziomy
def award_small_exp(user: models.User, amount: int) -> list[dict]:
    if amount <= 0:
        return []
    import game_content as gc

    old_exp = user.exp
    user.exp += amount
    level_ups = []
    old_level = gc.get_level(old_exp)[0]
    new_level = gc.get_level(user.exp)[0]
    for _, level, title in gc.LEVELS:
        if old_level < level <= new_level:
            level_ups.append({"level": level, "title": title})
    return level_ups


# Sumuje zarobki z listy wpisów pracy (opcjonalnie tylko ukończone)
def sum_work_earnings(entries: list[models.WorkEntry], completed_only: bool = True) -> dict:
    total_gross = 0.0
    total_net = 0.0
    total_hours = 0.0
    count = 0
    
    for entry in entries:
        if completed_only and not entry.completed:
            continue
        try:
            e = work_earnings(entry)
            total_gross += e["gross"]
            total_net += e["net"]
            total_hours += e["hours"]
            count += 1
        except Exception as e:
            pass
    
    return {
        "gross": round(total_gross, 2),
        "net": round(total_net, 2),
        "hours": round(total_hours, 2),
    }
