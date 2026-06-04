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
    difficulty = Column(String, default="easy")
    category = Column(String, default="Inne")
    due_date = Column(Date, default=date.today)
    important = Column(Boolean, default=False)
    reminder_offset_days = Column(Integer, nullable=True)
    completed = Column(Boolean, default=False)
    exp_awarded = Column(Boolean, default=False)
    exp_awarded_amount = Column(Integer, default=0)
    exp_timing = Column(String, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    delayed_rewards_claimed = Column(Boolean, default=False)
    delayed_rewards_forfeited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="tasks")

class Achievement(Base):
    __tablename__ = "achievements"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    title = Column(String, nullable=True)
    description = Column(String)
    icon = Column(String, default="🏆")
    requirement_type = Column(String)
    requirement_value = Column(Integer)
    
class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_id = Column(Integer, ForeignKey("achievements.id"))
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement")


class DailyQuestAssignment(Base):
    __tablename__ = "daily_quest_assignments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    quest_date = Column(Date, index=True)
    quest_ids = Column(String)
    bonus_claimed = Column(Boolean, default=False)


class RareDrop(Base):
    __tablename__ = "rare_drops"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String)
    icon = Column(String)
    rarity = Column(String)
    drop_chance_percent = Column(Integer, default=5)


class PlayerRareDrop(Base):
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
    __tablename__ = "exclusive_achievements"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(String)
    icon = Column(String, default="⭐")
    requirement_type = Column(String)


class PlayerExclusiveAchievement(Base):
    __tablename__ = "player_exclusive_achievements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    exclusive_achievement_id = Column(Integer, ForeignKey("exclusive_achievements.id"))
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    exclusive_achievement = relationship("ExclusiveAchievement")


class PlayerBadge(Base):
    __tablename__ = "player_badges"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    badge_type = Column(String)
    badge_tier = Column(Integer, default=1)
    acquired_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class PlayerHistory(Base):
    __tablename__ = "player_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    event_type = Column(String, index=True)
    event_key = Column(String, unique=True, index=True)
    message = Column(String)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    user = relationship("User")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    endpoint = Column(String, unique=True, index=True)
    p256dh = Column(String)
    auth = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class SentTaskReminder(Base):
    __tablename__ = "sent_task_reminders"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    reminder_on = Column(Date, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
