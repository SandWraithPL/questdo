from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional, List
import models
from database import get_db, engine
from encryption import encrypt_field, decrypt_field
import life_modules as lm
from sqlalchemy import inspect, text
import daily_quests as dq
import game_content as gc
import time
import random
import math
import os
import json
import threading
from zoneinfo import ZoneInfo
import logging

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None
    WebPushException = Exception

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("questdo")

FORBIDDEN_USERNAMES = ["dominik", "knyc", "spust", "obrzydliwe", "sex", "porno"]

REMINDER_TZ = ZoneInfo("Europe/Warsaw")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CONTACT = os.getenv("VAPID_CONTACT", "mailto:questdo@example.com")

def create_tables():
    for i in range(10):
        try:
            models.Base.metadata.create_all(bind=engine)
            migrate_schema()
            print("Baza danych połączona!")
            return
        except Exception as e:
            print(f"Baza nie gotowa, próba {i+1}/10... czekam 3s")
            time.sleep(3)
    raise Exception("Nie udało się połączyć z bazą danych")


def migrate_schema():
    insp = inspect(engine)
    if "tasks" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("tasks")}
    with engine.begin() as conn:
        if "exp_awarded" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN exp_awarded BOOLEAN DEFAULT FALSE"))
            print("Migracja: dodano kolumnę exp_awarded")
        if "due_date" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN due_date DATE DEFAULT CURRENT_DATE"))
            print("Migracja: dodano kolumnę due_date")
        if "exp_awarded_amount" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN exp_awarded_amount INTEGER DEFAULT 0"))
            print("Migracja: dodano kolumnę exp_awarded_amount")
        if "completed_at" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP"))
            print("Migracja: dodano kolumnę completed_at")
        if "important" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN important BOOLEAN DEFAULT FALSE"))
            print("Migracja: dodano kolumnę important")
        if "reminder_offset_days" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN reminder_offset_days INTEGER"))
            print("Migracja: dodano kolumnę reminder_offset_days")
        if "delayed_rewards_claimed" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN delayed_rewards_claimed BOOLEAN DEFAULT FALSE"))
            print("Migracja: dodano kolumnę delayed_rewards_claimed")
        if "delayed_rewards_forfeited" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN delayed_rewards_forfeited BOOLEAN DEFAULT FALSE"))
            print("Migracja: dodano kolumnę delayed_rewards_forfeited")
        if "exp_timing" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN exp_timing VARCHAR"))
            print("Migracja: dodano kolumnę exp_timing")
        if "task_type" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN task_type VARCHAR DEFAULT 'quest'"))
            print("Migracja: dodano kolumnę task_type")
        if "event_category" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN event_category VARCHAR"))
            print("Migracja: dodano kolumnę event_category")
        if "recurring_pattern" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN recurring_pattern VARCHAR"))
            print("Migracja: dodano kolumnę recurring_pattern")
        if "recurring_end_date" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN recurring_end_date DATE"))
            print("Migracja: dodano kolumnę recurring_end_date")
    if "daily_quest_assignments" not in insp.get_table_names():
        models.DailyQuestAssignment.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę daily_quest_assignments")
    if "achievements" in insp.get_table_names():
        ach_cols = {c["name"] for c in insp.get_columns("achievements")}
        if "title" not in ach_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE achievements ADD COLUMN title VARCHAR"))
            print("Migracja: dodano kolumnę achievements.title")

    if "users" in insp.get_table_names():
        user_cols = {c["name"] for c in insp.get_columns("users")}
        if "last_streak_date" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_streak_date DATE"))
            print("Migracja: dodano kolumnę users.last_streak_date")
        if "progress_reset_at" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN progress_reset_at TIMESTAMP"))
            print("Migracja: dodano kolumnę users.progress_reset_at")
        if "exp_at_progress_reset" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN exp_at_progress_reset INTEGER DEFAULT 0"))
            print("Migracja: dodano kolumnę users.exp_at_progress_reset")
        if "default_category" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN default_category VARCHAR DEFAULT 'other'"))
            print("Migracja: dodano kolumnę users.default_category")
        if "default_hourly_rate" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN default_hourly_rate FLOAT"))
            print("Migracja: dodano kolumnę users.default_hourly_rate")

    if "rare_drops" not in insp.get_table_names():
        models.RareDrop.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę rare_drops")
    if "player_rare_drops" not in insp.get_table_names():
        models.PlayerRareDrop.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę player_rare_drops")
    elif "player_rare_drops" in insp.get_table_names():
        prd_cols = {c["name"] for c in insp.get_columns("player_rare_drops")}
        if "source_task_id" not in prd_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE player_rare_drops ADD COLUMN source_task_id INTEGER REFERENCES tasks(id)"))
            print("Migracja: dodano kolumnę player_rare_drops.source_task_id")

    if "exclusive_achievements" not in insp.get_table_names():
        models.ExclusiveAchievement.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę exclusive_achievements")
    if "player_exclusive_achievements" not in insp.get_table_names():
        models.PlayerExclusiveAchievement.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę player_exclusive_achievements")

    if "player_badges" not in insp.get_table_names():
        models.PlayerBadge.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę player_badges")

    if "player_history" not in insp.get_table_names():
        models.PlayerHistory.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę player_history")

    if "schedule_entries" not in insp.get_table_names():
        models.ScheduleEntry.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę schedule_entries")
    if "shopping_items" not in insp.get_table_names():
        models.ShoppingItem.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę shopping_items")
    if "work_entries" not in insp.get_table_names():
        models.WorkEntry.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę work_entries")
    elif "work_entries" in insp.get_table_names():
        work_cols = {c["name"] for c in insp.get_columns("work_entries")}
        if "is_recurring" not in work_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE work_entries ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE"))
            print("Migracja: dodano kolumnę work_entries.is_recurring")
        if "day_of_week" not in work_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE work_entries ADD COLUMN day_of_week INTEGER"))
            print("Migracja: dodano kolumnę work_entries.day_of_week")
        if "end_date" not in work_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE work_entries ADD COLUMN end_date DATE"))
            print("Migracja: dodano kolumnę work_entries.end_date")
    if "default_articles" not in insp.get_table_names():
        models.DefaultArticle.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę default_articles")

    if "shopping_items" in insp.get_table_names():
        shopping_cols = {c["name"] for c in insp.get_columns("shopping_items")}
        if "price" not in shopping_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE shopping_items ADD COLUMN price FLOAT DEFAULT 0.0"))
            print("Migracja: dodano kolumnę shopping_items.price")
        if "family_id" not in shopping_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE shopping_items ADD COLUMN family_id INTEGER REFERENCES families(id)"))
            print("Migracja: dodano kolumnę shopping_items.family_id")

    if "shopping_history" in insp.get_table_names():
        history_cols = {c["name"] for c in insp.get_columns("shopping_history")}
        if "is_template" not in history_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE shopping_history ADD COLUMN is_template BOOLEAN DEFAULT FALSE"))
            print("Migracja: dodano kolumnę shopping_history.is_template")
        if "family_id" not in history_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE shopping_history ADD COLUMN family_id INTEGER REFERENCES families(id)"))
            print("Migracja: dodano kolumnę shopping_history.family_id")

    if "families" not in insp.get_table_names():
        models.Family.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę families")
    if "family_members" not in insp.get_table_names():
        models.FamilyMember.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę family_members")
    if "family_invitations" not in insp.get_table_names():
        models.FamilyInvitation.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę family_invitations")

    if "recurring_events" not in insp.get_table_names():
        models.RecurringEvent.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę recurring_events")
    elif "recurring_events" in insp.get_table_names():
        re_cols = {c["name"] for c in insp.get_columns("recurring_events")}
        if "interval_type" not in re_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE recurring_events ADD COLUMN interval_type VARCHAR"))
            print("Migracja: dodano kolumnę recurring_events.interval_type")
        if "interval_value" not in re_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE recurring_events ADD COLUMN interval_value INTEGER"))
            print("Migracja: dodano kolumnę recurring_events.interval_value")
        if "start_date" not in re_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE recurring_events ADD COLUMN start_date DATE"))
            print("Migracja: dodano kolumnę recurring_events.start_date")
        if "end_date" not in re_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE recurring_events ADD COLUMN end_date DATE"))
            print("Migracja: dodano kolumnę recurring_events.end_date")

    if "free_days" not in insp.get_table_names():
        models.FreeDay.__table__.create(bind=engine)
        print("Migracja: utworzono tabelę free_days")

    db = next(get_db())
    rare_drop_count = db.query(models.RareDrop).count()
    if rare_drop_count == 0:
        for drop_def in gc.RARE_DROPS:
            rare_drop = models.RareDrop(
                slug=drop_def["slug"],
                name=drop_def["name"],
                description=drop_def["description"],
                icon=drop_def["icon"],
                rarity=drop_def["rarity"],
                drop_chance_percent=drop_def["drop_chance"]
            )
            db.add(rare_drop)
        db.commit()
        print(f"Migracja: załadowano {len(gc.RARE_DROPS)} rare drops")
    else:
        for drop_def in gc.RARE_DROPS:
            rare_drop = db.query(models.RareDrop).filter(models.RareDrop.slug == drop_def["slug"]).first()
            if rare_drop:
                rare_drop.name = drop_def["name"]
                rare_drop.description = drop_def["description"]
                rare_drop.icon = drop_def["icon"]
                rare_drop.rarity = drop_def["rarity"]
                rare_drop.drop_chance_percent = drop_def["drop_chance"]
        db.commit()

    exclusive_ach_count = db.query(models.ExclusiveAchievement).count()
    if exclusive_ach_count == 0:
        for ea_def in gc.EXCLUSIVE_ACHIEVEMENTS:
            exclusive_ach = models.ExclusiveAchievement(
                slug=ea_def["slug"],
                title=ea_def["title"],
                description=ea_def["description"],
                icon=ea_def["icon"],
                requirement_type=ea_def["type"]
            )
            db.add(exclusive_ach)
        db.commit()
        print(f"Migracja: załadowano {len(gc.EXCLUSIVE_ACHIEVEMENTS)} exclusive achievements")
    else:
        for ea_def in gc.EXCLUSIVE_ACHIEVEMENTS:
            exclusive_ach = db.query(models.ExclusiveAchievement).filter(
                models.ExclusiveAchievement.slug == ea_def["slug"]
            ).first()
            if exclusive_ach:
                exclusive_ach.title = ea_def["title"]
                exclusive_ach.description = ea_def["description"]
                exclusive_ach.icon = ea_def["icon"]
                exclusive_ach.requirement_type = ea_def["type"]
        db.commit()


app = FastAPI(title="QuestDo API")

@app.middleware("http")
async def log_client_ip(request: Request, call_next):

    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host

    logger.info(f"IP: {client_ip} -> {request.method} {request.url.path}")

    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000

    logger.info(f"IP: {client_ip} <- {response.status_code} ({duration_ms:.2f}ms)")

    return response

def _push_configured() -> bool:
    return bool(webpush and VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)


def task_reminder_date(task: models.Task) -> Optional[date]:
    if task.reminder_offset_days is None:
        return None
    return task.due_date - timedelta(days=int(task.reminder_offset_days))


def send_push_to_user(db: Session, user_id: int, body: str, url: str = "/") -> int:
    if not _push_configured():
        return 0
    subs = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == user_id).all()
    payload = json.dumps({"title": "QuestDo", "body": body, "data": {"url": url}})
    sent = 0
    for sub in subs:
        subscription = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CONTACT},
            )
            sent += 1
        except WebPushException as exc:
            print(f"[push] failed for subscription {sub.id}: {exc}")
            if getattr(exc, "response", None) and exc.response.status_code in (404, 410):
                db.delete(sub)
    return sent


def work_matches_date(entry: models.WorkEntry, target_date: date) -> bool:
    if entry.is_recurring:
        if entry.end_date and target_date > entry.end_date:
            return False
        return entry.day_of_week == target_date.weekday()
    return entry.work_date == target_date


def process_work_auto_completion():
    db = next(get_db())
    try:
        now = datetime.now(REMINDER_TZ)
        today = now.date()
        current_minutes = now.hour * 60 + now.minute
        entries = (
            db.query(models.WorkEntry)
            .filter(models.WorkEntry.completed.is_(False))
            .all()
        )
        changed = False
        completed_count = 0
        for entry in entries:
            if not work_matches_date(entry, today):
                continue
            try:
                eh, em = lm.parse_time_hm(entry.end_time)
            except ValueError:
                continue
            if current_minutes < eh * 60 + em:
                continue
            entry.completed = True
            changed = True
            completed_count += 1
        if changed:
            db.commit()
            print(f"[work-auto] Auto-completed {completed_count} work entries at {now}")
    except Exception as exc:
        db.rollback()
        print(f"[work-auto] scheduler error: {exc}")
    finally:
        db.close()


def recurring_event_occurs_on(event: models.RecurringEvent, target_date: date) -> bool:
    if event.interval_type and event.start_date:
        start = event.start_date
        if target_date < start:
            return False
        if event.end_date and target_date > event.end_date:
            return False
        iv = event.interval_value or 1
        if event.interval_type == "daily":
            return (target_date - start).days % iv == 0
        if event.interval_type == "weekly":
            return (target_date - start).days % (iv * 7) == 0
        if event.interval_type == "monthly":
            if target_date.day != start.day:
                return False
            months = (target_date.year - start.year) * 12 + (target_date.month - start.month)
            return months >= 0 and months % iv == 0
        if event.interval_type == "yearly":
            if target_date.month != start.month or target_date.day != start.day:
                return False
            years = target_date.year - start.year
            return years >= 0 and years % iv == 0
        return False
    if event.month and event.day:
        return target_date.month == event.month and target_date.day == event.day
    return False


def process_scheduled_reminders():
    if not _push_configured():
        return
    db = next(get_db())
    try:
        now = datetime.now(REMINDER_TZ)
        if now.hour != 9 or now.minute > 1:
            return
        today = now.date()
        tasks = (
            db.query(models.Task)
            .filter(
                models.Task.completed.is_(False),
                models.Task.reminder_offset_days.isnot(None),
            )
            .all()
        )
        for task in tasks:
            reminder_on = task_reminder_date(task)
            if reminder_on != today:
                continue
            already = (
                db.query(models.SentTaskReminder)
                .filter(
                    models.SentTaskReminder.task_id == task.id,
                    models.SentTaskReminder.reminder_on == reminder_on,
                )
                .first()
            )
            if already:
                continue
            body = f'Przypomnienie: zadanie „{task_display_title(task)}" ma termin {task.due_date}'
            url = f"/?date={task.due_date}"
            send_push_to_user(db, task.owner_id, body, url)
            db.add(
                models.SentTaskReminder(
                    task_id=task.id,
                    reminder_on=reminder_on,
                )
            )
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[reminders] scheduler error: {exc}")
    finally:
        db.close()


