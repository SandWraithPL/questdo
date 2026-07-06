# Importy potrzebne do definicji modeli bazy danych
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Float
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date

# Model użytkownika - przechowuje dane konta i postęp w grze
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID użytkownika
    username = Column(String, unique=True, index=True)  # Nazwa użytkownika (unikalna)
    hashed_password = Column(String)  # Zahashowane hasło
    exp = Column(Integer, default=0)  # Punkty doświadczenia
    streak = Column(Integer, default=0)  # Liczba dni z rzędu z ukończonymi zadaniami
    last_streak_date = Column(Date, nullable=True)  # Data ostatniego dnia w serii
    progress_reset_at = Column(DateTime, nullable=True)  # Kiedy resetowano postęp
    exp_at_progress_reset = Column(Integer, default=0)  # EXP w momencie resetu
    default_category = Column(String, default="other")  # Domyślna kategoria zadań
    default_hourly_rate = Column(Float, nullable=True)  # Domyślna stawka godzinowa
    tasks = relationship("Task", back_populates="owner")  # Relacja do zadań użytkownika
    achievements = relationship("UserAchievement", back_populates="user")  # Relacja do osiągnięć

# Model zadania/questu - pojedyncze zadanie do wykonania
class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID zadania
    title = Column(String)  # Tytuł zadania (zaszyfrowany)
    description = Column(String, default="")  # Opis zadania (zaszyfrowany)
    difficulty = Column(String, default="easy")  # Poziom trudności: easy/medium/hard
    category = Column(String, default="Inne")  # Kategoria zadania
    due_date = Column(Date, default=date.today)  # Termin wykonania
    important = Column(Boolean, default=False)  # Czy zadanie jest ważne
    reminder_offset_days = Column(Integer, nullable=True)  # Ile dni przed terminem przypominać
    completed = Column(Boolean, default=False)  # Czy zadanie zostało ukończone
    exp_awarded = Column(Boolean, default=False)  # Czy już przyznano EXP za to zadanie
    exp_awarded_amount = Column(Integer, default=0)  # Ile EXP przyznano
    exp_timing = Column(String, nullable=True)  # Czy przed terminem/po terminie/w terminie
    completed_at = Column(DateTime, nullable=True)  # Kiedy zadanie zostało ukończone
    delayed_rewards_claimed = Column(Boolean, default=False)  # Czy odebrano opóźnione nagrody
    delayed_rewards_forfeited = Column(Boolean, default=False)  # Czy zrezygnowano z nagród
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono zadanie
    owner_id = Column(Integer, ForeignKey("users.id"))  # ID właściciela zadania
    owner = relationship("User", back_populates="tasks")  # Relacja do użytkownika
    task_type = Column(String, default="quest")  # Typ: quest (zwykłe) lub event (wydarzenie)
    event_category = Column(String, nullable=True)  # Kategoria wydarzenia: urodziny, rocznica itp.
    recurring_pattern = Column(String, nullable=True)  # Wzór powtarzania: yearly, monthly, weekly
    recurring_end_date = Column(Date, nullable=True)  # Opcjonalna data końca powtarzania

# Model osiągnięcia - definicja osiągnięcia do odblokowania
class Achievement(Base):
    __tablename__ = "achievements"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID osiągnięcia
    name = Column(String, unique=True)  # Unikalna nazwa (slug) osiągnięcia
    title = Column(String, nullable=True)  # Wyświetlany tytuł osiągnięcia
    description = Column(String)  # Opis co trzeba zrobić
    icon = Column(String, default="🏆")  # Ikona osiągnięcia
    requirement_type = Column(String)  # Typ wymogu (np. tasks, streak, exp)
    requirement_value = Column(Integer)  # Wartość wymogu (np. 10 zadań)
    
# Model przypisania osiągnięcia do użytkownika
class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID przypisania
    user_id = Column(Integer, ForeignKey("users.id"))  # ID użytkownika
    achievement_id = Column(Integer, ForeignKey("achievements.id"))  # ID osiągnięcia
    unlocked_at = Column(DateTime, default=datetime.utcnow)  # Kiedy odblokowano
    user = relationship("User", back_populates="achievements")  # Relacja do użytkownika
    achievement = relationship("Achievement")  # Relacja do osiągnięcia


