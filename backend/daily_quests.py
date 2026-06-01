"""Pula wyzwań dziennych — codziennie losowane 3 na użytkownika."""
import random
from datetime import date
from typing import Any

DAILY_QUEST_POOL: list[dict[str, Any]] = [
    # Liczba ukończeń
    {"id": "c1", "icon": "✅", "label": "Jeden krok", "type": "complete_count", "target": 1},
    {"id": "c2", "icon": "⚔️", "label": "Podwójny wysiłek", "type": "complete_count", "target": 2},
    {"id": "c3", "icon": "🗡️", "label": "Trzy przed zmierzchem", "type": "complete_count", "target": 3},
    {"id": "c4", "icon": "🏹", "label": "Cztery misje", "type": "complete_count", "target": 4},
    {"id": "c5", "icon": "🏆", "label": "Pięć na liście", "type": "complete_count", "target": 5},
    {"id": "c6", "icon": "🌊", "label": "Sześć do celu", "type": "complete_count", "target": 6},
    {"id": "c8", "icon": "⚙️", "label": "Osiem jak w harmonogramie", "type": "complete_count", "target": 8},
    
    # Trudność
    {"id": "hard1", "icon": "💀", "label": "Pojedynek z trudnym", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "hard2", "icon": "☠️", "label": "Dwa wyzwania", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "hard3", "icon": "👹", "label": "Trzy ciężkie", "type": "complete_difficulty", "difficulty": "hard", "target": 3},
    {"id": "med1", "icon": "🔥", "label": "Średnie tempo", "type": "complete_difficulty", "difficulty": "medium", "target": 1},
    {"id": "med2", "icon": "⚡", "label": "Dwa średnie", "type": "complete_difficulty", "difficulty": "medium", "target": 2},
    {"id": "med3", "icon": "🎯", "label": "Trzy w szyku", "type": "complete_difficulty", "difficulty": "medium", "target": 3},
    {"id": "easy2", "icon": "🌱", "label": "Łatwa para", "type": "complete_difficulty", "difficulty": "easy", "target": 2},
    {"id": "easy4", "icon": "🍃", "label": "Cztery lekkie", "type": "complete_difficulty", "difficulty": "easy", "target": 4},
    {"id": "boss", "icon": "🦸", "label": "Wyzwanie średnie/l trudne", "type": "complete_difficulty_any", "target": 1},
    
    # Kategorie
    {"id": "studia", "icon": "📚", "label": "Nauka w bibliotece", "type": "complete_category", "category": "Studia", "target": 1},
    {"id": "nauka", "icon": "📖", "label": "Nowa wiedza", "type": "complete_category", "category": "Nauka", "target": 1},
    {"id": "praca", "icon": "💼", "label": "Zmiana w biurze", "type": "complete_category", "category": "Praca", "target": 1},
    {"id": "dom", "icon": "🏠", "label": "Domowe porządki", "type": "complete_category", "category": "Dom", "target": 1},
    {"id": "sport", "icon": "⚽", "label": "Ruch to zdrowie", "type": "complete_category", "category": "Sport", "target": 1},
    {"id": "projekt", "icon": "🛠️", "label": "Projekt do zamknięcia", "type": "complete_category", "category": "Projekt", "target": 1},
    {"id": "zdrowie", "icon": "💊", "label": "Zdrowy nawyk", "type": "complete_category", "category": "Zdrowie", "target": 1},
    {"id": "zakupy", "icon": "🛒", "label": "Szybkie zakupy", "type": "complete_category", "category": "Zakupy", "target": 1},
    {"id": "inne", "icon": "📦", "label": "Pozostałe sprawy", "type": "complete_category", "category": "Inne", "target": 1},
    
    # Planowanie
    {"id": "add1", "icon": "📝", "label": "Nowy wpis", "type": "add_tasks", "target": 1},
    {"id": "add2", "icon": "📋", "label": "Dwa plany", "type": "add_tasks", "target": 2},
    {"id": "add3", "icon": "🗒️", "label": "Trzy zadania", "type": "add_tasks", "target": 3},
    {"id": "add5", "icon": "📑", "label": "Pięć notatek", "type": "add_tasks", "target": 5},
    
    # Specjalne
    {"id": "all", "icon": "🌟", "label": "Wszystko dziś", "type": "complete_all"},
    {"id": "streak", "icon": "🔥", "label": "Płomień motywacji", "type": "streak_min", "target": 1},
    {"id": "streak3", "icon": "🧱", "label": "Trzy dni z rzędu", "type": "streak_min", "target": 3},
    {"id": "cats2", "icon": "🎨", "label": "Dwa różne fronty", "type": "complete_categories_distinct", "target": 2},
    {"id": "cats3", "icon": "🎲", "label": "Trzy ścieżki", "type": "complete_categories_distinct", "target": 3},
    {"id": "cats4", "icon": "🗺️", "label": "Cztery rejony", "type": "complete_categories_distinct", "target": 4},
    {"id": "grind", "icon": "⚙️", "label": "Pełna mobilizacja", "type": "complete_count", "target": 7},
    {"id": "scout_day", "icon": "🦅", "label": "Zwiad przed wyprawą", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "levi_day", "icon": "🧹", "label": "Poranny porządek", "type": "complete_difficulty", "difficulty": "easy", "target": 4},
    {"id": "potato", "icon": "🥔", "label": "Dzień odpoczynku", "type": "complete_count", "target": 1},
    {"id": "paths", "icon": "✨", "label": "Trzy ścieżki", "type": "complete_difficulty", "difficulty": "medium", "target": 3},
    {"id": "star_patrol", "icon": "⭐", "label": "Nocny patrol", "type": "complete_count", "target": 2},
    {"id": "invincible", "icon": "💥", "label": "Nie do zatrzymania", "type": "complete_count", "target": 5},
    {"id": "corporate", "icon": "🧪", "label": "Korporacyjny briefing", "type": "complete_category", "category": "Praca", "target": 1},
    {"id": "padawan", "icon": "🌌", "label": "Trening ucznia", "type": "complete_category", "category": "Nauka", "target": 1},
    {"id": "rumble_prep", "icon": "🌊", "label": "Przed burzą", "type": "complete_count", "target": 4},
    {"id": "female_titan", "icon": "💃", "label": "Szybki cios", "type": "complete_difficulty", "difficulty": "medium", "target": 2},
    {"id": "armored", "icon": "🛡️", "label": "Pancerz ochronny", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "beast", "icon": "🦍", "label": "Bestia w terenie", "type": "complete_difficulty", "difficulty": "easy", "target": 3},
    {"id": "founding", "icon": "👑", "label": "Fundator listy", "type": "complete_count", "target": 6},
    {"id": "omni_morning", "icon": "🦸", "label": "Poranny sprint", "type": "complete_count", "target": 3},
    {"id": "seven_contract", "icon": "7️⃣", "label": "Kontrakt siódemki", "type": "complete_count", "target": 7},
    {"id": "ackerman", "icon": "🗡️", "label": "Ostry wzrok", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "eren_resolve", "icon": "✊", "label": "Postanowienie", "type": "complete_all"},
    {"id": "mikasa_guard", "icon": "🎀", "label": "Bliska obrona", "type": "complete_categories_distinct", "target": 2},
    {"id": "armin_plan", "icon": "💡", "label": "Taktyczna przerwa", "type": "add_tasks", "target": 2},
    {"id": "hange_lab", "icon": "🔬", "label": "Laboratoryjna chwila", "type": "complete_category", "category": "Projekt", "target": 1},
    {"id": "jean_horse", "icon": "🐴", "label": "Szybka dostawa", "type": "complete_category", "category": "Zakupy", "target": 1},
    {"id": "connie_run", "icon": "🏃", "label": "Poranny trucht", "type": "complete_category", "category": "Sport", "target": 1},
    {"id": "reiner_wall", "icon": "🧱", "label": "Nocny dyżur", "type": "complete_category", "category": "Dom", "target": 1},
    {"id": "ymir_trail", "icon": "🌲", "label": "Stary szlak", "type": "complete_category", "category": "Studia", "target": 1},
    {"id": "bertholdt_cloud", "icon": "☁️", "label": "Ciężki dzień", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "pieck_cart", "icon": "🛒", "label": "Transport specjalny", "type": "complete_count", "target": 3},
    {"id": "gabi_rifle", "icon": "🎯", "label": "Precyzyjny strzał", "type": "complete_difficulty", "difficulty": "medium", "target": 1},
    {"id": "falco_wings", "icon": "🕊️", "label": "Szybki przelot", "type": "complete_difficulty", "difficulty": "easy", "target": 2},
    {"id": "homelander_smile", "icon": "😇", "label": "Uśmiech dnia", "type": "complete_count", "target": 1},
    {"id": "butcher_list", "icon": "🔪", "label": "Lista priorytetów", "type": "complete_count", "target": 4},
    {"id": "vader_breath", "icon": "😤", "label": "Głęboki oddech", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "yoda_patience", "icon": "🐸", "label": "Cierpliwość mistrza", "type": "streak_min", "target": 2},
    {"id": "wall_rose", "icon": "🌹", "label": "Wewnętrzny krąg", "type": "complete_count", "target": 3},
    {"id": "wall_sina", "icon": "🏔️", "label": "Najwyższy poziom", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "wall_maria", "icon": "🏰", "label": "Powrót do korzeni", "type": "complete_count", "target": 5},
    {"id": "odm_gear", "icon": "🔧", "label": "Manewr sprawności", "type": "complete_difficulty", "difficulty": "medium", "target": 2},
    {"id": "new_recruit", "icon": "🪖", "label": "Świeży rekrut", "type": "complete_count", "target": 1},
    {"id": "veteran_mark", "icon": "⭐", "label": "Weteran z blizną", "type": "complete_count", "target": 10},
    {"id": "scout_whistle", "icon": "🪈", "label": "Sygnał zwiadu", "type": "add_tasks", "target": 1},
    {"id": "garrison_duty", "icon": "🏯", "label": "Straż przy bramie", "type": "complete_category", "category": "Dom", "target": 1},
    {"id": "military_police", "icon": "👮", "label": "Spokojny rejon", "type": "complete_count", "target": 2},
    {"id": "training_corps", "icon": "🏋️", "label": "Dzień treningowy", "type": "complete_difficulty", "difficulty": "easy", "target": 3},
    {"id": "special_ops", "icon": "🎭", "label": "Operacja specjalna", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
]

QUEST_BY_ID = {q["id"]: q for q in DAILY_QUEST_POOL}

TRIPLE_BONUS_EXP = 35


def pick_three_quests(user_id: int, day: date) -> list[dict]:
    rng = random.Random(f"{user_id}-{day.isoformat()}-questdo-v3")
    shuffled = DAILY_QUEST_POOL.copy()
    rng.shuffle(shuffled)

    selected: list[dict] = []
    types_seen: set[str] = set()

    for quest in shuffled:
        if len(selected) >= 3:
            break
        qtype = quest["type"]
        if qtype in types_seen and len(selected) < 2:
            continue
        selected.append(quest)
        types_seen.add(qtype)

    if len(selected) < 3:
        for quest in shuffled:
            if quest["id"] not in {q["id"] for q in selected}:
                selected.append(quest)
            if len(selected) >= 3:
                break

    return selected[:3]


def build_day_stats(user, all_tasks, day: date) -> dict:
    today_tasks = [t for t in all_tasks if t.due_date == day]
    done = [t for t in today_tasks if t.completed]
    added_today = [
        t for t in all_tasks
        if t.created_at and t.created_at.date() == day
    ]

    return {
        "done_today": len(done),
        "total_today": len(today_tasks),
        "hard_done": sum(1 for t in done if t.difficulty == "hard"),
        "medium_done": sum(1 for t in done if t.difficulty == "medium"),
        "easy_done": sum(1 for t in done if t.difficulty == "easy"),
        "categories_done": {t.category for t in done},
        "added_today": len(added_today),
        "streak": user.streak or 0,
    }


def evaluate_quest(quest: dict, stats: dict) -> dict:
    qtype = quest["type"]
    target = quest.get("target", 1)
    current = 0

    if qtype == "complete_count":
        current = stats["done_today"]
        target = quest["target"]
    elif qtype == "complete_difficulty":
        diff = quest["difficulty"]
        if diff == "hard":
            current = stats["hard_done"]
        elif diff == "medium":
            current = stats["medium_done"]
        else:
            current = stats["easy_done"]
        target = quest["target"]
    elif qtype == "complete_difficulty_any":
        current = stats["hard_done"] + stats["medium_done"]
        target = quest.get("target", 1)
    elif qtype == "complete_category":
        cat = quest["category"]
        current = 1 if cat in stats["categories_done"] else 0
        target = 1
    elif qtype == "add_tasks":
        current = stats["added_today"]
        target = quest["target"]
    elif qtype == "complete_all":
        target = max(stats["total_today"], 1)
        current = stats["done_today"]
    elif qtype == "streak_min":
        current = stats["streak"]
        target = quest.get("target", 1)
    elif qtype == "complete_categories_distinct":
        current = len(stats["categories_done"])
        target = quest["target"]

    current = min(current, target) if target > 0 else current
    done = current >= target

    return {
        "id": quest["id"],
        "icon": quest.get("icon", "🎯"),
        "label": quest["label"],
        "target": target,
        "current": current,
        "done": done,
        "type": qtype,
    }


def evaluate_assigned_quests(quest_ids: list[str], stats: dict) -> list[dict]:
    goals = []
    for qid in quest_ids:
        quest = QUEST_BY_ID.get(qid)
        if quest:
            goals.append(evaluate_quest(quest, stats))
    return goals


def all_goals_complete(goals: list[dict]) -> bool:
    return bool(goals) and all(g["done"] for g in goals)