def reminder_scheduler_loop():
    while True:
        try:
            process_work_auto_completion()
            process_scheduled_reminders()
        except Exception as exc:
            print(f"[reminders] loop error: {exc}")
        time.sleep(60)


@app.on_event("startup")
def startup_event():
    create_tables()
    threading.Thread(target=reminder_scheduler_loop, daemon=True).start()
    print("[scheduler] Work auto-complete + push reminders started (Europe/Warsaw)")
    if not _push_configured():
        print("[push] Web Push disabled — set VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "supersecretkey123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

EXP_REWARDS = {"easy": 10, "medium": 25, "hard": 50}
DELAYED_REWARD_HOURS = 24
EARLY_EXP_MULTIPLIER = 1.5
LATE_EXP_MULTIPLIER = 0.5
MIN_EXP_REWARD = 1
VALID_DIFFICULTIES = {"easy", "medium", "hard"}
VALID_CATEGORIES = {
    "Inne", "Studia", "Nauka", "Dom", "Praca", "Sport", "Projekt", "Zakupy", "Zdrowie"
}


def parse_due_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowa data (YYYY-MM-DD)")


def validate_title(title: str) -> str:
    t = (title or "").strip()
    if len(t) < 1:
        raise HTTPException(status_code=400, detail="Tytuł zadania jest wymagany")
    if len(t) > 200:
        raise HTTPException(status_code=400, detail="Tytuł może mieć max 200 znaków")
    return t


def validate_difficulty(difficulty: str) -> str:
    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(status_code=400, detail="Nieprawidłowa trudność")
    return difficulty


def validate_category(category: str) -> str:
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Nieprawidłowa kategoria")
    return category


def validate_reminder_offset(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    if value not in {0, 1, 3, 7}:
        raise HTTPException(status_code=400, detail="Nieprawidłowy termin przypomnienia")
    return value


def validate_account_credentials(username: str, password: str) -> tuple[str, str]:
    clean_username = (username or "").strip()
    clean_password = (password or "").strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Nazwa użytkownika jest wymagana")
    if not clean_password:
        raise HTTPException(status_code=400, detail="Hasło jest wymagane")
    if len(clean_username) > 50:
        raise HTTPException(status_code=400, detail="Nazwa użytkownika może mieć max 50 znaków")
    if len(clean_password) < 3:
        raise HTTPException(status_code=400, detail="Hasło musi mieć min. 3 znaki")
    return clean_username, clean_password


def task_can_reschedule(task: models.Task) -> bool:
    return not task.completed and not task.exp_awarded


def calculate_exp_reward(difficulty: str, due_date: date, completed_on: datetime) -> tuple[int, str]:
    base = EXP_REWARDS.get(difficulty, 10)
    local_tz = ZoneInfo("Europe/Warsaw")
    completed_local = completed_on.astimezone(local_tz).date()

    if completed_local < due_date:
        amount = max(MIN_EXP_REWARD, math.floor(base * EARLY_EXP_MULTIPLIER))
        timing = "early"
    elif completed_local > due_date:
        amount = max(MIN_EXP_REWARD, math.floor(base * LATE_EXP_MULTIPLIER))
        timing = "late"
    else:
        amount = base
        timing = "ontime"
    return amount, timing


def normalize_streak(user: models.User) -> bool:
    today = date.today()
    if user.streak and user.last_streak_date and user.last_streak_date < today - timedelta(days=1):
        user.streak = 0
        user.last_streak_date = None
        return True
    return False


def task_display_title(task: models.Task) -> str:
    return decrypt_field(task.title)


def task_to_dict(t: models.Task) -> dict:
    data = {
        "id": t.id,
        "title": decrypt_field(t.title),
        "description": decrypt_field(t.description),
        "difficulty": t.difficulty,
        "category": t.category,
        "completed": t.completed,
        "exp_awarded": t.exp_awarded,
        "exp_awarded_amount": t.exp_awarded_amount or 0,
        "important": bool(t.important),
        "reminder_offset_days": t.reminder_offset_days,
        "due_date": str(t.due_date),
        "created_at": str(t.created_at),
        "task_type": t.task_type or "quest",
        "event_category": t.event_category,
        "recurring_pattern": t.recurring_pattern,
        "recurring_end_date": str(t.recurring_end_date) if t.recurring_end_date else None,
    }
    if t.completed and t.exp_awarded and t.completed_at:
        data["completed_at"] = str(t.completed_at)
    if t.exp_awarded and t.exp_timing:
        data["exp_timing"] = t.exp_timing
    if not t.completed and t.due_date and t.task_type == "quest":
        preview, timing = calculate_exp_reward(t.difficulty, t.due_date, datetime.utcnow())
        data["exp_preview"] = preview
        data["exp_timing_preview"] = timing
    return data


def format_diary_message(body: str, occurred_at: Optional[datetime] = None) -> str:
    return body


def history_key_task(user_id: int, task_id: int, kind: str, slug: str) -> str:
    return f"user:{user_id}:task:{task_id}:{kind}:{slug}"


def add_history_event(
    user_id: int,
    event_type: str,
    event_key: str,
    message: str,
    db: Session,
    occurred_at: Optional[datetime] = None,
) -> bool:
    if db.query(models.PlayerHistory).filter(models.PlayerHistory.event_key == event_key).first():
        return False
    at = occurred_at or datetime.utcnow()
    db.add(models.PlayerHistory(
        user_id=user_id,
        event_type=event_type,
        event_key=event_key,
        message=format_diary_message(message, at),
        occurred_at=at,
    ))
    db.flush()
    return True


def user_owns_rare_drop_slug(user_id: int, slug: str, db: Session) -> bool:
    return db.query(models.PlayerRareDrop).join(models.RareDrop).filter(
        models.PlayerRareDrop.user_id == user_id,
        models.RareDrop.slug == slug,
    ).first() is not None


def build_rare_drops_inventory(user_id: int, db: Session) -> dict:
    drops = db.query(models.PlayerRareDrop).filter(
        models.PlayerRareDrop.user_id == user_id
    ).all()

    by_slug = {}
    for drop in drops:
        slug = drop.rare_drop.slug
        if slug not in by_slug:
            by_slug[slug] = {
                "slug": drop.rare_drop.slug,
                "name": drop.rare_drop.name,
                "description": drop.rare_drop.description,
                "icon": drop.rare_drop.icon,
                "rarity": drop.rare_drop.rarity,
                "count": 1,
                "obtained_dates": [str(drop.obtained_date)],
            }
        else:
            by_slug[slug]["obtained_dates"].append(str(drop.obtained_date))

    items = list(by_slug.values())
    rarity_counts = {}
    for item in items:
        rarity = item["rarity"]
        rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1

    return {
        "total_items": len(items),
        "unique_items": len(items),
        "by_rarity": rarity_counts,
        "items": items,
    }


def build_history_list(user_id: int, db: Session, limit: int = 200) -> list:
    entries = db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == user_id
    ).order_by(models.PlayerHistory.occurred_at.desc()).limit(limit).all()
    return [{
        "id": entry.id,
        "type": entry.event_type,
        "message": entry.message,
        "occurred_at": str(entry.occurred_at),
    } for entry in entries]


def build_achievements_payload(user: models.User, db: Session) -> dict:
    user_achs = db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == user.id
    ).all()
    stats = gc.gather_user_stats(user, db, models)
    unlocked_slugs = get_unlocked_slugs(user.id, db)
    unlocked = [{
        "slug": ua.achievement.name,
        "title": achievement_display(ua.achievement),
        "description": ua.achievement.description,
        "icon": ua.achievement.icon,
        "unlocked_at": str(ua.unlocked_at),
    } for ua in user_achs]
    player_exclusive = db.query(models.PlayerExclusiveAchievement).filter(
        models.PlayerExclusiveAchievement.user_id == user.id
    ).all()
    for pa in player_exclusive:
        ea = pa.exclusive_achievement
        unlocked.append({
            "slug": ea.slug,
            "title": ea.title,
            "description": ea.description,
            "icon": ea.icon,
            "unlocked_at": str(pa.unlocked_at),
        })
    return {
        "unlocked": unlocked,
        "next": gc.get_next_achievement(stats, unlocked_slugs),
    }


def revoke_standard_achievement(user_id: int, slug: str, db: Session) -> None:
    achievement = db.query(models.Achievement).filter(models.Achievement.name == slug).first()
    if not achievement:
        return
    db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == user_id,
        models.UserAchievement.achievement_id == achievement.id,
    ).delete(synchronize_session=False)
    deleted_count = db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == user_id,
        models.PlayerHistory.event_key.like(f"user:{user_id}:%:achievement:{slug}")
    ).delete(synchronize_session=False)
    print(f"[revoke_standard_achievement] Deleted {deleted_count} history entries for achievement '{slug}'")


def revoke_exclusive_achievement(user_id: int, slug: str, db: Session) -> None:
    ach = db.query(models.ExclusiveAchievement).filter(models.ExclusiveAchievement.slug == slug).first()
    if not ach:
        return
    db.query(models.PlayerExclusiveAchievement).filter(
        models.PlayerExclusiveAchievement.user_id == user_id,
        models.PlayerExclusiveAchievement.exclusive_achievement_id == ach.id,
    ).delete(synchronize_session=False)
    deleted_count = db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == user_id,
        models.PlayerHistory.event_key.like(f"user:{user_id}:%:exclusive:{slug}")
    ).delete(synchronize_session=False)
    print(f"[revoke_exclusive_achievement] Deleted {deleted_count} history entries for exclusive achievement '{slug}'")


def reconcile_standard_achievements(
    user: models.User,
    db: Session,
    task: Optional[models.Task] = None,
) -> dict:
    stats = gc.gather_user_stats(user, db, models)
    unlocked_slugs = get_unlocked_slugs(user.id, db)
    newly_unlocked = []
    revoked = []
    for ach_def in gc.ACHIEVEMENT_DEFS:
        slug = ach_def["slug"]
        met = gc.achievement_met(stats, ach_def)
        if met and slug not in unlocked_slugs:
            unlocked = unlock_achievement(user.id, ach_def, db, task=task)
            if unlocked:
                newly_unlocked.append(unlocked)
                unlocked_slugs.add(slug)
        elif not met and slug in unlocked_slugs:
            revoke_standard_achievement(user.id, slug, db)
            revoked.append({"slug": slug, "title": ach_def["title"], "icon": ach_def["icon"]})
            unlocked_slugs.discard(slug)
    return {"newly_unlocked": newly_unlocked, "revoked": revoked}


def remove_rewards_for_task(user: models.User, task: models.Task, db: Session) -> None:
    stats = gc.gather_user_stats(user, db, models)
    prefix = f"user:{user.id}:task:{task.id}:"
    entries = db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == user.id,
        models.PlayerHistory.event_key.like(f"{prefix}%"),
    ).all()

    for entry in entries:
        parts = entry.event_key.split(":")
        if len(parts) < 5:
            continue
        kind = parts[3]
        slug = parts[4]
        if kind == "achievement":
            ach_def = gc.ACHIEVEMENT_BY_SLUG.get(slug)
            if ach_def and not gc.achievement_met(stats, ach_def):
                revoke_standard_achievement(user.id, slug, db)
        elif kind == "exclusive":
            revoke_exclusive_achievement(user.id, slug, db)

    db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == user.id,
        models.PlayerHistory.event_key.like(f"{prefix}%"),
    ).delete(synchronize_session=False)

    db.query(models.PlayerRareDrop).filter(
        models.PlayerRareDrop.user_id == user.id,
        models.PlayerRareDrop.source_task_id == task.id,
    ).delete(synchronize_session=False)

    reconcile_standard_achievements(user, db)


def grant_delayed_completion_rewards(user: models.User, task: models.Task, db: Session) -> dict:
    if task.delayed_rewards_forfeited or task.delayed_rewards_claimed:
        return {"exclusive_achievements": [], "earned_drop": None}

    newly_exclusive = gc.check_exclusive_achievements(user, db, models)
    if newly_exclusive:
        exclusive_payload = unlock_exclusive_with_history(user, newly_exclusive[0], task, db)
        task.delayed_rewards_claimed = True
        return {"exclusive_achievements": [exclusive_payload], "earned_drop": None}

    earned_drop = award_rare_drop_on_completion(user, task, db)
    task.delayed_rewards_claimed = True
    return {"exclusive_achievements": [], "earned_drop": earned_drop}


def process_delayed_task_rewards(user: models.User, db: Session) -> dict:
    now = datetime.utcnow()
    cutoff = timedelta(hours=DELAYED_REWARD_HOURS)
    result = {"exclusive_achievements": [], "earned_drop": None, "new_achievements": []}

    eligible = db.query(models.Task).filter(
        models.Task.owner_id == user.id,
        models.Task.completed == True,
        models.Task.delayed_rewards_claimed == False,
        models.Task.delayed_rewards_forfeited == False,
        models.Task.completed_at != None,
    ).all()

    for task in eligible:
        if now - task.completed_at < cutoff:
            continue
        batch = grant_delayed_completion_rewards(user, task, db)
        if batch.get("exclusive_achievements"):
            result["exclusive_achievements"].extend(batch["exclusive_achievements"])
        if batch.get("earned_drop") and not result["earned_drop"]:
            result["earned_drop"] = batch["earned_drop"]

    if result["exclusive_achievements"] or result["earned_drop"]:
        db.commit()
    return result


def record_level_ups(user: models.User, old_exp: int, db: Session) -> list[dict]:
    old_level = gc.get_level(old_exp)[0]
    new_level = gc.get_level(user.exp)[0]
    if new_level <= old_level:
        return []

    unlocked = []
    for _, level, title in gc.LEVELS:
        if old_level < level <= new_level:
            message = f"Awansowano na poziom {level} - {title}"
            if add_history_event(user.id, "level", f"user:{user.id}:level:{level}", message, db):
                unlocked.append({"level": level, "title": title, "message": message})
    return unlocked


def remove_level_up_history(user: models.User, old_exp: int, db: Session) -> list[int]:
    old_level = gc.get_level(old_exp)[0]
    new_level = gc.get_level(user.exp)[0]
    if new_level >= old_level:
        return []

    removed_levels = []
    for _, level, _ in gc.LEVELS:
        if new_level < level <= old_level:
            deleted_count = db.query(models.PlayerHistory).filter(
                models.PlayerHistory.user_id == user.id,
                models.PlayerHistory.event_key == f"user:{user.id}:level:{level}"
            ).delete(synchronize_session=False)
            if deleted_count > 0:
                removed_levels.append(level)
                print(f"[remove_level_up_history] Removed level {level} history entry for user {user.id}")
    return removed_levels

class UserCreate(BaseModel):
    username: str
    password: str

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    difficulty: Optional[str] = "easy"
    category: Optional[str] = "Inne"
    due_date: str
    important: Optional[bool] = False
    reminder_offset_days: Optional[int] = None
    task_type: Optional[str] = "quest"
    event_category: Optional[str] = None
    recurring_pattern: Optional[str] = None
    recurring_end_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[str] = None
    important: Optional[bool] = None
    reminder_offset_days: Optional[int] = None
    task_type: Optional[str] = None
    event_category: Optional[str] = None
    recurring_pattern: Optional[str] = None
    recurring_end_date: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class AccountDelete(BaseModel):
    password: str


