"""Poziomy, osiągnięcia, rare drops i meta — jedno źródło prawdy."""
from __future__ import annotations

# (próg EXP, poziom, tytuł)
LEVELS: list[tuple[int, int, str]] = [
    (0, 1, "Kadet"),
    (80, 2, "Rekrut"),
    (180, 3, "Zwiadowca"),
    (320, 4, "Żołnierz"),
    (480, 5, "As"),
    (660, 6, "Taktyk"),
    (860, 7, "Rywal"),
    (1080, 8, "Weteran w drodze"),
    (1320, 9, "W treningu"),
    (1600, 10, "Mistrz rytmu"),
    (1900, 11, "Uczeń"),
    (2250, 12, "Rycerz"),
    (2650, 13, "W przebiegu"),
    (3100, 14, "Strażnik"),
    (3600, 15, "W cieniu"),
    (4150, 16, "Architekt"),
    (4750, 17, "Teoretyk"),
    (5400, 18, "Decydent"),
    (6100, 19, "W zasięgu"),
    (7000, 20, "Legenda"),
]

EXP_RULES = {
    "early_bonus": "+50%",
    "late_penalty": "-50%",
    "hint": "Wcześniej +50% EXP · w terminie pełna nagroda · po terminie −50%",
}


def get_level(exp: int) -> tuple[int, str, int | None, str | None]:
    """level, title, next_threshold, next_title"""
    current = LEVELS[0]
    for entry in LEVELS:
        if exp >= entry[0]:
            current = entry
    idx = next((i for i, e in enumerate(LEVELS) if e[0] == current[0]), 0)
    nxt = LEVELS[idx + 1] if idx + 1 < len(LEVELS) else None
    return current[1], current[2], nxt[0] if nxt else None, nxt[2] if nxt else None