# Model przypisania dziennych wyzwań dla użytkownika w konkretnym dniu
class DailyQuestAssignment(Base):
    __tablename__ = "daily_quest_assignments"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID przypisania
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    quest_date = Column(Date, index=True)  # Data wyzwań
    quest_ids = Column(String)  # ID przypisanych wyzwań (jako string)
    bonus_claimed = Column(Boolean, default=False)  # Czy odebrano bonus za ukończenie wszystkich


# Model rzadkiej znajdźki - przedmiot do zdobycia za ukończenie zadań
class RareDrop(Base):
    __tablename__ = "rare_drops"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID znajdźki
    slug = Column(String, unique=True, index=True)  # Unikalny identyfikator
    name = Column(String)  # Nazwa znajdźki
    description = Column(String)  # Opis znajdźki
    icon = Column(String)  # Ikona przedmiotu
    rarity = Column(String)  # Rzadkość: common, rare, epic, legendary
    drop_chance_percent = Column(Integer, default=5)  # Szansa na drop w procentach


# Model znajdźki zdobytej przez gracza
class PlayerRareDrop(Base):
    __tablename__ = "player_rare_drops"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID zdobytej znajdźki
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    rare_drop_id = Column(Integer, ForeignKey("rare_drops.id"))  # ID typu znajdźki
    source_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)  # ID zadania za które zdobyt0
    obtained_date = Column(Date, index=True)  # Data zdobycia
    obtained_at = Column(DateTime, default=datetime.utcnow)  # Dokładny czas zdobycia
    user = relationship("User")  # Relacja do użytkownika
    rare_drop = relationship("RareDrop")  # Relacja do definicji znajdźki


# Model ekskluzywnego osiągnięcia - specjalne, trudniejsze do zdobycia
class ExclusiveAchievement(Base):
    __tablename__ = "exclusive_achievements"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID osiągnięcia
    slug = Column(String, unique=True, index=True)  # Unikalny identyfikator
    title = Column(String)  # Tytuł osiągnięcia
    description = Column(String)  # Opis wymogów
    icon = Column(String, default="⭐")  # Ikona osiągnięcia
    requirement_type = Column(String)  # Typ wymogu (np. daily_exp_milestone)


# Model ekskluzywnego osiągnięcia zdobytego przez gracza
class PlayerExclusiveAchievement(Base):
    __tablename__ = "player_exclusive_achievements"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID przypisania
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    exclusive_achievement_id = Column(Integer, ForeignKey("exclusive_achievements.id"))  # ID osiągnięcia
    unlocked_at = Column(DateTime, default=datetime.utcnow)  # Kiedy odblokowano
    user = relationship("User")  # Relacja do użytkownika
    exclusive_achievement = relationship("ExclusiveAchievement")  # Relacja do osiągnięcia


# Model odznaki gracza - dodatkowy system nagród
class PlayerBadge(Base):
    __tablename__ = "player_badges"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID odznaki
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    badge_type = Column(String)  # Typ odznaki
    badge_tier = Column(Integer, default=1)  # Poziom odznaki
    acquired_at = Column(DateTime, default=datetime.utcnow)  # Kiedy zdobyto
    user = relationship("User")  # Relacja do użytkownika


# Model historii gracza - zapisuje wszystkie ważne wydarzenia
class PlayerHistory(Base):
    __tablename__ = "player_history"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID wydarzenia
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    event_type = Column(String, index=True)  # Typ wydarzenia (achievement, level itp.)
    event_key = Column(String, unique=True, index=True)  # Unikalny klucz wydarzenia
    message = Column(String)  # Komunikat do wyświetlenia
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)  # Kiedy wydarzenie się stało
    user = relationship("User")  # Relacja do użytkownika


# Model subskrypcji powiadomień push dla użytkownika
class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID subskrypcji
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    endpoint = Column(String, unique=True, index=True)  # URL endpointu powiadomień
    p256dh = Column(String)  # Klucz publiczny do szyfrowania
    auth = Column(String)  # Klucz autoryzacyjny
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono subskrypcję


# Model wysłanego przypomnienia o zadaniu
class SentTaskReminder(Base):
    __tablename__ = "sent_task_reminders"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID przypomnienia
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)  # ID zadania
    reminder_on = Column(Date, index=True)  # Data na którą wysłano przypomnienie
    sent_at = Column(DateTime, default=datetime.utcnow)  # Kiedy wysłano przypomnienie