class PushKeysIn(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushKeysIn
    expirationTime: Optional[int] = None


class ScheduleCreate(BaseModel):
    title: str
    location: Optional[str] = ""
    lecturer: Optional[str] = ""
    day_of_week: Optional[int] = None
    entry_date: Optional[str] = None
    is_recurring: bool = True
    start_time: str
    end_time: str


class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    lecturer: Optional[str] = None
    day_of_week: Optional[int] = None
    entry_date: Optional[str] = None
    is_recurring: Optional[bool] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class ShoppingCreate(BaseModel):
    name: str
    quantity: Optional[str] = ""
    category: Optional[str] = "other"
    family_id: Optional[int] = None
    price: Optional[float] = 0.0


class ShoppingUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[str] = None
    category: Optional[str] = None
    bought: Optional[bool] = None
    price: Optional[float] = None


class WorkCreate(BaseModel):
    work_date: str
    start_time: str
    end_time: str
    hourly_rate: float
    notes: Optional[str] = ""
    tax_enabled: Optional[bool] = False
    tax_percent: Optional[float] = 0.0
    is_recurring: Optional[bool] = False
    day_of_week: Optional[int] = None
    end_date: Optional[str] = None


class WorkUpdate(BaseModel):
    work_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    hourly_rate: Optional[float] = None
    notes: Optional[str] = None
    tax_enabled: Optional[bool] = None
    tax_percent: Optional[float] = None
    completed: Optional[bool] = None
    is_recurring: Optional[bool] = None
    day_of_week: Optional[int] = None
    end_date: Optional[str] = None


class FamilyCreate(BaseModel):
    name: str


class FamilyInvite(BaseModel):
    username: str


class FamilyUpdate(BaseModel):
    name: Optional[str] = None


class EmptyBody(BaseModel):
    pass


class RecurringEventCreate(BaseModel):
    title: str
    category: str = "birthday"
    # Legacy fields for backward compatibility
    month: Optional[int] = None
    day: Optional[int] = None
    # New fields for arbitrary intervals
    interval_type: Optional[str] = None  # daily, weekly, monthly, yearly
    interval_value: Optional[int] = None  # e.g., 2 for "every 2 weeks"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class RecurringEventUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    # Legacy fields for backward compatibility
    month: Optional[int] = None
    day: Optional[int] = None
    # New fields for arbitrary intervals
    interval_type: Optional[str] = None  # daily, weekly, monthly, yearly
    interval_value: Optional[int] = None  # e.g., 2 for "every 2 weeks"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class FreeDayCreate(BaseModel):
    date: str
    day_type: str = "holiday"  # holiday, deans_day, rector_day
    hours: Optional[str] = None
    notes: Optional[str] = ""


class FreeDayUpdate(BaseModel):
    date: Optional[str] = None
    day_type: Optional[str] = None
    hours: Optional[str] = None
    notes: Optional[str] = None


def validate_schedule_payload(data: ScheduleCreate | ScheduleUpdate, is_create: bool = False) -> None:
    fields = data.model_dump(exclude_unset=not is_create)
    if is_create:
        if not (data.title or "").strip():
            raise HTTPException(status_code=400, detail="Nazwa zajęć jest wymagana")
        recurring = data.is_recurring
        if recurring and data.day_of_week is None:
            raise HTTPException(status_code=400, detail="Wybierz dzień tygodnia")
        if not recurring and not data.entry_date:
            raise HTTPException(status_code=400, detail="Podaj datę zajęć")
    try:
        start = fields.get("start_time", getattr(data, "start_time", None))
        end = fields.get("end_time", getattr(data, "end_time", None))
        if start and end:
            lm.hours_between(start, end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format godziny (HH:MM)")


def validate_shopping_category(category: str) -> str:
    cat = (category or "other").strip().lower()
    if cat not in lm.VALID_SHOPPING_CATEGORIES:
        raise HTTPException(status_code=400, detail="Nieprawidłowa kategoria")
    return cat


def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    if current_user.username != "Igor":
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user

def has_achievement(user_id, achievement_name, db):
    achievement = db.query(models.Achievement).filter(models.Achievement.name == achievement_name).first()
    if not achievement:
        return False
    return db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == user_id,
        models.UserAchievement.achievement_id == achievement.id
    ).first() is not None

def _legacy_slug_map() -> dict:
    return {
        "first_task": ("first_step", "Pierwszy krok"),
        "ten_tasks": ("scout_badge", "Dziesiątka zadań"),
        "fifty_tasks": ("hundred_club", "Pięćdziesiątka"),
        "weekly_streak": ("streak_week", "Tydzień serii"),
        "monthly_streak": ("streak_month", "Miesiąc serii"),
        "exp_500": ("exp_scout", "250 EXP"),
        "exp_2000": ("exp_commander", "1000 EXP"),
    }


def get_unlocked_slugs(user_id: int, db: Session) -> set:
    user_achs = db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == user_id
    ).all()
    slugs = {ua.achievement.name for ua in user_achs}
    for old_slug, (new_slug, _) in _legacy_slug_map().items():
        if old_slug in slugs:
            slugs.add(new_slug)
    return slugs


def unlock_achievement(
    user_id: int,
    ach_def: dict,
    db: Session,
    task: Optional[models.Task] = None,
) -> Union[dict, None]:
    slug = ach_def["slug"]
    if slug in get_unlocked_slugs(user_id, db):
        return None

    achievement = db.query(models.Achievement).filter(models.Achievement.name == slug).first()
    if not achievement:
        achievement = models.Achievement(
            name=slug,
            title=ach_def["title"],
            description=ach_def["description"],
            icon=ach_def["icon"],
            requirement_type=ach_def["kind"],
            requirement_value=ach_def["value"],
        )
        db.add(achievement)
        db.flush()
    else:
        achievement.title = ach_def["title"]
        achievement.description = ach_def["description"]
        achievement.icon = ach_def["icon"]

    if db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == user_id,
        models.UserAchievement.achievement_id == achievement.id,
    ).first():
        return None

    user_achievement = models.UserAchievement(user_id=user_id, achievement_id=achievement.id)
    db.add(user_achievement)
    db.flush()
    title = achievement_display(achievement)
    if task:
        body = f"Zdobyto osiągnięcie '{title}' za ukończenie zadania '{task_display_title(task)}'"
        event_key = history_key_task(user_id, task.id, "achievement", slug)
    else:
        body = f"Zdobyto osiągnięcie '{title}'"
        event_key = f"user:{user_id}:achievement:{slug}"
    print(f"[unlock_achievement] Creating history entry with event_key: {event_key}")
    add_history_event(
        user_id,
        "achievement",
        event_key,
        body,
        db,
        user_achievement.unlocked_at,
    )
    return {
        "slug": slug,
        "title": title,
        "description": achievement.description,
        "icon": achievement.icon,
        "unlocked_at": str(user_achievement.unlocked_at),
    }


def check_achievements(user, db, task: Optional[models.Task] = None, stop_at_first: bool = False) -> list[dict]:
    stats = gc.gather_user_stats(user, db, models)
    newly_unlocked = []
    for ach_def in gc.ACHIEVEMENT_DEFS:
        if gc.achievement_met(stats, ach_def):
            unlocked = unlock_achievement(user.id, ach_def, db, task=task)
            if unlocked:
                newly_unlocked.append(unlocked)
                if stop_at_first:
                    return newly_unlocked
    return newly_unlocked


def unlock_exclusive_with_history(user: models.User, ea_def: dict, task: models.Task, db: Session) -> dict:
    title = ea_def["title"]
    body = f"Zdobyto osiągnięcie '{title}' za ukończenie zadania '{task_display_title(task)}'"
    event_key = history_key_task(user.id, task.id, "exclusive", ea_def["slug"])
    print(f"[unlock_exclusive_with_history] Creating history entry with event_key: {event_key}")
    add_history_event(
        user.id,
        "achievement",
        event_key,
        body,
        db,
    )
    return {
        "slug": ea_def["slug"],
        "title": title,
        "description": ea_def["description"],
        "icon": ea_def["icon"],
    }


def grant_completion_rewards(user: models.User, task: models.Task, db: Session) -> dict:
    result = reconcile_standard_achievements(user, db, task=task)
    return {"achievements": result["newly_unlocked"], "revoked_achievements": result["revoked"], "exclusive_achievements": [], "earned_drop": None}


def refresh_player_rewards(user: models.User, db: Session, task: Optional[models.Task] = None) -> dict:
    result = reconcile_standard_achievements(user, db, task=task)
    if result["newly_unlocked"] or result["revoked"]:
        db.commit()
    return {"achievements": result["newly_unlocked"], "revoked_achievements": result["revoked"], "exclusive_achievements": []}


def refresh_all_player_rewards(db: Session) -> None:
    for user in db.query(models.User).all():
        refresh_player_rewards(user, db)


def achievement_display(ach: models.Achievement) -> str:
    if ach.title:
        return ach.title
    legacy = _legacy_slug_map()
    if ach.name in legacy:
        return legacy[ach.name][1]
    if ach.name in gc.ACHIEVEMENT_BY_SLUG:
        return gc.ACHIEVEMENT_BY_SLUG[ach.name]["title"]
    return ach.name.replace("_", " ").title()

def award_rare_drop_on_completion(user: models.User, task: models.Task, db: Session) -> Optional[dict]:
    today = date.today()
    rng = random.Random(f"{user.id}-{today.isoformat()}-{task.id}")

    for drop_def in gc.RARE_DROPS:
        if user_owns_rare_drop_slug(user.id, drop_def["slug"], db):
            continue
        if rng.random() * 100 > drop_def["drop_chance"]:
            continue

        rare_drop = db.query(models.RareDrop).filter(
            models.RareDrop.slug == drop_def["slug"]
        ).first()
        if not rare_drop:
            rare_drop = models.RareDrop(
                slug=drop_def["slug"],
                name=drop_def["name"],
                description=drop_def["description"],
                icon=drop_def["icon"],
                rarity=drop_def["rarity"],
                drop_chance_percent=drop_def["drop_chance"],
            )
            db.add(rare_drop)
            db.flush()

        player_drop = models.PlayerRareDrop(
            user_id=user.id,
            rare_drop_id=rare_drop.id,
            source_task_id=task.id,
            obtained_date=today,
        )
        db.add(player_drop)
        db.flush()

        body = f"Znaleziono przedmiot '{drop_def['name']}' za ukończenie zadania '{task_display_title(task)}'"
        add_history_event(
            user.id,
            "rare_drop",
            history_key_task(user.id, task.id, "rare_drop", drop_def["slug"]),
            body,
            db,
            player_drop.obtained_at,
        )

        return {
            "slug": drop_def["slug"],
            "name": drop_def["name"],
            "description": drop_def["description"],
            "icon": drop_def["icon"],
            "rarity": drop_def["rarity"],
        }

    return None

@app.post("/register")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):

    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host

    username, password = validate_account_credentials(user.username, user.password)

    # Sprawdzenie czy nazwa zawiera zakazane słowa
    username_lower = username.lower()
    for bad in FORBIDDEN_USERNAMES:
        if bad in username_lower:
            logger.warning(f"BLOCKED registration attempt: '{username}' contains '{bad}' from IP {client_ip}")
            raise HTTPException(
                status_code=400,
                detail=f"Nazwa użytkownika zawiera niedozwolone słowo: {bad}"
            )

    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = models.User(
        username=username,
        hashed_password=get_password_hash(password)
    )
    db.add(new_user)
    db.commit()
    logger.info(f"New user registered: {username} from IP {client_ip}")
    return {"message": "User created"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if normalize_streak(current_user):
        db.commit()
    process_delayed_task_rewards(current_user, db)
    
    process_work_auto_completion()
    today = date.today()
    for days_ahead in range(31):
        target_date = today + timedelta(days=days_ahead)
        generate_recurring_event_instances(current_user, db, target_date)
        generate_recurring_panel_instances(current_user, db, target_date)
    
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "username": current_user.username,
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
        "streak": current_user.streak,
        "exp_tip": gc.EXP_RULES["hint"],
    }


@app.delete("/me")
def delete_account(
    body: AccountDelete,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Nieprawidłowe hasło")

    db.query(models.Task).filter(models.Task.owner_id == current_user.id).delete()
    db.query(models.ScheduleEntry).filter(models.ScheduleEntry.owner_id == current_user.id).delete()
    db.query(models.ShoppingItem).filter(models.ShoppingItem.owner_id == current_user.id).delete()
    db.query(models.WorkEntry).filter(models.WorkEntry.owner_id == current_user.id).delete()
    db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == current_user.id
    ).delete()
    db.query(models.DailyQuestAssignment).filter(
        models.DailyQuestAssignment.user_id == current_user.id
    ).delete()
    db.query(models.PlayerRareDrop).filter(
        models.PlayerRareDrop.user_id == current_user.id
    ).delete()
    db.query(models.PlayerExclusiveAchievement).filter(
        models.PlayerExclusiveAchievement.user_id == current_user.id
    ).delete()
    db.query(models.PlayerBadge).filter(
        models.PlayerBadge.user_id == current_user.id
    ).delete()
    db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == current_user.id
    ).delete()
    db.delete(current_user)
    db.commit()
    return {"message": "Konto zostało usunięte"}