# slug, title, description, icon, kind, value
ACHIEVEMENT_DEFS: list[dict] = [
    {"slug": "first_step", "title": "Pierwszy krok", "description": "Ukończ pierwszy quest.", "icon": "🌟", "kind": "tasks", "value": 1},
    {"slug": "second_bite", "title": "Dobry start", "description": "Ukończ 3 questy.", "icon": "✨", "kind": "tasks", "value": 3},
    {"slug": "scout_badge", "title": "Dziesiątka zadań", "description": "Ukończ 10 questów.", "icon": "⚔️", "kind": "tasks", "value": 10},
    {"slug": "veteran_wall", "title": "Stały rytm", "description": "Ukończ 25 questów.", "icon": "🛡️", "kind": "tasks", "value": 25},
    {"slug": "hundred_club", "title": "Pięćdziesiątka", "description": "Ukończ 50 questów.", "icon": "🏆", "kind": "tasks", "value": 50},
    {"slug": "mission_archive", "title": "Archiwum zadań", "description": "Ukończ 100 questów.", "icon": "📜", "kind": "tasks", "value": 100},
    {"slug": "early_bird", "title": "Zrobione wcześniej", "description": "Ukończ 5 questów przed terminem.", "icon": "⏩", "kind": "early", "value": 5},
    {"slug": "ahead_of_titan", "title": "Duży zapas czasu", "description": "Ukończ 15 questów przed terminem.", "icon": "🏃", "kind": "early", "value": 15},
    {"slug": "deadline_ghost", "title": "Po terminie", "description": "Ukończ 5 questów po terminie.", "icon": "⌛", "kind": "late", "value": 5},
    {"slug": "colossal_delay", "title": "Trudne powroty", "description": "Ukończ 15 questów po terminie.", "icon": "🔁", "kind": "late", "value": 15},
    {"slug": "easy_does_it", "title": "Lekkie zadania", "description": "Ukończ 20 łatwych questów.", "icon": "🌱", "kind": "easy", "value": 20},
    {"slug": "medium_rare", "title": "Średni poziom", "description": "Ukończ 15 średnich questów.", "icon": "🔥", "kind": "medium", "value": 15},
    {"slug": "hard_mode", "title": "Trudna seria", "description": "Ukończ 10 trudnych questów.", "icon": "💀", "kind": "hard", "value": 10},
    {"slug": "female_titan_run", "title": "Miecz Sprawiedliwości", "description": "Ukończ 5 trudnych questów.", "icon": "⚔️", "kind": "hard", "value": 5},
    {"slug": "streak_three", "title": "Trzy dni z rzędu", "description": "Seria 3 dni.", "icon": "🔥", "kind": "streak", "value": 3},
    {"slug": "streak_week", "title": "Tydzień serii", "description": "Seria 7 dni.", "icon": "🧱", "kind": "streak", "value": 7},
    {"slug": "streak_month", "title": "Miesiąc serii", "description": "Seria 30 dni.", "icon": "💪", "kind": "streak", "value": 30},
    {"slug": "exp_scout", "title": "250 EXP", "description": "Zdobądź 250 EXP.", "icon": "📈", "kind": "exp", "value": 250},
    {"slug": "exp_commander", "title": "1000 EXP", "description": "Zdobądź 1000 EXP.", "icon": "🎖️", "kind": "exp", "value": 1000},
    {"slug": "exp_founding", "title": "3000 EXP", "description": "Zdobądź 3000 EXP.", "icon": "👑", "kind": "exp", "value": 3000},
    {"slug": "exp_paths", "title": "6000 EXP", "description": "Zdobądź 6000 EXP.", "icon": "💫", "kind": "exp", "value": 6000},
    {"slug": "studia_hero", "title": "Ogarnianie studiów", "description": "Ukończ 10 questów Studia.", "icon": "📚", "kind": "cat_studia", "value": 10},
    {"slug": "work_shift", "title": "Sprawy z pracy", "description": "Ukończ 10 questów Praca.", "icon": "💼", "kind": "cat_praca", "value": 10},
    {"slug": "home_front", "title": "Dom ogarnięty", "description": "Ukończ 10 questów Dom.", "icon": "🏠", "kind": "cat_dom", "value": 10},
    {"slug": "sports_day", "title": "Ruch w planie", "description": "Ukończ 10 questów Sport.", "icon": "⚽", "kind": "cat_sport", "value": 10},
    {"slug": "project_titan", "title": "Projekt do przodu", "description": "Ukończ 10 questów Projekt.", "icon": "🛠️", "kind": "cat_projekt", "value": 10},
    {"slug": "potato_quest", "title": "Zrobione od razu", "description": "Ukończ quest w dniu dodania.", "icon": "⚡", "kind": "same_day", "value": 1},
    {"slug": "levi_clean", "title": "Czysty dzień", "description": "Ukończ wszystkie questy na dany dzień (min. 3).", "icon": "🧹", "kind": "perfect_day", "value": 1},
    {"slug": "omni_plan", "title": "Dobry plan", "description": "Dodaj 20 questów do listy.", "icon": "📝", "kind": "created", "value": 20},
    {"slug": "star_contract", "title": "Na czas", "description": "Ukończ 30 questów na czas.", "icon": "⭐", "kind": "ontime", "value": 30},
    {"slug": "seven_sealed", "title": "Siedem bonusów", "description": "Odbierz 7 bonusów za wyzwania dzienne.", "icon": "7️⃣", "kind": "daily_bonus", "value": 7},
    {"slug": "rumbling_list", "title": "Pełna lista", "description": "Miej 50 aktywnych questów naraz.", "icon": "🌊", "kind": "active_tasks", "value": 50},
    {"slug": "invincible_grind", "title": "Dwieście zadań", "description": "Ukończ 200 questów.", "icon": "💥", "kind": "tasks", "value": 200},
    {"slug": "boys_mission", "title": "Trudny tydzień", "description": "Ukończ 5 trudnych w tygodniu.", "icon": "🧪", "kind": "hard_week", "value": 5},
    {"slug": "jedi_patience", "title": "Cierpliwość", "description": "Seria 14 dni.", "icon": "🕰️", "kind": "streak", "value": 14},
    {"slug": "ackerman_focus", "title": "Pełne skupienie", "description": "Zdobądź 5000 EXP.", "icon": "🎯", "kind": "exp", "value": 5000},
]

ACHIEVEMENT_BY_SLUG = {a["slug"]: a for a in ACHIEVEMENT_DEFS}


