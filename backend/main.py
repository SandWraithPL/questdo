from fastapi import FastAPI, Depends, HTTPException, status
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

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None
    WebPushException = Exception

REMINDER_TZ = ZoneInfo("Europe/Warsaw")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CONTACT = os.getenv("VAPID_CONTACT", "mailto:questdo@example.com")

def create_tables():
    for i in range(10):
        try:
            models.Base.metadata.create_all(bind=engine)
            migrate_schema()
            print("Połączono z bazą danych!")
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
            body = f'Przypomnienie: zadanie „{task.title}" ma termin {task.due_date}'
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
            process_scheduled_reminders()
        except Exception as exc:
            print(f"[reminders] loop error: {exc}")
        time.sleep(60)


@app.on_event("startup")
def startup_event():
    create_tables()
    if _push_configured():
        threading.Thread(target=reminder_scheduler_loop, daemon=True).start()
        print("[push] Web Push scheduler started (09:00 Europe/Warsaw)")
    else:
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
        return True
    return False


def task_to_dict(t: models.Task) -> dict:
    data = {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "difficulty": t.difficulty,
        "category": t.category,
        "completed": t.completed,
        "exp_awarded": t.exp_awarded,
        "exp_awarded_amount": t.exp_awarded_amount or 0,
        "important": bool(t.important),
        "reminder_offset_days": t.reminder_offset_days,
        "due_date": str(t.due_date),
        "created_at": str(t.created_at),
    }
    if t.completed and t.exp_awarded and t.completed_at:
        data["completed_at"] = str(t.completed_at)
    if t.exp_awarded and t.exp_timing:
        data["exp_timing"] = t.exp_timing
    if not t.completed and t.due_date:
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
    # Delete history entries for this achievement (both task-specific and non-task-specific)
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
    # Delete history entries for this exclusive achievement (both task-specific and non-task-specific)
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
            db.query(models.PlayerHistory).filter(
                models.PlayerHistory.user_id == user.id,
                models.PlayerHistory.event_key == f"user:{user.id}:level:{level}"
            ).delete(synchronize_session=False)
            removed_levels.append(level)
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

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[str] = None
    important: Optional[bool] = None
    reminder_offset_days: Optional[int] = None

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
        body = f"Zdobyto osiągnięcie '{title}' za ukończenie zadania '{task.title}'"
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
    body = f"Zdobyto osiągnięcie '{title}' za ukończenie zadania '{task.title}'"
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

        body = f"Znaleziono przedmiot '{drop_def['name']}' za ukończenie zadania '{task.title}'"
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
def register(user: UserCreate, db: Session = Depends(get_db)):
    username, password = validate_account_credentials(user.username, user.password)
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    new_user = models.User(
        username=username,
        hashed_password=get_password_hash(password)
    )
    db.add(new_user)
    db.commit()
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
    new_task = models.Task(
        title=validate_title(task.title),
        description=(task.description or "").strip()[:1000],
        difficulty=validate_difficulty(task.difficulty or "easy"),
        category=validate_category(task.category or "Inne"),
        due_date=due,
        important=bool(task.important),
        reminder_offset_days=validate_reminder_offset(task.reminder_offset_days),
        owner_id=current_user.id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return {"id": new_task.id, "message": "Task created", "due_date": str(new_task.due_date)}

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
        task.title = validate_title(task_update.title)
    if task_update.description is not None:
        task.description = task_update.description.strip()[:1000]
    if task_update.important is not None:
        task.important = bool(task_update.important)
    if "reminder_offset_days" in fields_set:
        task.reminder_offset_days = validate_reminder_offset(task_update.reminder_offset_days)

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
            old_exp = current_user.exp
            current_user.exp = max(0, current_user.exp - exp_to_revert)
            task.exp_awarded = False
            task.exp_awarded_amount = 0
            task.completed = False
            task.completed_at = None
            task.delayed_rewards_forfeited = True
            task.delayed_rewards_claimed = False
            
            exp_gained = -exp_to_revert
            
            print(f"[uncheck] Reverting {exp_to_revert} EXP for task {task.id}")
            
            # Remove level-up history if level dropped
            remove_level_up_history(current_user, old_exp, db)
            
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
            level_ups.extend(record_level_ups(current_user, current_user.exp, db))
            
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
            
            new_rewards = {"achievements": [], "exclusive_achievements": []}
            earned_drop = None
            
        if task_update.completed and not was_completed:
            task.completed = True
            task.completed_at = datetime.utcnow()
            if not task.delayed_rewards_forfeited:
                task.delayed_rewards_claimed = False
            if not task.exp_awarded:
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

    exp_removed = 0
    if task.exp_awarded:
        exp_removed = task.exp_awarded_amount or EXP_REWARDS.get(task.difficulty, 10)
        current_user.exp = max(0, current_user.exp - exp_removed)

    # Usuń wszystkie wpisy historii powiązane z tym taskiem
    deleted_history_count = db.query(models.PlayerHistory).filter(
        models.PlayerHistory.user_id == current_user.id,
        models.PlayerHistory.event_key.like(f"user:{current_user.id}:task:{task_id}:%")
    ).delete(synchronize_session=False)
    print(f"[delete_task] Deleted {deleted_history_count} history entries for task {task_id}")

    db.delete(task)
    if exp_removed:
        reconcile_standard_achievements(current_user, db)
    db.commit()
    level, title, next_exp, next_title = gc.get_level(current_user.exp)
    return {
        "message": "Deleted",
        "exp_removed": exp_removed,
        "exp": current_user.exp,
        "level": level,
        "title": title,
        "next_level_exp": next_exp,
        "next_level_title": next_title,
        "achievements": build_achievements_payload(current_user, db),
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