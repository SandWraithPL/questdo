import random
from datetime import date
from typing import Any

DAILY_QUEST_POOL: list[dict[str, Any]] = [
    {"id": "c1", "icon": "✅", "label": "Jeden krok", "description": "Ukończ 1 zadanie", "type": "complete_count", "target": 1},
    {"id": "c2", "icon": "⚔️", "label": "Podwójny wysiłek", "description": "Ukończ 2 zadania", "type": "complete_count", "target": 2},
    {"id": "c3", "icon": "🗡️", "label": "Trzy przed zmierzchem", "description": "Ukończ 3 zadania", "type": "complete_count", "target": 3},
    {"id": "c4", "icon": "🏹", "label": "Cztery misje", "description": "Ukończ 4 zadania", "type": "complete_count", "target": 4},
    {"id": "c5", "icon": "🏆", "label": "Pięć na liście", "description": "Ukończ 5 zadań", "type": "complete_count", "target": 5},
    {"id": "c6", "icon": "🌊", "label": "Sześć do celu", "description": "Ukończ 6 zadań", "type": "complete_count", "target": 6},
    {"id": "c8", "icon": "⚙️", "label": "Osiem jak w harmonogramie", "description": "Ukończ 8 zadań", "type": "complete_count", "target": 8},
    {"id": "hard1", "icon": "💀", "label": "Pojedynek z trudnym", "description": "Ukończ 1 trudne zadanie", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "hard2", "icon": "☠️", "label": "Dwa wyzwania", "description": "Ukończ 2 trudne zadania", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "hard3", "icon": "👹", "label": "Trzy ciężkie", "description": "Ukończ 3 trudne zadania", "type": "complete_difficulty", "difficulty": "hard", "target": 3},
    {"id": "med1", "icon": "🔥", "label": "Średnie tempo", "description": "Ukończ 1 średnie zadanie", "type": "complete_difficulty", "difficulty": "medium", "target": 1},
    {"id": "med2", "icon": "⚡", "label": "Dwa średnie", "description": "Ukończ 2 średnie zadania", "type": "complete_difficulty", "difficulty": "medium", "target": 2},
    {"id": "med3", "icon": "🎯", "label": "Trzy w szyku", "description": "Ukończ 3 średnie zadania", "type": "complete_difficulty", "difficulty": "medium", "target": 3},
    {"id": "easy2", "icon": "🌱", "label": "Łatwa para", "description": "Ukończ 2 łatwe zadania", "type": "complete_difficulty", "difficulty": "easy", "target": 2},
    {"id": "easy4", "icon": "🍃", "label": "Cztery lekkie", "description": "Ukończ 4 łatwe zadania", "type": "complete_difficulty", "difficulty": "easy", "target": 4},
    {"id": "boss", "icon": "🎯", "label": "Poważniejszy krok", "description": "Ukończ 1 średnie lub trudne zadanie", "type": "complete_difficulty_any", "target": 1},
    {"id": "studia", "icon": "📚", "label": "Nauka w bibliotece", "description": "Ukończ 1 zadanie ze Studiów", "type": "complete_category", "category": "Studia", "target": 1},
    {"id": "nauka", "icon": "📖", "label": "Nowa wiedza", "description": "Ukończ 1 zadanie z Nauki", "type": "complete_category", "category": "Nauka", "target": 1},
    {"id": "praca", "icon": "💼", "label": "Zmiana w biurze", "description": "Ukończ 1 zadanie z Pracy", "type": "complete_category", "category": "Praca", "target": 1},
    {"id": "dom", "icon": "🏠", "label": "Domowe porządki", "description": "Ukończ 1 zadanie z Domu", "type": "complete_category", "category": "Dom", "target": 1},
    {"id": "sport", "icon": "⚽", "label": "Ruch to zdrowie", "description": "Ukończ 1 zadanie ze Sportu", "type": "complete_category", "category": "Sport", "target": 1},
    {"id": "projekt", "icon": "🛠️", "label": "Projekt do zamknięcia", "description": "Ukończ 1 zadanie z Projektu", "type": "complete_category", "category": "Projekt", "target": 1},
    {"id": "zdrowie", "icon": "💊", "label": "Zdrowy nawyk", "description": "Ukończ 1 zadanie ze Zdrowia", "type": "complete_category", "category": "Zdrowie", "target": 1},
    {"id": "zakupy", "icon": "🛒", "label": "Szybkie zakupy", "description": "Ukończ 1 zadanie z Zakupów", "type": "complete_category", "category": "Zakupy", "target": 1},
    {"id": "inne", "icon": "📦", "label": "Pozostałe sprawy", "description": "Ukończ 1 zadanie z Innych", "type": "complete_category", "category": "Inne", "target": 1},
    {"id": "add1", "icon": "📝", "label": "Nowy wpis", "description": "Dodaj 1 nowe zadanie", "type": "add_tasks", "target": 1},
    {"id": "add2", "icon": "📋", "label": "Dwa plany", "description": "Dodaj 2 nowe zadania", "type": "add_tasks", "target": 2},
    {"id": "add3", "icon": "🗒️", "label": "Trzy zadania", "description": "Dodaj 3 nowe zadania", "type": "add_tasks", "target": 3},
    {"id": "add5", "icon": "📑", "label": "Pięć notatek", "description": "Dodaj 5 nowych zadań", "type": "add_tasks", "target": 5},
    {"id": "all", "icon": "🌟", "label": "Wszystko dziś", "description": "Ukończ wszystkie dzisiejsze zadania", "type": "complete_all"},
    {"id": "streak", "icon": "🔥", "label": "Płomień motywacji", "description": "Utrzymaj serię przynajmniej 1 dzień", "type": "streak_min", "target": 1},
    {"id": "streak3", "icon": "🧱", "label": "Trzy dni z rzędu", "description": "Utrzymaj serię przynajmniej 3 dni", "type": "streak_min", "target": 3},
    {"id": "cats2", "icon": "🎨", "label": "Dwa różne fronty", "description": "Ukończ zadania z 2 różnych kategorii", "type": "complete_categories_distinct", "target": 2},
    {"id": "cats3", "icon": "🎲", "label": "Trzy ścieżki", "description": "Ukończ zadania z 3 różnych kategorii", "type": "complete_categories_distinct", "target": 3},
    {"id": "cats4", "icon": "🗺️", "label": "Cztery rejony", "description": "Ukończ zadania z 4 różnych kategorii", "type": "complete_categories_distinct", "target": 4},
    {"id": "grind", "icon": "⚙️", "label": "Pełna mobilizacja", "description": "Ukończ 7 zadań", "type": "complete_count", "target": 7},
    {"id": "scout_day", "icon": "🔎", "label": "Trudne sprawy", "description": "Ukończ 2 trudne zadania", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "levi_day", "icon": "🧹", "label": "Poranny porządek", "description": "Ukończ 4 łatwe zadania", "type": "complete_difficulty", "difficulty": "easy", "target": 4},
    {"id": "potato", "icon": "✅", "label": "Lekki start", "description": "Ukończ 1 dowolne zadanie", "type": "complete_count", "target": 1},
    {"id": "paths", "icon": "✨", "label": "Trzy średnie kroki", "description": "Ukończ 3 średnie zadania", "type": "complete_difficulty", "difficulty": "medium", "target": 3},
    {"id": "star_patrol", "icon": "⭐", "label": "Dwa zadania", "description": "Ukończ 2 dowolne zadania", "type": "complete_count", "target": 2},
    {"id": "invincible", "icon": "💥", "label": "Nie do zatrzymania", "description": "Ukończ 5 zadań", "type": "complete_count", "target": 5},
    {"id": "corporate", "icon": "💼", "label": "Sprawa z pracy", "description": "Ukończ 1 zadanie z Pracy", "type": "complete_category", "category": "Praca", "target": 1},
    {"id": "padawan", "icon": "📖", "label": "Czas na naukę", "description": "Ukończ 1 zadanie z Nauki", "type": "complete_category", "category": "Nauka", "target": 1},
    {"id": "rumble_prep", "icon": "📋", "label": "Cztery z listy", "description": "Ukończ 4 dowolne zadania", "type": "complete_count", "target": 4},
    {"id": "female_titan", "icon": "⚡", "label": "Szybkie tempo", "description": "Ukończ 2 średnie zadania", "type": "complete_difficulty", "difficulty": "medium", "target": 2},
    {"id": "armored", "icon": "🛡️", "label": "Tarcza wytrwałości", "description": "Ukończ 1 trudne zadanie", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "beast", "icon": "🌱", "label": "Trzy lekkie", "description": "Ukończ 3 łatwe zadania", "type": "complete_difficulty", "difficulty": "easy", "target": 3},
    {"id": "founding", "icon": "👑", "label": "Duży dzień", "description": "Ukończ 6 dowolnych zadań", "type": "complete_count", "target": 6},
    {"id": "omni_morning", "icon": "☀️", "label": "Poranny sprint", "description": "Ukończ 3 dowolne zadania", "type": "complete_count", "target": 3},
    {"id": "seven_contract", "icon": "7️⃣", "label": "Siedem zadań", "description": "Ukończ 7 dowolnych zadań", "type": "complete_count", "target": 7},
    {"id": "ackerman", "icon": "🗡️", "label": "Trudny wybór", "description": "Ukończ 1 trudne zadanie", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "eren_resolve", "icon": "✊", "label": "Pełne domknięcie", "description": "Ukończ wszystkie dzisiejsze zadania", "type": "complete_all"},
    {"id": "mikasa_guard", "icon": "🎀", "label": "Dwie kategorie", "description": "Ukończ zadania z 2 różnych kategorii", "type": "complete_categories_distinct", "target": 2},
    {"id": "armin_plan", "icon": "💡", "label": "Dobry plan", "description": "Dodaj 2 nowe zadania", "type": "add_tasks", "target": 2},
    {"id": "hange_lab", "icon": "🔬", "label": "Projekt do przodu", "description": "Ukończ 1 zadanie z Projektu", "type": "complete_category", "category": "Projekt", "target": 1},
    {"id": "jean_horse", "icon": "🛒", "label": "Zakupy załatwione", "description": "Ukończ 1 zadanie z Zakupów", "type": "complete_category", "category": "Zakupy", "target": 1},
    {"id": "connie_run", "icon": "🏃", "label": "Poranny trucht", "description": "Ukończ 1 zadanie ze Sportu", "type": "complete_category", "category": "Sport", "target": 1},
    {"id": "reiner_wall", "icon": "🏠", "label": "Domowy obowiązek", "description": "Ukończ 1 zadanie z Domu", "type": "complete_category", "category": "Dom", "target": 1},
    {"id": "ymir_trail", "icon": "📚", "label": "Sprawa ze studiów", "description": "Ukończ 1 zadanie ze Studiów", "type": "complete_category", "category": "Studia", "target": 1},
    {"id": "bertholdt_cloud", "icon": "☁️", "label": "Dwa trudne", "description": "Ukończ 2 trudne zadania", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "pieck_cart", "icon": "📦", "label": "Trzy zadania", "description": "Ukończ 3 dowolne zadania", "type": "complete_count", "target": 3},
    {"id": "gabi_rifle", "icon": "🎯", "label": "Celny krok", "description": "Ukończ 1 średnie zadanie", "type": "complete_difficulty", "difficulty": "medium", "target": 1},
    {"id": "falco_wings", "icon": "🍃", "label": "Dwa lekkie", "description": "Ukończ 2 łatwe zadania", "type": "complete_difficulty", "difficulty": "easy", "target": 2},
    {"id": "homelander_smile", "icon": "🙂", "label": "Mały sukces", "description": "Ukończ 1 dowolne zadanie", "type": "complete_count", "target": 1},
    {"id": "butcher_list", "icon": "📌", "label": "Lista priorytetów", "description": "Ukończ 4 dowolne zadania", "type": "complete_count", "target": 4},
    {"id": "vader_breath", "icon": "😤", "label": "Głęboki oddech", "description": "Ukończ 1 trudne zadanie", "type": "complete_difficulty", "difficulty": "hard", "target": 1},
    {"id": "yoda_patience", "icon": "⏳", "label": "Cierpliwość", "description": "Utrzymaj serię przynajmniej 2 dni", "type": "streak_min", "target": 2},
    {"id": "wall_rose", "icon": "🌹", "label": "Trzy kroki", "description": "Ukończ 3 dowolne zadania", "type": "complete_count", "target": 3},
    {"id": "wall_sina", "icon": "🏔️", "label": "Wysoki poziom", "description": "Ukończ 2 trudne zadania", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
    {"id": "wall_maria", "icon": "🏁", "label": "Pięć zadań", "description": "Ukończ 5 dowolnych zadań", "type": "complete_count", "target": 5},
    {"id": "odm_gear", "icon": "🔧", "label": "Sprawne tempo", "description": "Ukończ 2 średnie zadania", "type": "complete_difficulty", "difficulty": "medium", "target": 2},
    {"id": "new_recruit", "icon": "🪖", "label": "Świeży rekrut", "description": "Ukończ 1 zadanie", "type": "complete_count", "target": 1},
    {"id": "veteran_mark", "icon": "⭐", "label": "Dziesięć zadań", "description": "Ukończ 10 dowolnych zadań", "type": "complete_count", "target": 10},
    {"id": "scout_whistle", "icon": "📝", "label": "Nowy plan", "description": "Dodaj 1 nowe zadanie", "type": "add_tasks", "target": 1},
    {"id": "garrison_duty", "icon": "🏠", "label": "Straż przy bramie", "description": "Ukończ 1 zadanie z kategorii Dom", "type": "complete_category", "category": "Dom", "target": 1},
    {"id": "military_police", "icon": "✅", "label": "Spokojny rejon", "description": "Ukończ 2 dowolne zadania", "type": "complete_count", "target": 2},
    {"id": "training_corps", "icon": "🏋️", "label": "Dzień treningowy", "description": "Ukończ 3 łatwe zadania", "type": "complete_difficulty", "difficulty": "easy", "target": 3},
    {"id": "special_ops", "icon": "🎭", "label": "Operacja specjalna", "description": "Ukończ 2 trudne zadania", "type": "complete_difficulty", "difficulty": "hard", "target": 2},
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
        selected_ids = {q["id"] for q in selected}
        for quest in shuffled:
            if quest["id"] not in selected_ids:
                selected.append(quest)
                selected_ids.add(quest["id"])
            if len(selected) >= 3:
                break

    return selected[:3]


def build_day_stats(user, all_tasks, day: date) -> dict:
    today_tasks = [t for t in all_tasks if t.due_date == day]
    completed_on_day = [t for t in all_tasks if t.completed and t.completed_at and t.completed_at.date() == day]
    added_today = [t for t in all_tasks if t.created_at and t.created_at.date() == day]
    done_due_today = [t for t in today_tasks if t.completed]

    return {
        "done_today": len(completed_on_day),
        "done_due_today": len(done_due_today),
        "total_today": len(today_tasks),
        "hard_done": sum(1 for t in completed_on_day if t.difficulty == "hard"),
        "medium_done": sum(1 for t in completed_on_day if t.difficulty == "medium"),
        "easy_done": sum(1 for t in completed_on_day if t.difficulty == "easy"),
        "categories_done": {t.category for t in completed_on_day},
        "added_today": len(added_today),
        "streak": user.streak or 0,
    }


def evaluate_quest(quest: dict, stats: dict) -> dict:
    qtype = quest["type"]
    target = quest.get("target", 1)
    current = 0

    if qtype == "complete_count":
        current = stats["done_today"]
    elif qtype == "complete_difficulty":
        diff = quest["difficulty"]
        current = stats["hard_done"] if diff == "hard" else stats["medium_done"] if diff == "medium" else stats["easy_done"]
    elif qtype == "complete_difficulty_any":
        current = stats["hard_done"] + stats["medium_done"]
    elif qtype == "complete_category":
        current = 1 if quest["category"] in stats["categories_done"] else 0
        target = 1
    elif qtype == "add_tasks":
        current = stats["added_today"]
    elif qtype == "complete_all":
        target = max(stats["total_today"], 1)
        current = stats["done_due_today"]
    elif qtype == "streak_min":
        current = stats["streak"]
    elif qtype == "complete_categories_distinct":
        current = len(stats["categories_done"])

    current = min(current, target) if target > 0 else current
    done = current >= target

    return {
        "id": quest["id"],
        "icon": quest.get("icon", "🎯"),
        "label": quest["label"],
        "description": quest.get("description", ""),
        "target": target,
        "current": current,
        "done": done,
        "type": qtype,
    }


def evaluate_assigned_quests(quest_ids: list[str], stats: dict) -> list[dict]:
    return [evaluate_quest(QUEST_BY_ID[qid], stats) for qid in quest_ids if qid in QUEST_BY_ID]


def all_goals_complete(goals: list[dict]) -> bool:
    return bool(goals) and all(g["done"] for g in goals)