@app.get("/tasks")
def get_tasks(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    process_delayed_task_rewards(current_user, db)
    
    process_work_auto_completion()
    today = date.today()
    for days_ahead in range(31):
        target_date = today + timedelta(days=days_ahead)
        generate_recurring_event_instances(current_user, db, target_date)
        generate_recurring_panel_instances(current_user, db, target_date)
    
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
    return [task_to_dict(t) for t in tasks]

@app.get("/tasks/by-date/{date_str}")
def get_tasks_by_date(date_str: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    target_date = date.fromisoformat(date_str)
    tasks = db.query(models.Task).filter(
        models.Task.owner_id == current_user.id,
        models.Task.due_date == target_date
    ).all()
    return [task_to_dict(t) for t in tasks]

@app.get("/calendar-stats/{year_month}")
def get_calendar_stats(year_month: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    year, month_num = map(int, year_month.split('-'))
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()

    stats = {}
    for task in tasks:
        day_str = task.due_date.strftime("%Y-%m-%d")
        if day_str.startswith(year_month):
            if day_str not in stats:
                stats[day_str] = {"total": 0, "completed": 0}
            stats[day_str]["total"] += 1
            if task.completed:
                stats[day_str]["completed"] += 1
    return stats

@app.post("/tasks")
def create_task(task: TaskCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    due = parse_due_date(task.due_date) if task.due_date else date.today()
    task_type = task.task_type if task.task_type in ["quest", "event"] else "quest"
    
    # Validate recurring pattern
    recurring_pattern = None
    if task.recurring_pattern:
        if task.recurring_pattern not in ["yearly", "monthly", "weekly"]:
            raise HTTPException(status_code=400, detail="Nieprawidłowy wzorzec cykliczności")
        recurring_pattern = task.recurring_pattern
    
    # Validate recurring end date
    recurring_end_date = None
    if task.recurring_end_date:
        try:
            recurring_end_date = parse_due_date(task.recurring_end_date)
        except:
            raise HTTPException(status_code=400, detail="Nieprawidłowa data końcowa cyklu")
    
    # Validate event category
    event_category = None
    if task.event_category:
        valid_event_categories = ["birthday", "anniversary", "holiday", "reminder"]
        if task.event_category not in valid_event_categories:
            raise HTTPException(status_code=400, detail="Nieprawidłowa kategoria wydarzenia")
        event_category = task.event_category
    
    new_task = models.Task(
        title=encrypt_field(validate_title(task.title)),
        description=encrypt_field((task.description or "").strip()[:1000]),
        difficulty=validate_difficulty(task.difficulty or "easy") if task_type == "quest" else "easy",
        category=validate_category(task.category or "Inne"),
        due_date=due,
        important=bool(task.important),
        reminder_offset_days=validate_reminder_offset(task.reminder_offset_days),
        owner_id=current_user.id,
        task_type=task_type,
        event_category=event_category,
        recurring_pattern=recurring_pattern,
        recurring_end_date=recurring_end_date
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return {"id": new_task.id, "message": "Task created", "due_date": str(new_task.due_date), "task_type": new_task.task_type}

@app.patch("/tasks/{task_id}")
def update_task(task_id: int, task_update: TaskUpdate,
                current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.owner_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    was_completed = task.completed
    exp_gained = 0
    exp_timing = None
    daily_bonus_reverted = 0
    new_rewards = {"achievements": [], "exclusive_achievements": []}
    level_ups = []
    earned_drop = None
    fields_set = getattr(task_update, "model_fields_set", getattr(task_update, "__fields_set__", set()))

    if task_update.completed is not None and task_update.completed == was_completed:
        print(f"[update_task] Task {task_id} already in target completed state: {was_completed}")
        process_delayed_task_rewards(current_user, db)
        level, title, next_exp, next_title = gc.get_level(current_user.exp)
        return {
            "message": "No change needed",
            "exp": current_user.exp,
            "level": level,
            "title": title,
            "next_level_exp": next_exp,
            "next_level_title": next_title,
            "streak": current_user.streak,
            "exp_gained": 0,
            "exp_timing": None,
            "daily_bonus": 0,
            "exp_awarded": task.exp_awarded,
            "task": task_to_dict(task),
            "challenges": build_challenges_payload(current_user, db),
            "new_achievements": [],
            "new_exclusive_achievements": [],
            "level_ups": [],
            "earned_drop": None,
            "rare_drops": build_rare_drops_inventory(current_user.id, db),
            "history": build_history_list(current_user.id, db),
            "achievements": build_achievements_payload(current_user, db),
        }

    if task_update.due_date is not None:
        if not task_can_reschedule(task):
            raise HTTPException(
                status_code=400,
                detail="Nie można przenieść zadania ukończonego lub takiego, które już dało EXP",
            )
        task.due_date = parse_due_date(task_update.due_date)

    if task_update.title is not None:
        task.title = encrypt_field(validate_title(task_update.title))
    if task_update.description is not None:
        task.description = encrypt_field(task_update.description.strip()[:1000])
    if task_update.important is not None:
        task.important = bool(task_update.important)
    if "reminder_offset_days" in fields_set:
        task.reminder_offset_days = validate_reminder_offset(task_update.reminder_offset_days)
    if task_update.task_type is not None and task_update.task_type in ["quest", "event"]:
        task.task_type = task_update.task_type
    
    # Handle event category
    if "event_category" in fields_set:
        if task_update.event_category:
            valid_event_categories = ["birthday", "anniversary", "holiday", "reminder"]
            if task_update.event_category not in valid_event_categories:
                raise HTTPException(status_code=400, detail="Nieprawidłowa kategoria wydarzenia")
            task.event_category = task_update.event_category
        else:
            task.event_category = None
    
    # Handle recurring pattern
    if "recurring_pattern" in fields_set:
        if task_update.recurring_pattern:
            if task_update.recurring_pattern not in ["yearly", "monthly", "weekly"]:
                raise HTTPException(status_code=400, detail="Nieprawidłowy wzorzec cykliczności")
            task.recurring_pattern = task_update.recurring_pattern
        else:
            task.recurring_pattern = None
    
    # Handle recurring end date
    if "recurring_end_date" in fields_set:
        if task_update.recurring_end_date:
            try:
                task.recurring_end_date = parse_due_date(task_update.recurring_end_date)
            except:
                raise HTTPException(status_code=400, detail="Nieprawidłowa data końcowa cyklu")
        else:
            task.recurring_end_date = None

    if task.exp_awarded:
        if task_update.difficulty is not None or task_update.category is not None:
            raise HTTPException(
                status_code=400,
                detail="Nie można zmienić kategorii/trudności po otrzymaniu EXP",
            )
    else:
        if task_update.difficulty is not None:
            task.difficulty = validate_difficulty(task_update.difficulty)
        if task_update.category is not None:
            task.category = validate_category(task_update.category)

    if task_update.completed is not None:
        if not task_update.completed and was_completed:
            if not task.completed_at:
                raise HTTPException(status_code=400, detail="Task has no completion timestamp")

            time_since_completion = datetime.utcnow() - task.completed_at
            if time_since_completion > timedelta(hours=24):
                raise HTTPException(
                    status_code=400,
                    detail="Nie można odznaczyć zadania po upływie 24 godzin od ukończenia"
                )

            exp_to_revert = task.exp_awarded_amount or EXP_REWARDS.get(task.difficulty, 10)
            exp_before_changes = current_user.exp
            current_user.exp = max(0, current_user.exp - exp_to_revert)
            task.exp_awarded = False
            task.exp_awarded_amount = 0
            task.completed = False
            task.completed_at = None
            task.delayed_rewards_forfeited = True
            task.delayed_rewards_claimed = False

            exp_gained = -exp_to_revert

            print(f"[uncheck] Reverting {exp_to_revert} EXP for task {task.id}")

            all_tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
            completed_tasks = [t for t in all_tasks if t.completed and t.completed_at]
            completed_tasks.sort(key=lambda t: t.completed_at, reverse=True)

            today = date.today()
            streak = 0
            last_date = None

            for t in completed_tasks:
                task_date = t.completed_at.date()
                if last_date is None:
                    if task_date == today or task_date == today - timedelta(days=1):
                        streak = 1
                        last_date = task_date
                    else:
                        break
                else:
                    if task_date == last_date - timedelta(days=1):
                        streak += 1
                        last_date = task_date
                    else:
                        break

            current_user.streak = streak
            current_user.last_streak_date = last_date if streak > 0 else None

            print(f"[uncheck] Recalculated streak: {streak}, last_date: {last_date}")

            remove_rewards_for_task(current_user, task, db)
            stats = gc.gather_user_stats(current_user, db, models)
            unlocked_slugs_before = get_unlocked_slugs(current_user.id, db)
            reconcile_standard_achievements(current_user, db)
            unlocked_slugs_after = get_unlocked_slugs(current_user.id, db)
            revoked_achievements = []
            for slug in unlocked_slugs_before - unlocked_slugs_after:
                ach_def = gc.ACHIEVEMENT_BY_SLUG.get(slug)
                if ach_def:
                    revoked_achievements.append({"slug": slug, "title": ach_def["title"], "icon": ach_def["icon"]})

            assignment = get_or_create_daily_assignment(current_user, db, date.today())
            if assignment.bonus_claimed:
                stats = dq.build_day_stats(current_user, all_tasks, date.today())
                quest_ids = [x.strip() for x in assignment.quest_ids.split(",") if x.strip()]
                goals = dq.evaluate_assigned_quests(quest_ids, stats)
                if not dq.all_goals_complete(goals):
                    assignment.bonus_claimed = False
                    current_user.exp = max(0, current_user.exp - dq.TRIPLE_BONUS_EXP)
                    daily_bonus_reverted = dq.TRIPLE_BONUS_EXP
                    print(f"[uncheck] Reverted daily bonus {dq.TRIPLE_BONUS_EXP} EXP")

            remove_level_up_history(current_user, exp_before_changes, db)

            new_rewards = {"achievements": [], "exclusive_achievements": []}
            earned_drop = None

        if task_update.completed and not was_completed:
            task.completed = True
            task.completed_at = datetime.utcnow()
            if not task.delayed_rewards_forfeited:
                task.delayed_rewards_claimed = False
            # Only award XP for quests, not events
            if not task.exp_awarded and task.task_type == "quest":
                old_exp = current_user.exp
                exp_gained, exp_timing = calculate_exp_reward(
                    task.difficulty, task.due_date, task.completed_at
                )
                current_user.exp += exp_gained
                task.exp_awarded = True
                task.exp_awarded_amount = exp_gained
                task.exp_timing = exp_timing
                level_ups.extend(record_level_ups(current_user, old_exp, db))

                today = date.today()
                if current_user.last_streak_date != today:
                    if current_user.last_streak_date == today - timedelta(days=1):
                        current_user.streak += 1
                    else:
                        # Przerwa więcej niż jednego dnia - zaczynamy od nowa
                        current_user.streak = 1
                    current_user.last_streak_date = today

                db.flush()

                new_rewards = grant_completion_rewards(current_user, task, db)
                earned_drop = new_rewards.get("earned_drop")
                revoked_achievements = new_rewards.get("revoked_achievements", [])

    db.commit()
    db.refresh(task)
    daily_bonus, daily_bonus_level_ups = try_award_daily_triple_bonus(current_user, db)
    level_ups.extend(daily_bonus_level_ups)
    if daily_bonus:
        db.refresh(current_user)
        bonus_rewards = refresh_player_rewards(current_user, db)
        new_rewards["achievements"].extend(bonus_rewards["achievements"])
        if bonus_rewards.get("revoked_achievements"):
            revoked_achievements.extend(bonus_rewards["revoked_achievements"])
    delayed_rewards = process_delayed_task_rewards(current_user, db)
    if delayed_rewards.get("exclusive_achievements"):
        new_rewards["exclusive_achievements"].extend(delayed_rewards["exclusive_achievements"])
    if delayed_rewards.get("earned_drop") and not earned_drop:
        earned_drop = delayed_rewards["earned_drop"]
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "message": "Updated",
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
        "streak": current_user.streak,
        "exp_gained": exp_gained,
        "exp_timing": exp_timing,
        "daily_bonus": (daily_bonus or 0) - daily_bonus_reverted,
        "exp_awarded": task.exp_awarded,
        "task": task_to_dict(task),
        "challenges": build_challenges_payload(current_user, db),
        "new_achievements": new_rewards.get("achievements", []),
        "revoked_achievements": revoked_achievements if 'revoked_achievements' in locals() else [],
        "new_exclusive_achievements": new_rewards.get("exclusive_achievements", []),
        "level_ups": level_ups,
        "earned_drop": earned_drop,
        "rare_drops": build_rare_drops_inventory(current_user.id, db),
        "history": build_history_list(current_user.id, db),
        "achievements": build_achievements_payload(current_user, db),
    }


@app.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db), limit: int = 10):
    users = db.query(models.User).order_by(models.User.exp.desc()).limit(min(limit, 50)).all()
    result = []
    for rank, u in enumerate(users, start=1):
        level, title, _, _ = gc.get_level(u.exp)
        result.append({
            "rank": rank,
            "username": u.username,
            "exp": u.exp,
            "level": level,
            "title": title,
        })
    return result


def get_or_create_daily_assignment(user: models.User, db: Session, day: date) -> models.DailyQuestAssignment:
    row = db.query(models.DailyQuestAssignment).filter(
        models.DailyQuestAssignment.user_id == user.id,
        models.DailyQuestAssignment.quest_date == day,
    ).first()
    if row:
        return row
    picked = dq.pick_three_quests(user.id, day)
    row = models.DailyQuestAssignment(
        user_id=user.id,
        quest_date=day,
        quest_ids=",".join(q["id"] for q in picked),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def generate_recurring_event_instances(user: models.User, db: Session, target_date: date) -> int:
    """Generate new instances of recurring events for a given date."""
    created_count = 0
    
    # Get all recurring events for this user
    recurring_events = db.query(models.Task).filter(
        models.Task.owner_id == user.id,
        models.Task.task_type == "event",
        models.Task.recurring_pattern.isnot(None)
    ).all()
    
    for event in recurring_events:
        # Check if this event should recur on target_date
        should_create = False
        event_date = event.due_date
        
        if event.recurring_pattern == "yearly":
            # Check if target_date is the same month/day as the event
            if (target_date.month == event_date.month and 
                target_date.day == event_date.day and
                target_date.year > event_date.year):
                should_create = True
        elif event.recurring_pattern == "monthly":
            # Check if target_date is the same day of month as the event
            if (target_date.day == event_date.day and
                target_date > event_date):
                should_create = True
        elif event.recurring_pattern == "weekly":
            # Check if target_date is the same weekday as the event
            if (target_date.weekday() == event_date.weekday() and
                target_date > event_date):
                should_create = True
        
        # Check if we've passed the recurring end date
        if event.recurring_end_date and target_date > event.recurring_end_date:
            should_create = False
        
        if should_create:
            # Check if an instance already exists for this date
            existing = db.query(models.Task).filter(
                models.Task.owner_id == user.id,
                models.Task.task_type == "event",
                models.Task.title == decrypt_field(event.title),
                models.Task.due_date == target_date
            ).first()
            
            if not existing:
                # Create new instance
                new_instance = models.Task(
                    title=event.title,
                    description=event.description,
                    difficulty="easy",
                    category=event.category,
                    due_date=target_date,
                    important=event.important,
                    reminder_offset_days=event.reminder_offset_days,
                    completed=False,
                    task_type="event",
                    event_category=event.event_category,
                    recurring_pattern=event.recurring_pattern,
                    recurring_end_date=event.recurring_end_date,
                    owner_id=user.id
                )
                db.add(new_instance)
                created_count += 1
                logger.info(f"Created recurring event instance: {decrypt_field(event.title)} on {target_date}")
    
    if created_count > 0:
        db.commit()
    
    return created_count


def generate_recurring_panel_instances(user: models.User, db: Session, target_date: date) -> int:
    """Create task instances from RecurringEvent definitions for a given date."""
    created_count = 0
    events = db.query(models.RecurringEvent).filter(
        models.RecurringEvent.owner_id == user.id
    ).all()

    for event in events:
        if not recurring_event_occurs_on(event, target_date):
            continue

        day_tasks = db.query(models.Task).filter(
            models.Task.owner_id == user.id,
            models.Task.task_type == "event",
            models.Task.due_date == target_date,
        ).all()
        existing = next(
            (t for t in day_tasks if decrypt_field(t.title) == event.title),
            None,
        )

        if existing:
            continue

        new_task = models.Task(
            title=encrypt_field(event.title),
            description=encrypt_field(""),
            difficulty="easy",
            category="Inne",
            due_date=target_date,
            important=False,
            reminder_offset_days=None,
            completed=False,
            task_type="event",
            event_category=event.category,
            owner_id=user.id,
        )
        db.add(new_task)
        created_count += 1

    if created_count > 0:
        db.commit()

    return created_count


def build_challenges_payload(user: models.User, db: Session, day: Union[date, None] = None) -> dict:
    day = day or date.today()
    assignment = get_or_create_daily_assignment(user, db, day)
    quest_ids = [x.strip() for x in assignment.quest_ids.split(",") if x.strip()]
    all_tasks = db.query(models.Task).filter(models.Task.owner_id == user.id).all()
    stats = dq.build_day_stats(user, all_tasks, day)
    goals = dq.evaluate_assigned_quests(quest_ids, stats)

    print(f"[build_challenges_payload] user={user.id}, day={day}, stats={stats}, goals_current={[g['current'] for g in goals]}")

    return {
        "today_total": stats["total_today"],
        "today_done": stats["done_today"],
        "goals": goals,
        "all_complete": dq.all_goals_complete(goals),
        "bonus_claimed": assignment.bonus_claimed,
        "triple_bonus_exp": dq.TRIPLE_BONUS_EXP,
        "date": str(day),
    }


def try_award_daily_triple_bonus(user: models.User, db: Session, day: Union[date, None] = None) -> tuple[int, list[dict]]:
    day = day or date.today()
    assignment = get_or_create_daily_assignment(user, db, day)
    if assignment.bonus_claimed:
        return 0, []
    all_tasks = db.query(models.Task).filter(models.Task.owner_id == user.id).all()
    stats = dq.build_day_stats(user, all_tasks, day)
    quest_ids = [x.strip() for x in assignment.quest_ids.split(",") if x.strip()]
    goals = dq.evaluate_assigned_quests(quest_ids, stats)
    if dq.all_goals_complete(goals):
        assignment.bonus_claimed = True
        old_exp = user.exp
        user.exp += dq.TRIPLE_BONUS_EXP
        level_ups = record_level_ups(user, old_exp, db)
        db.commit()
        return dq.TRIPLE_BONUS_EXP, level_ups
    return 0, []


@app.get("/challenges")
def get_challenges(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_challenges_payload(current_user, db)


@app.get("/push/vapid-public-key")
def get_vapid_public_key():
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Web Push nie jest skonfigurowany na serwerze")
    return {"publicKey": VAPID_PUBLIC_KEY}


@app.post("/push/subscribe")
def push_subscribe(
    payload: PushSubscriptionIn,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == payload.endpoint
    ).first()
    if row:
        row.user_id = current_user.id
        row.p256dh = payload.keys.p256dh
        row.auth = payload.keys.auth
    else:
        db.add(
            models.PushSubscription(
                user_id=current_user.id,
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
            )
        )
    db.commit()
    return {"message": "Subscribed", "push_enabled": _push_configured()}


@app.delete("/push/subscribe")
def push_unsubscribe(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == current_user.id
    ).delete()
    db.commit()
    return {"message": "Unsubscribed"}


@app.post("/push/test")
def push_test(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _push_configured():
        raise HTTPException(status_code=503, detail="Web Push nie jest skonfigurowany")
    sent = send_push_to_user(
        db,
        current_user.id,
        "Test powiadomienia QuestDo — wszystko działa!",
        "/",
    )
    db.commit()
    if sent == 0:
        raise HTTPException(status_code=400, detail="Brak aktywnej subskrypcji push")
    return {"message": "Test wysłany", "delivered": sent}


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.owner_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    exp_before_changes = current_user.exp
    exp_removed = 0
    if task.exp_awarded:
        exp_removed = task.exp_awarded_amount or EXP_REWARDS.get(task.difficulty, 10)

    assignment = get_or_create_daily_assignment(current_user, db, date.today())
    if assignment.bonus_claimed:
        all_tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
        if task.completed:
            stats_without_task = dq.build_day_stats(
                current_user, [t for t in all_tasks if t.id != task_id], date.today()
            )
            quest_ids = [x.strip() for x in assignment.quest_ids.split(",") if x.strip()]
            goals_without_task = dq.evaluate_assigned_quests(quest_ids, stats_without_task)
            if not dq.all_goals_complete(goals_without_task):
                assignment.bonus_claimed = False
                current_user.exp = max(0, current_user.exp - dq.TRIPLE_BONUS_EXP)
                print(f"[delete_task] Reverted daily bonus {dq.TRIPLE_BONUS_EXP} EXP before deleting task")

    if task.exp_awarded:
        current_user.exp = max(0, current_user.exp - exp_removed)

    remove_level_up_history(current_user, exp_before_changes, db)

    db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == current_user.id,
        models.PlayerHistory.event_key.like(f"user:{current_user.id}:task:{task_id}:%"),
    ).delete(synchronize_session=False)
    db.query(models.PlayerRareDrop).filter(
        models.PlayerRareDrop.user_id == current_user.id,
        models.PlayerRareDrop.source_task_id == task.id,
    ).delete(synchronize_session=False)

    db.delete(task)
    db.flush()

    reconcile_standard_achievements(current_user, db)
    db.commit()

    history_data = build_history_list(current_user.id, db)
    achievements_payload = build_achievements_payload(current_user, db)

    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "message": "Deleted",
        "exp_removed": exp_removed,
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
        "achievements": achievements_payload,
        "history": history_data,
    }

@app.get("/achievements")
def get_achievements(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    reconcile_standard_achievements(current_user, db)
    db.commit()
    user_achs = db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == current_user.id
    ).all()
    unlocked_slugs = get_unlocked_slugs(current_user.id, db)
    stats = gc.gather_user_stats(current_user, db, models)
    unlocked = [{
        "slug": ua.achievement.name,
        "title": achievement_display(ua.achievement),
        "description": ua.achievement.description,
        "icon": ua.achievement.icon,
        "unlocked_at": str(ua.unlocked_at),
    } for ua in user_achs]
    return {
        "unlocked": unlocked,
        "next": gc.get_next_achievement(stats, unlocked_slugs),
    }


@app.get("/game/levels")
def list_levels():
    return [
        {"threshold": t, "level": lv, "title": title}
        for t, lv, title in gc.LEVELS
    ]




@app.get("/rare-drops/inventory")
def get_rare_drops_inventory(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_rare_drops_inventory(current_user.id, db)


@app.get("/history")
def get_player_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_history_list(current_user.id, db)


@app.get("/exclusive-achievements")
def get_exclusive_achievements(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    refresh_player_rewards(current_user, db)

    player_achs = db.query(models.PlayerExclusiveAchievement).filter(
        models.PlayerExclusiveAchievement.user_id == current_user.id
    ).all()

    unlocked_slugs = {pa.exclusive_achievement.slug for pa in player_achs}

    unlocked = [{
        "slug": pa.exclusive_achievement.slug,
        "title": pa.exclusive_achievement.title,
        "description": pa.exclusive_achievement.description,
        "icon": pa.exclusive_achievement.icon,
        "unlocked_at": str(pa.unlocked_at)
    } for pa in player_achs]

    locked = [
        {
            "slug": ea["slug"],
            "title": ea["title"],
            "description": ea["description"],
            "icon": ea["icon"],
            "type": ea["type"],
            "value": ea["value"]
        }
        for ea in gc.EXCLUSIVE_ACHIEVEMENTS
        if ea["slug"] not in unlocked_slugs
    ]

    return {
        "unlocked_count": len(unlocked),
        "total_available": len(gc.EXCLUSIVE_ACHIEVEMENTS),
        "unlocked": unlocked,
        "locked": locked[:5]
    }


@app.get("/rankings/exp")
def ranking_exp(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.exp.desc()).limit(10).all()
    return [{
        "rank": i + 1,
        "username": u.username,
        "exp": u.exp,
        "level": gc.get_level(u.exp)[0],
        "level_title": gc.get_level(u.exp)[1]
    } for i, u in enumerate(users)]


@app.get("/rankings/streak")
def ranking_streak(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.streak.desc()).limit(10).all()
    changed = False
    for u in users:
        changed = normalize_streak(u) or changed
    if changed:
        db.commit()
        users = db.query(models.User).order_by(models.User.streak.desc()).limit(10).all()
    return [{
        "rank": i + 1,
        "username": u.username,
        "streak": u.streak or 0,
    } for i, u in enumerate(users)]


@app.get("/rankings/rare-drops")
def ranking_rare_drops(db: Session = Depends(get_db)):
    from sqlalchemy import func
    results = db.query(
        models.User.username,
        func.count(models.PlayerRareDrop.id).label("count"),
    ).outerjoin(
        models.PlayerRareDrop,
        models.PlayerRareDrop.user_id == models.User.id,
    ).group_by(
        models.User.id,
        models.User.username
    ).order_by(func.count(models.PlayerRareDrop.id).desc()).limit(10).all()

    return [{
        "rank": i + 1,
        "username": r.username,
        "rare_drops": r.count
    } for i, r in enumerate(results)]


@app.get("/rankings/completed-tasks")
def ranking_completed_tasks(db: Session = Depends(get_db)):
    from sqlalchemy import func
    results = db.query(
        models.User.username,
        func.count(models.Task.id).label("count")
    ).outerjoin(
        models.Task,
        (models.Task.owner_id == models.User.id) & (models.Task.completed == True)
    ).group_by(
        models.User.id,
        models.User.username
    ).order_by(func.count(models.Task.id).desc()).limit(10).all()

    return [{
        "rank": i + 1,
        "username": r.username,
        "completed_tasks": r.count
    } for i, r in enumerate(results)]


@app.get("/rankings/achievements")
def ranking_achievements(db: Session = Depends(get_db)):
    from sqlalchemy import func
    refresh_all_player_rewards(db)
    results = db.query(
        models.User.username,
        func.count(models.UserAchievement.id).label("count")
    ).outerjoin(
        models.UserAchievement,
        models.UserAchievement.user_id == models.User.id,
    ).group_by(
        models.User.id,
        models.User.username
    ).order_by(func.count(models.UserAchievement.id).desc()).limit(10).all()

    return [{
        "rank": i + 1,
        "username": r.username,
        "achievements": r.count
    } for i, r in enumerate(results)]


@app.get("/rankings/exclusive-achievements")
def ranking_exclusive_achievements(db: Session = Depends(get_db)):
    from sqlalchemy import func
    refresh_all_player_rewards(db)
    results = db.query(
        models.User.username,
        func.count(models.PlayerExclusiveAchievement.id).label("count")
    ).outerjoin(
        models.PlayerExclusiveAchievement,
        models.PlayerExclusiveAchievement.user_id == models.User.id,
    ).group_by(
        models.User.id,
        models.User.username
    ).order_by(func.count(models.PlayerExclusiveAchievement.id).desc()).limit(10).all()

    return [{
        "rank": i + 1,
        "username": r.username,
        "exclusive_achievements": r.count
    } for i, r in enumerate(results)]


@app.get("/rankings/all")
def ranking_all(db: Session = Depends(get_db)):
    exp = ranking_exp(db)
    streak = ranking_streak(db)
    achievements = ranking_achievements(db)
    rare_drops = ranking_rare_drops(db)
    completed = ranking_completed_tasks(db)
    exclusive = ranking_exclusive_achievements(db)
    return {
        "exp": exp,
        "streak": streak,
        "achievements": achievements,
        "rare_drops": rare_drops,
        "completed": completed,
        "completed_tasks": completed,
        "exclusive": exclusive,
        "exclusive_achievements": exclusive,
    }


# === SCHEDULE / SHOPPING / EARNINGS ===

@app.get("/schedule")
def list_schedule(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(models.ScheduleEntry).filter(
        models.ScheduleEntry.owner_id == current_user.id
    ).order_by(models.ScheduleEntry.day_of_week, models.ScheduleEntry.start_time).all()
    return [lm.schedule_to_dict(e) for e in entries]


@app.post("/schedule")
def create_schedule(entry: ScheduleCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_schedule_payload(entry, is_create=True)
    enc = lm.encrypt_schedule_fields(entry.title, entry.location, entry.lecturer)
    entry_date = parse_due_date(entry.entry_date) if entry.entry_date else None
    if entry.is_recurring and entry.day_of_week is not None and not 0 <= entry.day_of_week <= 6:
        raise HTTPException(status_code=400, detail="Dzień tygodnia musi być 0-6")
    row = models.ScheduleEntry(
        owner_id=current_user.id,
        title=enc["title"],
        location=enc["location"],
        lecturer=enc["lecturer"],
        day_of_week=entry.day_of_week if entry.is_recurring else None,
        entry_date=None if entry.is_recurring else entry_date,
        is_recurring=entry.is_recurring,
        start_time=entry.start_time,
        end_time=entry.end_time,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return lm.schedule_to_dict(row)


@app.patch("/schedule/{entry_id}")
def update_schedule(entry_id: int, body: ScheduleUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.ScheduleEntry).filter(
        models.ScheduleEntry.id == entry_id,
        models.ScheduleEntry.owner_id == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Nie znaleziono wpisu")
    validate_schedule_payload(body)
    if body.title is not None:
        row.title = encrypt_field(validate_title(body.title))
    if body.location is not None:
        row.location = encrypt_field(body.location.strip())
    if body.lecturer is not None:
        row.lecturer = encrypt_field(body.lecturer.strip())
    if body.day_of_week is not None:
        row.day_of_week = body.day_of_week
    if body.entry_date is not None:
        row.entry_date = parse_due_date(body.entry_date)
    if body.is_recurring is not None:
        row.is_recurring = body.is_recurring
    if body.start_time is not None:
        row.start_time = body.start_time
    if body.end_time is not None:
        row.end_time = body.end_time
    db.commit()
    db.refresh(row)
    return lm.schedule_to_dict(row)


@app.delete("/schedule/{entry_id}")
def delete_schedule(entry_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.ScheduleEntry).filter(
        models.ScheduleEntry.id == entry_id,
        models.ScheduleEntry.owner_id == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Nie znaleziono wpisu")
    db.delete(row)
    db.commit()
    return {"message": "Usunięto wpis planu"}


@app.delete("/schedule/all")
def delete_all_schedule(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    deleted = db.query(models.ScheduleEntry).filter(
        models.ScheduleEntry.owner_id == current_user.id
    ).delete()
    db.commit()
    return {"message": f"Usunięto cały plan zajęć ({deleted} wpisów)", "deleted": deleted}


@app.get("/shopping")
def list_shopping(family_id: Optional[int] = None, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if family_id is not None:
        # Check if user is member of the family
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej rodziny")
        
        items = db.query(models.ShoppingItem).filter(
            models.ShoppingItem.family_id == family_id
        ).order_by(models.ShoppingItem.bought, models.ShoppingItem.id.desc()).all()
    else:
        items = db.query(models.ShoppingItem).filter(
            models.ShoppingItem.owner_id == current_user.id,
            models.ShoppingItem.family_id.is_(None)
        ).order_by(models.ShoppingItem.bought, models.ShoppingItem.id.desc()).all()
    return [lm.shopping_to_dict(i) for i in items]


@app.post("/shopping")
def create_shopping(item: ShoppingCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = (item.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nazwa produktu jest wymagana")
    
    family_id = item.family_id
    if family_id is not None:
        # Check if user is member of the family
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej rodziny")
    
    enc = lm.encrypt_shopping_fields(name, item.quantity)
    row = models.ShoppingItem(
        owner_id=current_user.id,
        family_id=family_id,
        name=enc["name"],
        quantity=enc["quantity"],
        category=validate_shopping_category(item.category or "other"),
        price=max(0.0, float(item.price or 0.0))
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return lm.shopping_to_dict(row)


@app.patch("/shopping/{item_id}")
def update_shopping(item_id: int, body: ShoppingUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.ShoppingItem).filter(
        models.ShoppingItem.id == item_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Nie znaleziono produktu")
    
    # Check if user has access to this item (either owner or family member)
    if row.family_id is not None:
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == row.family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie masz dostępu do tego produktu")
    elif row.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego produktu")
    if body.name is not None:
        row.name = encrypt_field(body.name.strip())
    if body.quantity is not None:
        row.quantity = encrypt_field(body.quantity.strip())
    if body.category is not None:
        row.category = validate_shopping_category(body.category)
    if body.price is not None:
        row.price = max(0.0, float(body.price))
    if body.bought is not None:
        row.bought = bool(body.bought)
    db.commit()
    db.refresh(row)
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "item": lm.shopping_to_dict(row),
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
    }


@app.delete("/shopping/{item_id}")
def delete_shopping(item_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.ShoppingItem).filter(
        models.ShoppingItem.id == item_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Nie znaleziono produktu")
    
    # Check if user has access to this item (either owner or family member)
    if row.family_id is not None:
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == row.family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie masz dostępu do tego produktu")
    elif row.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego produktu")
    db.delete(row)
    db.commit()
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "message": "Usunięto produkt",
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
    }


@app.delete("/shopping/bought/clear")
def clear_bought_shopping(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bought = db.query(models.ShoppingItem).filter(
        models.ShoppingItem.owner_id == current_user.id,
        models.ShoppingItem.bought == True,
    ).all()
    for row in bought:
        db.delete(row)
    db.commit()
    return {"message": f"Usunięto {len(bought)} kupionych produktów"}


@app.get("/work")
def list_work(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    process_work_auto_completion()
    entries = db.query(models.WorkEntry).filter(
        models.WorkEntry.owner_id == current_user.id
    ).order_by(models.WorkEntry.work_date.desc(), models.WorkEntry.start_time).all()
    return [lm.work_to_dict(e) for e in entries]


@app.get("/work/summary")
def work_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.query(models.WorkEntry).filter(models.WorkEntry.owner_id == current_user.id).all()
    completed = [e for e in entries if e.completed]
    day_totals = {}
    month_totals = {}
    year_totals = {}
    for entry in completed:
        e = lm.work_earnings(entry)
        d = str(entry.work_date)
        ym = d[:7]
        y = d[:4]
        day_totals[d] = day_totals.get(d, 0.0) + e["net"]
        month_totals[ym] = month_totals.get(ym, 0.0) + e["net"]
        year_totals[y] = year_totals.get(y, 0.0) + e["net"]
    result = {
        "all_time": lm.sum_work_earnings(entries),
        "by_day": {k: round(v, 2) for k, v in sorted(day_totals.items())},
        "by_month": {k: round(v, 2) for k, v in sorted(month_totals.items())},
        "by_year": {k: round(v, 2) for k, v in sorted(year_totals.items())},
    }
    if year and month:
        key = f"{year:04d}-{month:02d}"
        month_entries = [e for e in entries if str(e.work_date).startswith(key)]
        result["selected_month"] = lm.sum_work_earnings(month_entries)
    if year:
        year_entries = [e for e in entries if str(e.work_date).startswith(f"{year:04d}")]
        result["selected_year"] = lm.sum_work_earnings(year_entries)
    return result


@app.post("/work")
def create_work(entry: WorkCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if entry.hourly_rate < 0:
        raise HTTPException(status_code=400, detail="Stawka nie może być ujemna")
    try:
        lm.hours_between(entry.start_time, entry.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format godziny (HH:MM)")
    
    # Validate cyclic fields
    if entry.is_recurring:
        if entry.day_of_week is None or entry.day_of_week < 0 or entry.day_of_week > 6:
            raise HTTPException(status_code=400, detail="Dzień tygodnia jest wymagany dla cyklicznych wpisów (0-6)")
        if entry.end_date:
            try:
                end_date = date.fromisoformat(entry.end_date)
                work_date = parse_due_date(entry.work_date)
                if end_date < work_date:
                    raise HTTPException(status_code=400, detail="Data zakończenia nie może być wcześniejsza niż data rozpoczęcia")
            except ValueError:
                raise HTTPException(status_code=400, detail="Nieprawidłowa data zakończenia (YYYY-MM-DD)")
    else:
        if entry.day_of_week is not None:
            raise HTTPException(status_code=400, detail="Dzień tygodnia tylko dla cyklicznych wpisów")
        if entry.end_date is not None:
            raise HTTPException(status_code=400, detail="Data zakończenia tylko dla cyklicznych wpisów")
    
    enc = lm.encrypt_work_fields(entry.hourly_rate, entry.notes)
    row = models.WorkEntry(
        owner_id=current_user.id,
        work_date=parse_due_date(entry.work_date),
        start_time=entry.start_time,
        end_time=entry.end_time,
        hourly_rate=enc["hourly_rate"],
        notes=enc["notes"],
        tax_enabled=bool(entry.tax_enabled),
        tax_percent=max(0.0, min(100.0, float(entry.tax_percent or 0))),
        is_recurring=bool(entry.is_recurring),
        day_of_week=entry.day_of_week if entry.is_recurring else None,
        end_date=date.fromisoformat(entry.end_date) if entry.end_date and entry.is_recurring else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return lm.work_to_dict(row)


@app.patch("/work/{entry_id}")
def update_work(entry_id: int, body: WorkUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.WorkEntry).filter(
        models.WorkEntry.id == entry_id,
        models.WorkEntry.owner_id == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Nie znaleziono wpisu pracy")
    if body.work_date is not None:
        row.work_date = parse_due_date(body.work_date)
    if body.start_time is not None:
        row.start_time = body.start_time
    if body.end_time is not None:
        row.end_time = body.end_time
    if body.hourly_rate is not None:
        if body.hourly_rate < 0:
            raise HTTPException(status_code=400, detail="Stawka nie może być ujemna")
        row.hourly_rate = encrypt_field(str(body.hourly_rate))
    if body.notes is not None:
        row.notes = encrypt_field(body.notes.strip())
    if body.tax_enabled is not None:
        row.tax_enabled = bool(body.tax_enabled)
    if body.tax_percent is not None:
        row.tax_percent = max(0.0, min(100.0, float(body.tax_percent)))
    if body.completed is not None:
        row.completed = bool(body.completed)
    
    # Handle cyclic fields
    if body.is_recurring is not None:
        row.is_recurring = bool(body.is_recurring)
    if body.day_of_week is not None:
        if body.day_of_week < 0 or body.day_of_week > 6:
            raise HTTPException(status_code=400, detail="Dzień tygodnia musi być w zakresie 0-6")
        row.day_of_week = body.day_of_week
    if body.end_date is not None:
        try:
            end_date = date.fromisoformat(body.end_date)
            if end_date < row.work_date:
                raise HTTPException(status_code=400, detail="Data zakończenia nie może być wcześniejsza niż data rozpoczęcia")
            row.end_date = end_date
        except ValueError:
            raise HTTPException(status_code=400, detail="Nieprawidłowa data zakończenia (YYYY-MM-DD)")
    
    try:
        lm.hours_between(row.start_time, row.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format godziny (HH:MM)")
    db.commit()
    db.refresh(row)
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "entry": lm.work_to_dict(row),
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
    }


@app.delete("/work/{entry_id}")
def delete_work(entry_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.WorkEntry).filter(
        models.WorkEntry.id == entry_id,
        models.WorkEntry.owner_id == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Nie znaleziono wpisu pracy")
    db.delete(row)
    db.commit()
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "message": "Usunięto wpis pracy",
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
    }


# === IMPORT/EXPORT ENDPOINTS ===

class ScheduleExport(BaseModel):
    entries: List[dict]

class ShoppingExport(BaseModel):
    items: List[dict]

@app.post("/schedule/export")
def export_schedule(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(models.ScheduleEntry).filter(
        models.ScheduleEntry.owner_id == current_user.id
    ).all()
    
    lines = [
        "QUESTDO_SCHEDULE_EXPORT",
        "VERSION:1.0",
        f"EXPORT_DATE:{datetime.now().strftime('%Y-%m-%d')}",
        ""
    ]
    
    for entry in entries:
        lines.append("[ENTRY]")
        lines.append(f"TITLE:{decrypt_field(entry.title)}")
        lines.append(f"LOCATION:{decrypt_field(entry.location)}")
        lines.append(f"LECTURER:{decrypt_field(entry.lecturer)}")
        if entry.is_recurring and entry.day_of_week is not None:
            lines.append(f"DAY_OF_WEEK:{entry.day_of_week}")
            lines.append("IS_RECURRING:true")
        else:
            lines.append(f"ENTRY_DATE:{entry.entry_date}")
            lines.append("IS_RECURRING:false")
        lines.append(f"START_TIME:{entry.start_time}")
        lines.append(f"END_TIME:{entry.end_time}")
        lines.append("")
    
    return {"content": "\n".join(lines), "filename": f"schedule_export_{datetime.now().strftime('%Y%m%d')}.txt"}

@app.post("/schedule/import")
def import_schedule(data: ScheduleExport, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    imported_count = 0
    errors = []
    
    for entry_data in data.entries:
        try:
            entry = models.ScheduleEntry(
                owner_id=current_user.id,
                title=encrypt_field(entry_data.get("title", "").strip()),
                location=encrypt_field(entry_data.get("location", "").strip()),
                lecturer=encrypt_field(entry_data.get("lecturer", "").strip()),
                is_recurring=entry_data.get("is_recurring", True),
                day_of_week=entry_data.get("day_of_week") if entry_data.get("is_recurring") else None,
                entry_date=datetime.strptime(entry_data.get("entry_date"), "%Y-%m-%d").date() if entry_data.get("entry_date") else None,
                start_time=entry_data.get("start_time", "08:00"),
                end_time=entry_data.get("end_time", "09:00")
            )
            db.add(entry)
            imported_count += 1
        except Exception as e:
            errors.append(f"Błąd przy imporcie '{entry_data.get('title', 'unknown')}': {str(e)}")
    
    db.commit()
    
    return {
        "imported": imported_count,
        "errors": errors,
        "message": f"Zaimportowano {imported_count} wpisów planu zajęć"
    }

@app.post("/shopping/export")
def export_shopping(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(models.ShoppingItem).filter(
        models.ShoppingItem.owner_id == current_user.id
    ).all()
    
    lines = [
        "QUESTDO_SHOPPING_EXPORT",
        "VERSION:1.0",
        f"EXPORT_DATE:{datetime.now().strftime('%Y-%m-%d')}",
        ""
    ]
    
    for item in items:
        lines.append("[ITEM]")
        lines.append(f"NAME:{decrypt_field(item.name)}")
        lines.append(f"QUANTITY:{decrypt_field(item.quantity)}")
        lines.append(f"CATEGORY:{item.category}")
        lines.append(f"BOUGHT:{str(item.bought).lower()}")
        lines.append("")
    
    return {"content": "\n".join(lines), "filename": f"shopping_export_{datetime.now().strftime('%Y%m%d')}.txt"}

@app.post("/shopping/import")
def import_shopping(data: ShoppingExport, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    imported_count = 0
    errors = []
    
    valid_categories = ["veggies", "fruits", "dairy", "bread", "meat", "drinks", "chemicals", "sweets", "other"]
    
    for item_data in data.items:
        try:
            category = item_data.get("category", "other")
            if category not in valid_categories:
                category = "other"
            
            item = models.ShoppingItem(
                owner_id=current_user.id,
                name=encrypt_field(item_data.get("name", "").strip()),
                quantity=encrypt_field(item_data.get("quantity", "").strip()),
                category=category,
                bought=item_data.get("bought", False)
            )
            db.add(item)
            imported_count += 1
        except Exception as e:
            errors.append(f"Błąd przy imporcie '{item_data.get('name', 'unknown')}': {str(e)}")
    
    db.commit()
    
    return {
        "imported": imported_count,
        "errors": errors,
        "message": f"Zaimportowano {imported_count} produktów"
    }


class ShoppingHistoryCreate(BaseModel):
    items_json: str
    total_items: int
    total_spent: float = 0.0
    notes: str = ""
    is_template: bool = False


class DefaultArticleCreate(BaseModel):
    name: str
    quantity: Optional[str] = ""
    category: Optional[str] = "other"
    default_price: float = 0.0


class DefaultArticleUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[str] = None
    category: Optional[str] = None
    default_price: Optional[float] = None

@app.get("/shopping/history")
def get_shopping_history(family_id: Optional[int] = None, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if family_id is not None:
        # Check if user is member of the family
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej rodziny")
        
        history = db.query(models.ShoppingHistory).filter(
            models.ShoppingHistory.family_id == family_id
        ).order_by(models.ShoppingHistory.completed_at.desc()).all()
    else:
        history = db.query(models.ShoppingHistory).filter(
            models.ShoppingHistory.owner_id == current_user.id,
            models.ShoppingHistory.family_id.is_(None)
        ).order_by(models.ShoppingHistory.completed_at.desc()).all()
    
    return [{
        "id": h.id,
        "total_items": h.total_items,
        "completed_at": h.completed_at.isoformat(),
        "total_spent": h.total_spent,
        "notes": h.notes,
        "is_template": h.is_template
    } for h in history]

@app.get("/shopping/history/{history_id}")
def get_shopping_history_detail(history_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(models.ShoppingHistory).filter(
        models.ShoppingHistory.id == history_id
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="Nie znaleziono historii")
    
    # Check if user has access to this history (either owner or family member)
    if history.family_id is not None:
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == history.family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie masz dostępu do tej historii")
    elif history.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tej historii")
    
    hours_since_completion = (datetime.utcnow() - history.completed_at).total_seconds() / 3600
    can_edit = hours_since_completion < 24
    
    return {
        "id": history.id,
        "items_json": history.items_json,
        "total_items": history.total_items,
        "completed_at": history.completed_at.isoformat(),
        "total_spent": history.total_spent,
        "notes": history.notes,
        "is_template": history.is_template,
        "can_edit": can_edit,
        "hours_since_completion": hours_since_completion
    }

@app.post("/shopping/history")
def create_shopping_history(data: ShoppingHistoryCreate, family_id: Optional[int] = None, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if family_id is not None:
        # Check if user is member of the family
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej rodziny")
    
    history = models.ShoppingHistory(
        owner_id=current_user.id,
        family_id=family_id,
        items_json=data.items_json,
        total_items=data.total_items,
        total_spent=data.total_spent,
        notes=data.notes,
        is_template=data.is_template
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    return {
        "id": history.id,
        "message": "Zapisano historię listy zakupów"
    }

@app.delete("/shopping/history/{history_id}")
def delete_shopping_history(history_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(models.ShoppingHistory).filter(
        models.ShoppingHistory.id == history_id
    ).first()

    if not history:
        raise HTTPException(status_code=404, detail="Nie znaleziono historii")

    # Check if user has access to this history (either owner or family member)
    if history.family_id is not None:
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == history.family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie masz dostępu do tej historii")
    elif history.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tej historii")

    db.delete(history)
    db.commit()

    return {"message": "Usunięto historii"}


@app.post("/shopping/history/{history_id}/load")
def load_shopping_from_history(history_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(models.ShoppingHistory).filter(
        models.ShoppingHistory.id == history_id
    ).first()

    if not history:
        raise HTTPException(status_code=404, detail="Nie znaleziono historii")

    # Check if user has access to this history (either owner or family member)
    if history.family_id is not None:
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == history.family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie masz dostępu do tej historii")
    elif history.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tej historii")

    hours_since_completion = (datetime.utcnow() - history.completed_at).total_seconds() / 3600
    can_edit = hours_since_completion < 24

    items_data = json.loads(history.items_json)
    created_items = []

    for item_data in items_data:
        item = models.ShoppingItem(
            owner_id=current_user.id,
            family_id=history.family_id,
            name=encrypt_field(item_data.get("name", "")),
            quantity=encrypt_field(item_data.get("quantity", "")),
            category=item_data.get("category", "other"),
            bought=False,
            price=item_data.get("price", 0.0)
        )
        db.add(item)
        db.flush()
        created_items.append(lm.shopping_to_dict(item))

    if can_edit:
        db.delete(history)
        db.commit()
        return {
            "message": "Wczytano listę z historii (edycja możliwa)",
            "items": created_items,
            "deleted_history": True
        }
    else:
        db.commit()
        return {
            "message": "Wczytano listę jako szablon (tylko podgląd)",
            "items": created_items,
            "deleted_history": False
        }


@app.get("/default-articles")
def get_default_articles(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    articles = db.query(models.DefaultArticle).filter(
        models.DefaultArticle.owner_id == current_user.id
    ).order_by(models.DefaultArticle.name).all()

    return [{
        "id": a.id,
        "name": a.name,
        "quantity": a.quantity,
        "category": a.category,
        "default_price": a.default_price,
        "created_at": a.created_at.isoformat()
    } for a in articles]


@app.get("/default-articles/search")
def search_default_articles(q: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not q or len(q) < 2:
        return []

    search_pattern = f"%{q.lower()}%"
    articles = db.query(models.DefaultArticle).filter(
        models.DefaultArticle.owner_id == current_user.id,
        models.DefaultArticle.name.ilike(search_pattern)
    ).order_by(models.DefaultArticle.name).limit(20).all()

    return [{
        "id": a.id,
        "name": a.name,
        "quantity": a.quantity,
        "category": a.category,
        "default_price": a.default_price
    } for a in articles]


@app.post("/default-articles")
def create_default_article(data: DefaultArticleCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nazwa artykułu jest wymagana")

    article = models.DefaultArticle(
        owner_id=current_user.id,
        name=name,
        quantity=data.quantity or "",
        category=validate_shopping_category(data.category or "other"),
        default_price=max(0.0, float(data.default_price or 0.0))
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    return {
        "id": article.id,
        "name": article.name,
        "quantity": article.quantity,
        "category": article.category,
        "default_price": article.default_price,
        "message": "Dodano artykuł domyślny"
    }


@app.patch("/default-articles/{article_id}")
def update_default_article(article_id: int, data: DefaultArticleUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    article = db.query(models.DefaultArticle).filter(
        models.DefaultArticle.id == article_id,
        models.DefaultArticle.owner_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Nie znaleziono artykułu")

    if data.name is not None:
        article.name = data.name.strip()
    if data.quantity is not None:
        article.quantity = data.quantity
    if data.category is not None:
        article.category = validate_shopping_category(data.category)
    if data.default_price is not None:
        article.default_price = max(0.0, float(data.default_price))

    db.commit()
    db.refresh(article)

    return {
        "id": article.id,
        "name": article.name,
        "quantity": article.quantity,
        "category": article.category,
        "default_price": article.default_price,
        "message": "Zaktualizowano artykuł"
    }


@app.delete("/default-articles/{article_id}")
def delete_default_article(article_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    article = db.query(models.DefaultArticle).filter(
        models.DefaultArticle.id == article_id,
        models.DefaultArticle.owner_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Nie znaleziono artykułu")

    db.delete(article)
    db.commit()

    return {"message": "Usunięto artykuł domyślny"}


@app.get("/shopping/summary")
def shopping_summary(family_id: Optional[int] = None, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if family_id is not None:
        # Check if user is member of the family
        membership = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family_id,
            models.FamilyMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej rodziny")
        
        items = db.query(models.ShoppingItem).filter(
            models.ShoppingItem.family_id == family_id
        ).all()
        history = db.query(models.ShoppingHistory).filter(
            models.ShoppingHistory.family_id == family_id
        ).all()
    else:
        items = db.query(models.ShoppingItem).filter(
            models.ShoppingItem.owner_id == current_user.id,
            models.ShoppingItem.family_id.is_(None)
        ).all()
        history = db.query(models.ShoppingHistory).filter(
            models.ShoppingHistory.owner_id == current_user.id,
            models.ShoppingHistory.family_id.is_(None)
        ).all()
    
    # Calculate expenses from history
    day_totals = {}
    week_totals = {}
    month_totals = {}
    year_totals = {}
    
    for h in history:
        date_str = str(h.completed_at.date())
        ym = date_str[:7]
        y = date_str[:4]
        
        # Calculate week number
        from datetime import datetime
        dt = h.completed_at
        week_str = f"{y}-W{dt.isocalendar()[1]:02d}"
        
        day_totals[date_str] = day_totals.get(date_str, 0.0) + h.total_spent
        week_totals[week_str] = week_totals.get(week_str, 0.0) + h.total_spent
        month_totals[ym] = month_totals.get(ym, 0.0) + h.total_spent
        year_totals[y] = year_totals.get(y, 0.0) + h.total_spent
    
    # Calculate current list total
    current_list_total = sum(item.price or 0.0 for item in items if item.bought)
    
    all_time_total = sum(h.total_spent for h in history)
    
    return {
        "current_list": round(current_list_total, 2),
        "all_time": round(all_time_total, 2),
        "by_day": {k: round(v, 2) for k, v in sorted(day_totals.items())},
        "by_week": {k: round(v, 2) for k, v in sorted(week_totals.items())},
        "by_month": {k: round(v, 2) for k, v in sorted(month_totals.items())},
        "by_year": {k: round(v, 2) for k, v in sorted(year_totals.items())},
    }


class HourlyRateCreate(BaseModel):
    rate: float
    label: str = ""

@app.get("/hourly-rates")
def get_hourly_rates(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rates = db.query(models.HourlyRate).filter(
        models.HourlyRate.owner_id == current_user.id
    ).order_by(models.HourlyRate.created_at.desc()).all()
    
    return [{
        "id": r.id,
        "rate": r.rate,
        "label": r.label,
        "created_at": r.created_at.isoformat()
    } for r in rates]

@app.post("/hourly-rates")
def create_hourly_rate(data: HourlyRateCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.rate <= 0:
        raise HTTPException(status_code=400, detail="Stawka musi być większa od 0")
    
    rate = models.HourlyRate(
        owner_id=current_user.id,
        rate=data.rate,
        label=data.label
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    
    return {
        "id": rate.id,
        "rate": rate.rate,
        "label": rate.label,
        "message": "Dodano stawkę godzinową"
    }

@app.delete("/hourly-rates/{rate_id}")
def delete_hourly_rate(rate_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rate = db.query(models.HourlyRate).filter(
        models.HourlyRate.id == rate_id,
        models.HourlyRate.owner_id == current_user.id
    ).first()
    
    if not rate:
        raise HTTPException(status_code=404, detail="Nie znaleziono stawki")
    
    db.delete(rate)
    db.commit()
    
    return {"message": "Usunięto stawkę"}


class DefaultCategoryUpdate(BaseModel):
    category: str


class DefaultHourlyRateUpdate(BaseModel):
    rate: float


@app.get("/settings/default-category")
def get_default_category(current_user: models.User = Depends(get_current_user)):
    return {"category": current_user.default_category or "other"}


@app.post("/settings/default-category")
def update_default_category(data: DefaultCategoryUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.default_category = data.category
    db.commit()
    return {"category": current_user.default_category}


@app.get("/settings/default-hourly-rate")
def get_default_hourly_rate(current_user: models.User = Depends(get_current_user)):
    return {"rate": current_user.default_hourly_rate}


@app.post("/settings/default-hourly-rate")
def update_default_hourly_rate(data: DefaultHourlyRateUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.rate <= 0:
        raise HTTPException(status_code=400, detail="Stawka musi być większa od 0")
    current_user.default_hourly_rate = data.rate
    db.commit()
    return {"rate": current_user.default_hourly_rate}


# === FAMILY ENDPOINTS ===
@app.get("/families")
def list_families(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    families = db.query(models.FamilyMember).filter(
        models.FamilyMember.user_id == current_user.id
    ).all()
    
    result = []
    for fm in families:
        family = fm.family
        members = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family.id
        ).all()
        member_info = []
        for m in members:
            user = db.query(models.User).filter(models.User.id == m.user_id).first()
            if user:
                member_info.append({
                    "id": user.id,
                    "username": user.username,
                    "role": m.role,
                    "joined_at": str(m.joined_at)
                })
        
        result.append({
            "id": family.id,
            "name": decrypt_field(family.name),
            "created_by": family.created_by,
            "created_at": str(family.created_at),
            "role": fm.role,
            "members": member_info
        })
    
    return result


@app.post("/families")
def create_family(data: FamilyCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nazwa rodziny jest wymagana")
    
    # Check if user is already in a family
    existing = db.query(models.FamilyMember).filter(
        models.FamilyMember.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Jesteś już członkiem rodziny")
    
    family = models.Family(
        name=encrypt_field(name),
        created_by=current_user.id
    )
    db.add(family)
    db.commit()
    db.refresh(family)
    
    # Add creator as admin
    member = models.FamilyMember(
        family_id=family.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(member)
    db.commit()
    
    return {
        "id": family.id,
        "name": name,
        "message": "Utworzono rodzinę"
    }


@app.post("/families/{family_id}/invite")
def invite_to_family(family_id: int, data: FamilyInvite, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if user is admin of the family
    membership = db.query(models.FamilyMember).filter(
        models.FamilyMember.family_id == family_id,
        models.FamilyMember.user_id == current_user.id,
        models.FamilyMember.role == "admin"
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Nie masz uprawnień do zapraszania")
    
    username = (data.username or "").strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Nazwa użytkownika jest wymagana")
    
    # Check if user exists (case-insensitive)
    target_user = db.query(models.User).filter(
        db.func.lower(models.User.username) == username
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    
    # Check if user is already in the family
    existing_member = db.query(models.FamilyMember).filter(
        models.FamilyMember.family_id == family_id,
        models.FamilyMember.user_id == target_user.id
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="Użytkownik jest już członkiem tej rodziny")
    
    # Use lowercase username for encryption to ensure consistency
    username_to_encrypt = target_user.username.lower()
    
    # Check if there's already a pending invitation
    existing_invitation = db.query(models.FamilyInvitation).filter(
        models.FamilyInvitation.family_id == family_id,
        models.FamilyInvitation.invited_username == encrypt_field(username_to_encrypt),
        models.FamilyInvitation.status == "pending"
    ).first()
    if existing_invitation:
        raise HTTPException(status_code=400, detail="Istnieje już zaproszenie dla tego użytkownika")
    
    invitation = models.FamilyInvitation(
        family_id=family_id,
        invited_by=current_user.id,
        invited_username=encrypt_field(username_to_encrypt),
        status="pending"
    )
    db.add(invitation)
    db.commit()
    
    return {"message": f"Wysłano zaproszenie do {target_user.username}"}


@app.get("/family/invitations")
def list_family_invitations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    invitations = db.query(models.FamilyInvitation).filter(
        models.FamilyInvitation.invited_username == encrypt_field(current_user.username.lower()),
        models.FamilyInvitation.status == "pending"
    ).all()
    
    result = []
    for inv in invitations:
        family = inv.family
        inviter = db.query(models.User).filter(models.User.id == inv.invited_by).first()
        result.append({
            "id": inv.id,
            "family_id": family.id,
            "family_name": decrypt_field(family.name),
            "invited_by": inviter.username if inviter else "Nieznany",
            "created_at": str(inv.created_at)
        })
    
    return result


@app.post("/family/invitations/{invitation_id}/accept")
def accept_family_invitation(invitation_id: int, body: EmptyBody = EmptyBody(), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    invitation = db.query(models.FamilyInvitation).filter(
        models.FamilyInvitation.id == invitation_id,
        models.FamilyInvitation.invited_username == encrypt_field(current_user.username.lower()),
        models.FamilyInvitation.status == "pending"
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Nie znaleziono zaproszenia")
    
    # Check if user is already in a family
    existing = db.query(models.FamilyMember).filter(
        models.FamilyMember.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Jesteś już członkiem rodziny")
    
    # Get family founder to inherit default settings
    family = db.query(models.Family).filter(models.Family.id == invitation.family_id).first()
    founder = db.query(models.User).filter(models.User.id == family.created_by).first()
    
    # Add user to family
    member = models.FamilyMember(
        family_id=invitation.family_id,
        user_id=current_user.id,
        role="member"
    )
    db.add(member)
    
    # Inherit default settings from founder if user doesn't have them set
    if founder and current_user.default_category == "other" and founder.default_category != "other":
        current_user.default_category = founder.default_category
    if founder and current_user.default_hourly_rate is None and founder.default_hourly_rate is not None:
        current_user.default_hourly_rate = founder.default_hourly_rate
    
    # Update invitation status
    invitation.status = "accepted"
    invitation.responded_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Zaakceptowano zaproszenie do rodziny"}


@app.post("/family/invitations/{invitation_id}/decline")
def decline_family_invitation(invitation_id: int, body: EmptyBody = EmptyBody(), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    invitation = db.query(models.FamilyInvitation).filter(
        models.FamilyInvitation.id == invitation_id,
        models.FamilyInvitation.invited_username == encrypt_field(current_user.username.lower()),
        models.FamilyInvitation.status == "pending"
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Nie znaleziono zaproszenia")
    
    invitation.status = "declined"
    invitation.responded_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Odrzucono zaproszenie"}


@app.post("/families/{family_id}/leave")
def leave_family(family_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(models.FamilyMember).filter(
        models.FamilyMember.family_id == family_id,
        models.FamilyMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Nie jesteś członkiem tej rodziny")
    
    # Check if user is the only admin
    if membership.role == "admin":
        other_admins = db.query(models.FamilyMember).filter(
            models.FamilyMember.family_id == family_id,
            models.FamilyMember.role == "admin",
            models.FamilyMember.user_id != current_user.id
        ).count()
        if other_admins == 0:
            raise HTTPException(status_code=400, detail="Jesteś jedynym administratorem. Nie możesz opuścić rodziny.")
    
    db.delete(membership)
    db.commit()
    
    return {"message": "Opuściłeś rodzinę"}


@app.get("/families/{family_id}/members")
def list_family_members(family_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if user is member of the family
    membership = db.query(models.FamilyMember).filter(
        models.FamilyMember.family_id == family_id,
        models.FamilyMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej rodziny")
    
    members = db.query(models.FamilyMember).filter(
        models.FamilyMember.family_id == family_id
    ).all()
    
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        if user:
            result.append({
                "id": user.id,
                "username": user.username,
                "role": m.role,
                "joined_at": str(m.joined_at)
            })
    
    return result


@app.patch("/families/{family_id}")
def update_family(family_id: int, data: FamilyUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if user is admin of the family
    membership = db.query(models.FamilyMember).filter(
        models.FamilyMember.family_id == family_id,
        models.FamilyMember.user_id == current_user.id,
        models.FamilyMember.role == "admin"
    ).first()

    if not membership:
        raise HTTPException(status_code=403, detail="Nie masz uprawnień do edycji rodziny")

    family = db.query(models.Family).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Nie znaleziono rodziny")

    if data.name is not None:
        name = (data.name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nazwa rodziny jest wymagana")
        family.name = encrypt_field(name)

    db.commit()
    db.refresh(family)

    return {
        "id": family.id,
        "name": decrypt_field(family.name),
        "message": "Zaktualizowano rodzinę"
    }


# === RECURRING EVENTS ENDPOINTS ===
@app.get("/recurring-events")
def list_recurring_events(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = db.query(models.RecurringEvent).filter(
        models.RecurringEvent.owner_id == current_user.id
    ).all()
    return [{
        "id": e.id,
        "title": e.title,
        "category": e.category,
        "month": e.month,
        "day": e.day,
        "interval_type": e.interval_type,
        "interval_value": e.interval_value,
        "start_date": str(e.start_date) if e.start_date else None,
        "end_date": str(e.end_date) if e.end_date else None,
        "created_at": str(e.created_at)
    } for e in events]


@app.post("/recurring-events")
def create_recurring_event(data: RecurringEventCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Nazwa wydarzenia jest wymagana")

    valid_categories = ["birthday", "anniversary", "holiday", "reminder"]
    if data.category not in valid_categories:
        raise HTTPException(status_code=400, detail="Nieprawidłowa kategoria")

    using_legacy = data.month is not None and data.day is not None
    using_interval = data.interval_type is not None and data.start_date is not None

    if not using_interval and not using_legacy:
        raise HTTPException(status_code=400, detail="Podaj typ interwału i datę początkową")

    if using_legacy:
        if not (1 <= data.month <= 12):
            raise HTTPException(status_code=400, detail="Nieprawidłowy miesiąc (1-12)")
        if not (1 <= data.day <= 31):
            raise HTTPException(status_code=400, detail="Nieprawidłowy dzień (1-31)")

    if using_interval:
        valid_interval_types = ["daily", "weekly", "monthly", "yearly"]
        if data.interval_type not in valid_interval_types:
            raise HTTPException(status_code=400, detail="Nieprawidłowy typ interwału (daily, weekly, monthly, yearly)")
        if data.interval_value is not None and data.interval_value <= 0:
            raise HTTPException(status_code=400, detail="Wartość interwału musi być dodatnia")
        try:
            date.fromisoformat(data.start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Nieprawidłowa data początkowa (YYYY-MM-DD)")
        if data.end_date:
            try:
                date.fromisoformat(data.end_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Nieprawidłowa data końcowa (YYYY-MM-DD)")

    event = models.RecurringEvent(
        owner_id=current_user.id,
        title=data.title,
        category=data.category,
        month=data.month if using_legacy else None,
        day=data.day if using_legacy else None,
        interval_type=data.interval_type if using_interval else None,
        interval_value=data.interval_value if using_interval else None,
        start_date=date.fromisoformat(data.start_date) if using_interval and data.start_date else None,
        end_date=date.fromisoformat(data.end_date) if using_interval and data.end_date else None
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return {
        "id": event.id,
        "title": event.title,
        "category": event.category,
        "month": event.month,
        "day": event.day,
        "interval_type": event.interval_type,
        "interval_value": event.interval_value,
        "start_date": str(event.start_date) if event.start_date else None,
        "end_date": str(event.end_date) if event.end_date else None,
        "created_at": str(event.created_at)
    }


@app.patch("/recurring-events/{event_id}")
def update_recurring_event(event_id: int, data: RecurringEventUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(models.RecurringEvent).filter(
        models.RecurringEvent.id == event_id,
        models.RecurringEvent.owner_id == current_user.id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Nie znaleziono wydarzenia")

    if data.title is not None:
        if not data.title.strip():
            raise HTTPException(status_code=400, detail="Nazwa wydarzenia jest wymagana")
        event.title = data.title

    if data.category is not None:
        valid_categories = ["birthday", "anniversary", "holiday", "reminder"]
        if data.category not in valid_categories:
            raise HTTPException(status_code=400, detail="Nieprawidłowa kategoria")
        event.category = data.category

    if data.month is not None:
        if not (1 <= data.month <= 12):
            raise HTTPException(status_code=400, detail="Nieprawidłowy miesiąc (1-12)")
        event.month = data.month

    if data.day is not None:
        if not (1 <= data.day <= 31):
            raise HTTPException(status_code=400, detail="Nieprawidłowy dzień (1-31)")
        event.day = data.day

    if data.interval_type is not None:
        valid_interval_types = ["daily", "weekly", "monthly", "yearly"]
        if data.interval_type not in valid_interval_types:
            raise HTTPException(status_code=400, detail="Nieprawidłowy typ interwału (daily, weekly, monthly, yearly)")
        event.interval_type = data.interval_type

    if data.interval_value is not None:
        if data.interval_value <= 0:
            raise HTTPException(status_code=400, detail="Wartość interwału musi być dodatnia")
        event.interval_value = data.interval_value

    if data.start_date is not None:
        try:
            event.start_date = date.fromisoformat(data.start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Nieprawidłowa data początkowa (YYYY-MM-DD)")

    if data.end_date is not None:
        try:
            event.end_date = date.fromisoformat(data.end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Nieprawidłowa data końcowa (YYYY-MM-DD)")

    db.commit()
    db.refresh(event)

    return {
        "id": event.id,
        "title": event.title,
        "category": event.category,
        "month": event.month,
        "day": event.day,
        "interval_type": event.interval_type,
        "interval_value": event.interval_value,
        "start_date": str(event.start_date) if event.start_date else None,
        "end_date": str(event.end_date) if event.end_date else None,
        "created_at": str(event.created_at)
    }


@app.delete("/recurring-events/{event_id}")
def delete_recurring_event(event_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(models.RecurringEvent).filter(
        models.RecurringEvent.id == event_id,
        models.RecurringEvent.owner_id == current_user.id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Nie znaleziono wydarzenia")

    event_title = event.title
    event_category = event.category
    related_tasks = db.query(models.Task).filter(
        models.Task.owner_id == current_user.id,
        models.Task.task_type == "event",
    ).all()
    for task in related_tasks:
        if decrypt_field(task.title) == event_title and task.event_category == event_category:
            db.delete(task)

    db.delete(event)
    db.commit()

    return {"message": "Usunięto wydarzenie cykliczne i powiązane wpisy w kalendarzu"}


# === FREE DAYS ENDPOINTS ===
@app.get("/free-days")
def list_free_days(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    free_days = db.query(models.FreeDay).filter(
        models.FreeDay.owner_id == current_user.id
    ).order_by(models.FreeDay.date).all()
    return [{
        "id": fd.id,
        "date": str(fd.date),
        "day_type": fd.day_type,
        "hours": fd.hours,
        "notes": fd.notes,
        "created_at": str(fd.created_at)
    } for fd in free_days]


@app.post("/free-days")
def create_free_day(data: FreeDayCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        free_date = date.fromisoformat(data.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowa data (YYYY-MM-DD)")

    valid_types = ["holiday", "deans_day", "rector_day"]
    if data.day_type not in valid_types:
        raise HTTPException(status_code=400, detail="Nieprawidłowy typ dnia")

    # Check if free day already exists for this date
    existing = db.query(models.FreeDay).filter(
        models.FreeDay.owner_id == current_user.id,
        models.FreeDay.date == free_date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dzień wolny dla tej daty już istnieje")

    free_day = models.FreeDay(
        owner_id=current_user.id,
        date=free_date,
        day_type=data.day_type,
        hours=data.hours,
        notes=data.notes
    )
    db.add(free_day)
    db.commit()
    db.refresh(free_day)

    return {
        "id": free_day.id,
        "date": str(free_day.date),
        "day_type": free_day.day_type,
        "hours": free_day.hours,
        "notes": free_day.notes,
        "message": "Dodano dzień wolny"
    }


@app.patch("/free-days/{free_day_id}")
def update_free_day(free_day_id: int, data: FreeDayUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    free_day = db.query(models.FreeDay).filter(
        models.FreeDay.id == free_day_id,
        models.FreeDay.owner_id == current_user.id
    ).first()

    if not free_day:
        raise HTTPException(status_code=404, detail="Nie znaleziono dnia wolnego")

    if data.date is not None:
        try:
            free_day.date = date.fromisoformat(data.date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Nieprawidłowa data (YYYY-MM-DD)")

    if data.day_type is not None:
        valid_types = ["holiday", "deans_day", "rector_day"]
        if data.day_type not in valid_types:
            raise HTTPException(status_code=400, detail="Nieprawidłowy typ dnia")
        free_day.day_type = data.day_type

    if data.hours is not None:
        free_day.hours = data.hours

    if data.notes is not None:
        free_day.notes = data.notes

    db.commit()
    db.refresh(free_day)

    return {
        "id": free_day.id,
        "date": str(free_day.date),
        "day_type": free_day.day_type,
        "hours": free_day.hours,
        "notes": free_day.notes,
        "message": "Zaktualizowano dzień wolny"
    }


@app.delete("/free-days/{free_day_id}")
def delete_free_day(free_day_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    free_day = db.query(models.FreeDay).filter(
        models.FreeDay.id == free_day_id,
        models.FreeDay.owner_id == current_user.id
    ).first()

    if not free_day:
        raise HTTPException(status_code=404, detail="Nie znaleziono dnia wolnego")

    db.delete(free_day)
    db.commit()

    return {"message": "Usunięto dzień wolny"}


@app.post("/free-days/generate/{year}")
def generate_holidays_for_year(year: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    import holidays as holidays_module
    
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Nieprawidłowy rok")
    
    added_count = holidays_module.generate_holidays_for_year(year, current_user.id, db)
    
    return {
        "message": f"Wygenerowano {added_count} świąt dla roku {year}",
        "added_count": added_count
    }


# === ADMIN ENDPOINTS ===
@app.get("/admin/users")
def list_all_users(current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.id).all()
    return [{
        "id": u.id,
        "username": u.username,
        "exp": u.exp,
        "streak": u.streak,
        "tasks_count": len(u.tasks),
        "achievements_count": len(u.achievements)
    } for u in users]


@app.delete("/admin/users/{user_id}")
def delete_user_admin(user_id: int, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.username == "Igor":
        raise HTTPException(status_code=403, detail="Cannot delete admin account")

    username = target_user.username

    db.query(models.Task).filter(models.Task.owner_id == user_id).delete()
    db.query(models.ScheduleEntry).filter(models.ScheduleEntry.owner_id == user_id).delete()
    db.query(models.ShoppingItem).filter(models.ShoppingItem.owner_id == user_id).delete()
    db.query(models.WorkEntry).filter(models.WorkEntry.owner_id == user_id).delete()
    db.query(models.UserAchievement).filter(models.UserAchievement.user_id == user_id).delete()
    db.query(models.DailyQuestAssignment).filter(models.DailyQuestAssignment.user_id == user_id).delete()
    db.query(models.PlayerRareDrop).filter(models.PlayerRareDrop.user_id == user_id).delete()
    db.query(models.PlayerExclusiveAchievement).filter(models.PlayerExclusiveAchievement.user_id == user_id).delete()
    db.query(models.PlayerBadge).filter(models.PlayerBadge.user_id == user_id).delete()
    db.query(models.PlayerHistory).filter(models.PlayerHistory.user_id == user_id).delete()
    db.delete(target_user)
    db.commit()

    return {"message": f"User '{username}' deleted successfully"}


@app.get("/admin/stats")
def get_admin_stats(current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_tasks = db.query(models.Task).count()
    total_completed = db.query(models.Task).filter(models.Task.completed == True).count()
    total_achievements = db.query(models.UserAchievement).count()
    total_rare_drops = db.query(models.PlayerRareDrop).count()

    return {
        "total_users": total_users,
        "total_tasks": total_tasks,
        "total_completed_tasks": total_completed,
        "total_achievements_unlocked": total_achievements,
        "total_rare_drops": total_rare_drops
    }


@app.post("/admin/reset-all-progress")
def reset_all_progress(current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    reset_at = datetime.utcnow()
    users = db.query(models.User).all()

    db.query(models.UserAchievement).delete()
    db.query(models.PlayerExclusiveAchievement).delete()
    db.query(models.PlayerRareDrop).delete()
    db.query(models.PlayerBadge).delete()
    db.query(models.PlayerHistory).delete()

    for user in users:
        user.streak = 0
        user.last_streak_date = None
        user.exp = 0
        user.exp_at_progress_reset = 0
        user.progress_reset_at = reset_at

    db.commit()
    return {
        "message": "Zresetowano osiągnięcia, znajdźki, serie, EXP i historię wszystkim użytkownikom",
        "users_reset": len(users),
        "reset_at": str(reset_at),
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)