# Model wpisu w harmonogramie (np. zajęcia na uczelni)
class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID wpisu
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    title = Column(String)  # Tytuł wydarzenia (zaszyfrowany)
    location = Column(String, default="")  # Miejsce (zaszyfrowane)
    lecturer = Column(String, default="")  # Prowadzący (zaszyfrowany)
    day_of_week = Column(Integer, nullable=True)  # Dzień tygodnia (0-6, 0=poniedziałek)
    entry_date = Column(Date, nullable=True)  # Konkretna data (jeśli nie cykliczne)
    is_recurring = Column(Boolean, default=True)  # Czy wydarzenie się powtarza
    start_time = Column(String)  # Godzina rozpoczęcia (HH:MM)
    end_time = Column(String)  # Godzina zakończenia (HH:MM)
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono
    completed = Column(Boolean, default=False)  # Czy wpis został zrealizowany
    start_date = Column(Date, nullable=True)  # Data początku cyklu
    end_date = Column(Date, nullable=True)  # Data końca cyklu
    owner = relationship("User")  # Relacja do użytkownika


# Model przedmiotu na liście zakupów
class ShoppingItem(Base):
    __tablename__ = "shopping_items"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID przedmiotu
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    family_id = Column(Integer, ForeignKey("families.id"), nullable=True, index=True)  # ID rodziny (opcjonalne)
    name = Column(String)  # Nazwa produktu (zaszyfrowana)
    quantity = Column(String, default="")  # Ilość (zaszyfrowana)
    unit = Column(String, default="szt")  # Jednostka (szt, kg, l itp.)
    category = Column(String, default="other")  # Kategoria produktu
    bought = Column(Boolean, default=False)  # Czy już kupiono
    exp_awarded = Column(Boolean, default=False)  # Czy przyznano EXP
    price = Column(Float, default=0.0)  # Cena szacunkowa
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy dodano
    owner = relationship("User")  # Relacja do użytkownika
    family = relationship("Family", back_populates="shopping_items")  # Relacja do rodziny


# Model historii zakupów - zarchiwizowane listy zakupów
class ShoppingHistory(Base):
    __tablename__ = "shopping_history"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID historii
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    family_id = Column(Integer, ForeignKey("families.id"), nullable=True, index=True)  # ID rodziny
    items_json = Column(String)  # Lista przedmiotów jako JSON
    total_items = Column(Integer, default=0)  # Liczba przedmiotów
    completed_at = Column(DateTime, default=datetime.utcnow)  # Kiedy zakończono zakupy
    total_spent = Column(Float, default=0.0)  # Ile wydano
    notes = Column(String, default="")  # Notatki do zakupów
    is_template = Column(Boolean, default=False)  # Czy to szablon do powtórnego użycia
    owner = relationship("User")  # Relacja do użytkownika
    family = relationship("Family", back_populates="shopping_history")  # Relacja do rodziny


# Model stawki godzinowej - różne stawki dla różnych prac
class HourlyRate(Base):
    __tablename__ = "hourly_rates"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID stawki
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    rate = Column(Float)  # Wartość stawki godzinowej
    label = Column(String, default="")  # Etykieta np. "Praca domowa", "Freelance"
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono
    owner = relationship("User")  # Relacja do użytkownika


# Model wpisu pracy - zapis przepracowanych godzin i zarobków
class WorkEntry(Base):
    __tablename__ = "work_entries"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID wpisu
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    work_date = Column(Date, index=True)  # Data pracy
    start_time = Column(String)  # Godzina rozpoczęcia (HH:MM)
    end_time = Column(String)  # Godzina zakończenia (HH:MM)
    hourly_rate = Column(String)  # Stawka godzinowa (zaszyfrowana)
    notes = Column(String, default="")  # Notatki (zaszyfrowane)
    tax_enabled = Column(Boolean, default=False)  # Czy naliczać podatek
    tax_percent = Column(Float, default=0.0)  # Procent podatku
    completed = Column(Boolean, default=False)  # Czy wpis zrealizowany
    exp_awarded = Column(Boolean, default=False)  # Czy przyznano EXP
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono
    is_recurring = Column(Boolean, default=False)  # Czy wpis się powtarza
    day_of_week = Column(Integer, nullable=True)  # Dzień tygodnia dla cyklicznych
    end_date = Column(Date, nullable=True)  # Data końca cyklu
    owner = relationship("User")  # Relacja do użytkownika


