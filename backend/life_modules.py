from datetime import date, datetime
from typing import Optional

import models
from encryption import decrypt_field, encrypt_field
from sqlalchemy.orm import Session

SHOPPING_EXP = 0
WORK_EXP = 0
VALID_SHOPPING_CATEGORIES = {
    "veggies", "fruits", "dairy", "bread", "meat", "drinks", "chemicals", "sweets", "other",
}


def parse_time_hm(value: str) -> tuple[int, int]:
    parts = (value or "00:00").strip().split(":")
    if len(parts) != 2:
        raise ValueError("invalid time")
    hour = int(parts[0])
    minute = int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("invalid time")
    return hour, minute


def hours_between(start_time: str, end_time: str) -> float:
    sh, sm = parse_time_hm(start_time)
    eh, em = parse_time_hm(end_time)
    start_mins = sh * 60 + sm
    end_mins = eh * 60 + em
    if end_mins <= start_mins:
        end_mins += 24 * 60
    return round((end_mins - start_mins) / 60, 2)


def schedule_to_dict(entry: models.ScheduleEntry) -> dict:
    return {
        "id": entry.id,
        "title": decrypt_field(entry.title),
        "location": decrypt_field(entry.location),
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


def shopping_to_dict(item: models.ShoppingItem) -> dict:
    return {
        "id": item.id,
        "name": decrypt_field(item.name),
        "quantity": decrypt_field(item.quantity),
        "category": item.category,
        "bought": item.bought,
        "exp_awarded": item.exp_awarded,
        "price": item.price if hasattr(item, 'price') else 0.0,
        "created_at": str(item.created_at),
    }


def work_rate(entry: models.WorkEntry) -> float:
    raw = decrypt_field(entry.hourly_rate)
    try:
        return max(0.0, float(raw.replace(",", ".")))
    except ValueError:
        return 0.0


def work_earnings(entry: models.WorkEntry) -> dict:
    hours = hours_between(entry.start_time, entry.end_time)
    rate = work_rate(entry)
    gross = round(hours * rate, 2)
    tax = round(gross * (entry.tax_percent / 100), 2) if entry.tax_enabled else 0.0
    net = round(gross - tax, 2)
    return {"hours": hours, "gross": gross, "tax": tax, "net": net}


def work_to_dict(entry: models.WorkEntry) -> dict:
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


def schedule_matches_date(entry: models.ScheduleEntry, target: date) -> bool:
    if entry.start_date and target < entry.start_date:
        return False
    if entry.end_date and target > entry.end_date:
        return False
    if entry.is_recurring:
        return entry.day_of_week == (target.weekday())
    return entry.entry_date == target


def encrypt_schedule_fields(title: str, location: str = "", lecturer: str = "") -> dict:
    return {
        "title": encrypt_field(title.strip()),
        "location": encrypt_field((location or "").strip()),
        "lecturer": encrypt_field((lecturer or "").strip()),
    }


def encrypt_shopping_fields(name: str, quantity: str = "") -> dict:
    return {
        "name": encrypt_field(name.strip()),
        "quantity": encrypt_field((quantity or "").strip()),
    }


def encrypt_work_fields(hourly_rate: float, notes: str = "") -> dict:
    return {
        "hourly_rate": encrypt_field(str(hourly_rate)),
        "notes": encrypt_field((notes or "").strip()),
    }


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


def sum_work_earnings(entries: list[models.WorkEntry], completed_only: bool = True) -> dict:
    total_gross = 0.0
    total_net = 0.0
    total_hours = 0.0
    for entry in entries:
        if completed_only and not entry.completed:
            continue
        e = work_earnings(entry)
        total_gross += e["gross"]
        total_net += e["net"]
        total_hours += e["hours"]
    return {
        "gross": round(total_gross, 2),
        "net": round(total_net, 2),
        "hours": round(total_hours, 2),
    }