def gather_user_stats(user, db, models) -> dict:
    from datetime import date, timedelta

    reset_at = getattr(user, "progress_reset_at", None)
    exp_floor = getattr(user, "exp_at_progress_reset", 0) or 0
    task_query = db.query(models.Task).filter(models.Task.owner_id == user.id)
    if reset_at:
        task_query = task_query.filter(
            ((models.Task.completed_at != None) & (models.Task.completed_at >= reset_at)) |
            ((models.Task.completed == False) & (models.Task.created_at >= reset_at))
        )
    tasks = task_query.all()
    completed = [t for t in tasks if t.completed and t.completed_at and t.exp_awarded]
    active = [t for t in tasks if not t.completed]

    early = late = ontime = 0
    cat_counts: dict[str, int] = {}
    easy = medium = hard = 0
    same_day = 0
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    hard_this_week = 0

    for t in completed:
        if t.difficulty == "easy":
            easy += 1
        elif t.difficulty == "medium":
            medium += 1
        else:
            hard += 1
        cat_counts[t.category] = cat_counts.get(t.category, 0) + 1

        done_day = t.completed_at.date() if t.completed_at else None
        if done_day and t.due_date:
            if done_day < t.due_date:
                early += 1
            elif done_day > t.due_date:
                late += 1
            else:
                ontime += 1
        # same_day: task must have been created on the SAME calendar date it was completed.
        # Both timestamps are stored as UTC, so .date() comparison is consistent.
        # Extra guard: created_at must not be later than completed_at (sanity check).
        if (
            t.created_at
            and done_day
            and t.created_at <= t.completed_at  # sanity: not created after completion
            and t.created_at.date() == done_day  # created and completed on same UTC date
        ):
            same_day += 1
        if t.difficulty == "hard" and done_day and done_day >= week_start:
            hard_this_week += 1

    # perfect days
    by_date: dict = {}
    for t in tasks:
        ds = str(t.due_date)
        if ds not in by_date:
            by_date[ds] = {"total": 0, "done": 0}
        by_date[ds]["total"] += 1
        if t.completed:
            by_date[ds]["done"] += 1
    perfect_days = sum(1 for v in by_date.values() if v["total"] >= 3 and v["done"] == v["total"])

    daily_bonus_query = db.query(models.DailyQuestAssignment).filter(
        models.DailyQuestAssignment.user_id == user.id,
        models.DailyQuestAssignment.bonus_claimed == True,
    )
    if reset_at:
        daily_bonus_query = daily_bonus_query.filter(models.DailyQuestAssignment.quest_date >= reset_at.date())
    daily_bonus_count = daily_bonus_query.count()

    return {
        "completed_tasks": len(completed),
        "active_tasks": len(active),
        "streak": user.streak or 0,
        "exp": max(0, (user.exp or 0) - exp_floor),
        "early": early,
        "late": late,
        "ontime": ontime,
        "easy": easy,
        "medium": medium,
        "hard": hard,
        "cat_studia": cat_counts.get("Studia", 0),
        "cat_praca": cat_counts.get("Praca", 0),
        "cat_dom": cat_counts.get("Dom", 0),
        "cat_sport": cat_counts.get("Sport", 0),
        "cat_projekt": cat_counts.get("Projekt", 0),
        "same_day": same_day,
        "perfect_days": perfect_days,
        "created_tasks": len(tasks),
        "daily_bonus": daily_bonus_count,
        "hard_week": hard_this_week,
    }


def _stat_value(stats: dict, kind: str) -> int:
    mapping = {
        "tasks": "completed_tasks",
        "early": "early",
        "late": "late",
        "ontime": "ontime",
        "easy": "easy",
        "medium": "medium",
        "hard": "hard",
        "streak": "streak",
        "exp": "exp",
        "cat_studia": "cat_studia",
        "cat_praca": "cat_praca",
        "cat_dom": "cat_dom",
        "cat_sport": "cat_sport",
        "cat_projekt": "cat_projekt",
        "same_day": "same_day",
        "perfect_day": "perfect_days",
        "created": "created_tasks",
        "daily_bonus": "daily_bonus",
        "active_tasks": "active_tasks",
        "hard_week": "hard_week",
    }
    return stats.get(mapping.get(kind, kind), 0)


def achievement_met(stats: dict, ach: dict) -> bool:
    return _stat_value(stats, ach["kind"]) >= ach["value"]


def achievement_progress_text(stats: dict, ach: dict) -> str:
    current = _stat_value(stats, ach["kind"])
    target = ach["value"]
    return f"{min(current, target)}/{target}"