# Model domyślnego artykułu - produkty często kupowane
class DefaultArticle(Base):
    __tablename__ = "default_articles"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID artykułu
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    family_id = Column(Integer, ForeignKey("families.id"), nullable=True, index=True)  # ID rodziny
    name = Column(String)  # Nazwa produktu (zaszyfrowana)
    quantity = Column(String, default="")  # Domyślna ilość (zaszyfrowana)
    unit = Column(String, default="szt")  # Jednostka
    category = Column(String, default="other")  # Kategoria
    default_price = Column(Float, default=0.0)  # Szacunkowa cena
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono
    owner = relationship("User")  # Relacja do użytkownika


# Model rodziny - grupa użytkowników współdzieląca listy zakupów
class Family(Base):
    __tablename__ = "families"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID rodziny
    name = Column(String)  # Nazwa rodziny
    created_by = Column(Integer, ForeignKey("users.id"))  # ID twórcy rodziny
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono
    members = relationship("FamilyMember", back_populates="family")  # Relacja do członków
    invitations = relationship("FamilyInvitation", back_populates="family")  # Relacja do zaproszeń
    shopping_items = relationship("ShoppingItem", back_populates="family")  # Relacja do zakupów
    shopping_history = relationship("ShoppingHistory", back_populates="family")  # Relacja do historii


# Model członka rodziny - przypisanie użytkownika do rodziny
class FamilyMember(Base):
    __tablename__ = "family_members"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID przypisania
    family_id = Column(Integer, ForeignKey("families.id"))  # ID rodziny
    user_id = Column(Integer, ForeignKey("users.id"))  # ID użytkownika
    role = Column(String, default="member")  # Rola w rodzinie
    joined_at = Column(DateTime, default=datetime.utcnow)  # Kiedy dołączył
    family = relationship("Family", back_populates="members")  # Relacja do rodziny
    user = relationship("User")  # Relacja do użytkownika


# Model zaproszenia do rodziny
class FamilyInvitation(Base):
    __tablename__ = "family_invitations"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID zaproszenia
    family_id = Column(Integer, ForeignKey("families.id"))  # ID rodziny
    invited_by = Column(Integer, ForeignKey("users.id"))  # ID zapraszającego
    invited_username = Column(String)  # Nazwa zapraszanego użytkownika
    status = Column(String, default="pending")  # Status: pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy wysłano
    responded_at = Column(DateTime, nullable=True)  # Kiedy odpowiedziano
    family = relationship("Family", back_populates="invitations")  # Relacja do rodziny


# Model powtarzającego się wydarzenia (urodziny, rocznice itp.)
class RecurringEvent(Base):
    __tablename__ = "recurring_events"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID wydarzenia
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID właściciela
    title = Column(String)  # Tytuł wydarzenia
    category = Column(String, default="birthday")  # Kategoria: birthday, anniversary itp.
    month = Column(Integer, nullable=True)  # Miesiąc wydarzenia (1-12)
    day = Column(Integer, nullable=True)  # Dzień wydarzenia
    interval_type = Column(String, nullable=True)  # Typ interwału: daily, weekly, monthly, yearly
    interval_value = Column(Integer, nullable=True)  # Wartość interwału (np. co 2 tygodnie)
    start_date = Column(Date, nullable=True)  # Data początku
    end_date = Column(Date, nullable=True)  # Data końca
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono


# Model dnia wolnego - święta, dni dziekana itp.
class FreeDay(Base):
    __tablename__ = "free_days"
    id = Column(Integer, primary_key=True, index=True)  # Unikalne ID dnia wolnego
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # ID użytkownika
    date = Column(Date, index=True)  # Data dnia wolnego
    day_type = Column(String, default="holiday")  # Typ: holiday, deans_day, rector_day
    hours = Column(String, nullable=True)  # Opcjonalnie zakres godzin np. "08:00-12:00"
    notes = Column(String, nullable=True)  # Notatki
    created_at = Column(DateTime, default=datetime.utcnow)  # Kiedy utworzono
    owner = relationship("User")  # Relacja do użytkownika
