from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    exp = Column(Integer, default=0)
    streak = Column(Integer, default=0)
    last_streak_date = Column(Date, nullable=True)
    progress_reset_at = Column(DateTime, nullable=True)
    exp_at_progress_reset = Column(Integer, default=0)
    tasks = relationship("Task", back_populates="owner")
    achievements = relationship("UserAchievement", back_populates="user")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String, default="")
    difficulty = Column(String, default="easy")  # easy, medium, hard
    category = Column(String, default="Inne")
    due_date = Column(Date, default=date.today)  # DATA zadania
    important = Column(Boolean, default=False)
    reminder_offset_days = Column(Integer, nullable=True)  # ile dni przed terminem przypomnieć
    completed = Column(Boolean, default=False)
    exp_awarded = Column(Boolean, default=False)  # Czy EXP już przyznany
    exp_awarded_amount = Column(Integer, default=0)  # Faktycznie przyznane EXP (z bonusem/karą)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="tasks")

class Achievement(Base):
    __tablename__ = "achievements"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)  # slug (np. first_step)
    title = Column(String, nullable=True)  # wyświetlana nazwa (np. First Step)
    description = Column(String)
    icon = Column(String, default="🏆")
    requirement_type = Column(String)  # "tasks_count", "streak", "exp", "category_master"
    requirement_value = Column(Integer)  # np. 10 zadań
    
class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_id = Column(Integer, ForeignKey("achievements.id"))
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement")


class DailyQuestAssignment(Base):
    """3 losowe wyzwania przypisane użytkownikowi na dany dzień."""
    __tablename__ = "daily_quest_assignments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    quest_date = Column(Date, index=True)
    quest_ids = Column(String)  # np. "c3,hard1,studia"
    bonus_claimed = Column(Boolean, default=False)


class RareDrop(Base):
    """Definicja rzadkiego przedmiotu — jedno źródło prawdy."""
    __tablename__ = "rare_drops"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)  # np. "platinum_coin"
    name = Column(String)  # Platinum Coin
    description = Column(String)
    icon = Column(String)  # 🪙
    rarity = Column(String)  # "common", "rare", "epic", "legendary"
    drop_chance_percent = Column(Integer, default=5)  # % szansa dziennie


class PlayerRareDrop(Base):
    """Przedmiot zdobyty przez gracza."""
    __tablename__ = "player_rare_drops"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    rare_drop_id = Column(Integer, ForeignKey("rare_drops.id"))
    source_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)
    obtained_date = Column(Date, index=True)
    obtained_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    rare_drop = relationship("RareDrop")


class ExclusiveAchievement(Base):
    """Specjalne osiągnięcia z warunkami czasowymi/czułymi."""
    __tablename__ = "exclusive_achievements"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(String)
    icon = Column(String, default="⭐")
    requirement_type = Column(String)  # "founding_titan", "speedrunner", "night_owl", etc.


class PlayerExclusiveAchievement(Base):
    """Specjalne osiągnięcie zdobyte przez gracza."""
    __tablename__ = "player_exclusive_achievements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    exclusive_achievement_id = Column(Integer, ForeignKey("exclusive_achievements.id"))
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    exclusive_achievement = relationship("ExclusiveAchievement")


class PlayerBadge(Base):
    """Odznaki/rangi gracza — zebraane z kolekcji."""
    __tablename__ = "player_badges"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    badge_type = Column(String)  # "collector", "speedrunner", "veteran", "completionist"
    badge_tier = Column(Integer, default=1)  # 1, 2, 3, 4, 5
    acquired_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class PlayerHistory(Base):
    """Chronologiczny dziennik rzeczy zdobytych przez gracza."""
    __tablename__ = "player_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    event_type = Column(String, index=True)  # "achievement", "rare_drop", "level"
    event_key = Column(String, unique=True, index=True)
    message = Column(String)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    user = relationship("User")


class PushSubscription(Base):
    """Subskrypcja Web Push (powiadomienia gdy aplikacja zamknięta)."""
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    endpoint = Column(String, unique=True, index=True)
    p256dh = Column(String)
    auth = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class SentTaskReminder(Base):
    """Wysłane przypomnienia push (jedno na zadanie i dzień przypomnienia)."""
    __tablename__ = "sent_task_reminders"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    reminder_on = Column(Date, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