def get_next_achievement(stats: dict, unlocked_slugs: set) -> dict | None:
    for ach in ACHIEVEMENT_DEFS:
        if ach["slug"] in unlocked_slugs:
            continue
        if achievement_met(stats, ach):
            continue
        return {
            "slug": ach["slug"],
            "title": ach["title"],
            "description": ach["description"],
            "icon": ach["icon"],
            "progress": achievement_progress_text(stats, ach),
            "current": _stat_value(stats, ach["kind"]),
            "target": ach["value"],
        }
    return None


# === RARE DROPS ===
RARE_DROPS: list[dict] = [
    # Common (15%)
    {"slug": "bronze_coin", "name": "Moneta Regularności", "description": "Daje mały znak za codzienne wracanie do zadań.", "icon": "🪙", "rarity": "common", "drop_chance": 15},
    {"slug": "crystal_shard", "name": "Kryształ Skupienia", "description": "Przypomina o domykaniu rozpoczętych spraw.", "icon": "💎", "rarity": "common", "drop_chance": 15},
    {"slug": "scroll_fragment", "name": "Zwój Planu", "description": "Pomaga trzymać porządek w kolejnych zadaniach.", "icon": "📜", "rarity": "common", "drop_chance": 15},

    # Rare (8%)
    {"slug": "silver_coin", "name": "Pierścień Mocy", "description": "Wzmacnia motywację do trudniejszych questów.", "icon": "💍", "rarity": "rare", "drop_chance": 8},
    {"slug": "magic_essence", "name": "Amulet Przyspieszenia", "description": "Dodaje energii do szybszego zamykania zadań.", "icon": "✨", "rarity": "rare", "drop_chance": 8},
    {"slug": "enchanted_feather", "name": "Pióro Pomysłów", "description": "Przypomina, że dobry pomysł warto zapisać od razu.", "icon": "🪶", "rarity": "rare", "drop_chance": 8},
    {"slug": "ancient_tome", "name": "Księga Mądrości", "description": "Wspiera planowanie i naukę na spokojnie.", "icon": "📖", "rarity": "rare", "drop_chance": 8},

    # Epic (3%)
    {"slug": "gold_coin", "name": "Tarcza Nieustępliwości", "description": "Symbol trzymania rytmu mimo cięższego dnia.", "icon": "🛡️", "rarity": "epic", "drop_chance": 3},
    {"slug": "titan_mark", "name": "Miecz Sprawiedliwości", "description": "Nagroda za domykanie trudnych i ważnych spraw.", "icon": "⚔️", "rarity": "epic", "drop_chance": 3},
    {"slug": "warrior_crest", "name": "Hełm Mądrości", "description": "Pomaga pamiętać, że plan jest częścią działania.", "icon": "🪖", "rarity": "epic", "drop_chance": 3},
    {"slug": "phoenix_feather", "name": "Płomień Nowego Startu", "description": "Przypomina, że zawsze można wrócić do rytmu.", "icon": "🔥", "rarity": "epic", "drop_chance": 3},

    # Legendary (0.5%)
    {"slug": "founding_titan_core", "name": "Korona Konsekwencji", "description": "Legendarna znajdźka za wyjątkowo mocną serię.", "icon": "👑", "rarity": "legendary", "drop_chance": 0.5},
    {"slug": "infinity_stone", "name": "Kamień Skupienia", "description": "Rzadki symbol pełnej koncentracji na celu.", "icon": "💜", "rarity": "legendary", "drop_chance": 0.5},
]

RARE_DROP_BY_SLUG = {rd["slug"]: rd for rd in RARE_DROPS}


# === EXCLUSIVE ACHIEVEMENTS ===
EXCLUSIVE_ACHIEVEMENTS: list[dict] = [
    {
        "slug": "founding_titan", 
        "title": "Dzień Mocy", 
        "description": "Zdobądź 100+ EXP w jeden dzień.", 
        "icon": "👑",
        "type": "daily_exp_milestone",
        "value": 100
    },
    {
        "slug": "speedrunner", 
        "title": "Poranny Sprint", 
        "description": "Ukończ 5 questów przed 10:00.", 
        "icon": "⚡",
        "type": "morning_quests",
        "value": 5
    },
    {
        "slug": "night_owl", 
        "title": "Wieczorna Zmiana", 
        "description": "Ukończ 3 questy po 22:00.", 
        "icon": "🌙",
        "type": "night_quests",
        "value": 3
    },
    {
        "slug": "collector_tier_1", 
        "title": "Kolekcjoner Znajdziek I", 
        "description": "Zbierz 5 znajdziek.", 
        "icon": "🎁",
        "type": "rare_drop_count",
        "value": 5
    },
    {
        "slug": "collector_tier_2", 
        "title": "Kolekcjoner Znajdziek II", 
        "description": "Zbierz 15 znajdziek.", 
        "icon": "🎁🎁",
        "type": "rare_drop_count",
        "value": 15
    },
    {
        "slug": "collector_tier_3", 
        "title": "Kolekcjoner Znajdziek III", 
        "description": "Zbierz 30 znajdziek.", 
        "icon": "🎁🎁🎁",
        "type": "rare_drop_count",
        "value": 30
    },
    {
        "slug": "epic_collector", 
        "title": "Łowca Epickich Znajdziek", 
        "description": "Zbierz 5 epickich znajdziek.", 
        "icon": "💎",
        "type": "epic_rare_drops",
        "value": 5
    },
    {
        "slug": "legendary_hunter", 
        "title": "Legendarna Znajdźka", 
        "description": "Zbierz 1 legendarną znajdźkę.", 
        "icon": "🌟",
        "type": "legendary_rare_drops",
        "value": 1
    },
    {
        "slug": "week_warrior", 
        "title": "Mocny Tydzień", 
        "description": "Ukończ 20+ questów w tygodniu.", 
        "icon": "💪",
        "type": "weekly_completion",
        "value": 20
    },
    {
        "slug": "balanced_life", 
        "title": "Równy Balans", 
        "description": "Ukończ questy z 5+ kategorii w jeden dzień.", 
        "icon": "⚖️",
        "type": "category_diversity",
        "value": 5
    },
    {
        "slug": "iron_will", 
        "title": "Żelazna Seria", 
        "description": "Seria 50 dni.", 
        "icon": "🔗",
        "type": "streak_milestone",
        "value": 50
    },
    {
        "slug": "legend_500", 
        "title": "Legenda Listy", 
        "description": "Ukończ 500 questów.", 
        "icon": "🏅",
        "type": "total_completion",
        "value": 500
    },
    {
        "slug": "time_master", 
        "title": "Mistrz Terminów", 
        "description": "Ukończ 50 questów dokładnie na czas.", 
        "icon": "⏰",
        "type": "ontime_perfection",
        "value": 50
    },
    {
        "slug": "all_rounder", 
        "title": "Wszechstronność", 
        "description": "Ukończ po 25 łatwych, średnich i trudnych questów.", 
        "icon": "🎯",
        "type": "difficulty_balance",
        "value": 25
    },
]

EXCLUSIVE_ACHIEVEMENT_BY_SLUG = {ea["slug"]: ea for ea in EXCLUSIVE_ACHIEVEMENTS}


def check_exclusive_achievements(user, db, models) -> list[dict]:
    """Sprawdza i odblokowuje nowe exclusive achievements."""
    from datetime import datetime, timedelta, date, time
    
    reset_at = getattr(user, "progress_reset_at", None)
    stats = gather_user_stats(user, db, models)
    unlocked_slugs = {
        ua.exclusive_achievement.slug 
        for ua in db.query(models.PlayerExclusiveAchievement).filter(
            models.PlayerExclusiveAchievement.user_id == user.id
        ).all()
    }
    
    newly_unlocked = []
    
    for ea_def in EXCLUSIVE_ACHIEVEMENTS:
        if ea_def["slug"] in unlocked_slugs:
            continue
        
        ea_type = ea_def["type"]
        value = ea_def["value"]
        met = False
        
        if ea_type == "daily_exp_milestone":
            today = date.today()
            today_tasks = db.query(models.Task).filter(
                models.Task.owner_id == user.id,
                models.Task.completed == True,
                models.Task.exp_awarded == True,
            ).all()
            today_exp = sum(
                t.exp_awarded_amount for t in today_tasks
                if t.completed_at and t.completed_at.date() == today and (not reset_at or t.completed_at >= reset_at)
            )
            met = today_exp >= value
        
        elif ea_type == "morning_quests":
            today = date.today()
            morning_quests = 0
            for t in db.query(models.Task).filter(
                models.Task.owner_id == user.id,
                models.Task.completed == True,
            ).all():
                if t.completed_at and t.completed_at.date() == today and (not reset_at or t.completed_at >= reset_at):
                    if t.completed_at.time() < time(10, 0):
                        morning_quests += 1
            met = morning_quests >= value
        
        elif ea_type == "night_quests":
            today = date.today()
            night_quests = 0
            for t in db.query(models.Task).filter(
                models.Task.owner_id == user.id,
                models.Task.completed == True,
            ).all():
                if t.completed_at and t.completed_at.date() == today and (not reset_at or t.completed_at >= reset_at):
                    if t.completed_at.time() >= time(22, 0):
                        night_quests += 1
            met = night_quests >= value
        
        elif ea_type == "rare_drop_count":
            drop_query = db.query(models.PlayerRareDrop).filter(
                models.PlayerRareDrop.user_id == user.id,
            )
            if reset_at:
                drop_query = drop_query.filter(models.PlayerRareDrop.obtained_at >= reset_at)
            count = drop_query.count()
            met = count >= value
        
        elif ea_type == "epic_rare_drops":
            drop_query = db.query(models.PlayerRareDrop).join(models.RareDrop).filter(
                models.PlayerRareDrop.user_id == user.id,
                models.RareDrop.rarity == "epic",
            )
            if reset_at:
                drop_query = drop_query.filter(models.PlayerRareDrop.obtained_at >= reset_at)
            count = drop_query.count()
            met = count >= value
        
        elif ea_type == "legendary_rare_drops":
            drop_query = db.query(models.PlayerRareDrop).join(models.RareDrop).filter(
                models.PlayerRareDrop.user_id == user.id,
                models.RareDrop.rarity == "legendary",
            )
            if reset_at:
                drop_query = drop_query.filter(models.PlayerRareDrop.obtained_at >= reset_at)
            count = drop_query.count()
            met = count >= value
        
        elif ea_type == "weekly_completion":
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            week_query = db.query(models.Task).filter(
                models.Task.owner_id == user.id,
                models.Task.completed == True,
                models.Task.completed_at >= datetime.combine(week_start, time.min),
            )
            if reset_at:
                week_query = week_query.filter(models.Task.completed_at >= reset_at)
            week_completed = week_query.count()
            met = week_completed >= value
        
        elif ea_type == "category_diversity":
            today = date.today()
            categories = set()
            for t in db.query(models.Task).filter(
                models.Task.owner_id == user.id,
                models.Task.completed == True,
            ).all():
                if t.completed_at and t.completed_at.date() == today and (not reset_at or t.completed_at >= reset_at):
                    categories.add(t.category)
            met = len(categories) >= value
        
        elif ea_type == "streak_milestone":
            met = user.streak >= value
        
        elif ea_type == "total_completion":
            met = stats["completed_tasks"] >= value
        
        elif ea_type == "ontime_perfection":
            met = stats["ontime"] >= value
        
        elif ea_type == "difficulty_balance":
            met = (stats["easy"] >= value and stats["medium"] >= value and stats["hard"] >= value)
        
        if met:
            ach = db.query(models.ExclusiveAchievement).filter(
                models.ExclusiveAchievement.slug == ea_def["slug"]
            ).first()
            if not ach:
                ach = models.ExclusiveAchievement(
                    slug=ea_def["slug"],
                    title=ea_def["title"],
                    description=ea_def["description"],
                    icon=ea_def["icon"],
                    requirement_type=ea_def["type"]
                )
                db.add(ach)
                db.flush()
            else:
                ach.title = ea_def["title"]
                ach.description = ea_def["description"]
                ach.icon = ea_def["icon"]
                ach.requirement_type = ea_def["type"]
            
            player_ach = db.query(models.PlayerExclusiveAchievement).filter(
                models.PlayerExclusiveAchievement.user_id == user.id,
                models.PlayerExclusiveAchievement.exclusive_achievement_id == ach.id
            ).first()
            if not player_ach:
                player_ach = models.PlayerExclusiveAchievement(
                    user_id=user.id,
                    exclusive_achievement_id=ach.id
                )
                db.add(player_ach)
                newly_unlocked.append(ea_def)
    
    if newly_unlocked:
        db.commit()
    
    return newly_unlocked
