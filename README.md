# ⚔️ QuestDo - Gamifikowana lista zadań

**🌐 Działająca aplikacja:** [https://questdo-frontend.onrender.com/](https://questdo-frontend.onrender.com/)

QuestDo to aplikacja do zarządzania zadaniami w stylu RPG. Ukończaj questy, zdobywaj EXP, odblokowuj osiągnięcia i rywalizuj w rankingach!

## ✨ Funkcje

### 📅 Kalendarz zadań
- Widoki: dzień, tydzień, miesiąc
- Przeciąganie zadań między dniami
- Podgląd postępu na każdy dzień

### 🎮 System gamifikacji
- **EXP** - za każde ukończone zadanie (bonus za wcześniejsze ukończenie, kara za spóźnienie)
- **Poziomy** - 20 poziomów z unikalnymi tytułami
- **Osiągnięcia** - 38+ osiągnięć do odblokowania
- **Daily questy** - 3 losowe wyzwania każdego dnia, bonus za ukończenie wszystkich
- **Rare Drops** - losowe przedmioty do zebrania (Common, Rare, Epic, Legendary)
- **Exclusive Achievements** - specjalne osiągnięcia (Speedrunner, Night Owl, Founding Titan i inne)

### 🏆 Rankingi
- EXP
- Seria (streak)
- Liczba osiągnięć
- Rare Drops
- Exclusive Achievements
- Ukończone zadania

### 📚 Plan zajęć
- Dodawanie zajęć (nazwa, prowadzący, dzień, godzina, sala, typ)
- Widoki: dzień, tydzień, miesiąc
- Eksport/Import planu

### 🛒 Lista zakupów
- Indywidualna i rodzinna lista zakupów
- Historia zakupów
- Domyślne artykuły

### 💰 Zarobki
- Śledzenie czasu pracy
- Stawki godzinowe
- Podatki

### 📱 PWA (Progressive Web App)
- Instalacja na urządzeniach mobilnych
- Powiadomienia push
- Tryb offline

### 👨‍👩‍👧‍👦 Rodziny
- Wspólne listy zakupów
- Zapraszanie członków
- Domyślne artykuły rodzinne

### 🔐 Bezpieczeństwo
- Hashowanie haseł (bcrypt)
- JWT autoryzacja
- HTTPS (wbudowany SSL na Renderze)
- Szyfrowanie danych (Fernet)

## 🛠️ Technologie

| Warstwa | Technologia |
|---------|-------------|
| Backend | Python 3.11 + FastAPI |
| Baza danych | PostgreSQL 15 (Render PostgreSQL) |
| Frontend | React 18 + Vite |
| ORM | SQLAlchemy 2.0 |
| Konteneryzacja | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Chmura | Render.com |

## 🚀 Uruchomienie lokalne

### Wymagania
- Docker i Docker Compose
- Git

### Instrukcja (zalecane - Docker Compose)

```bash
git clone https://github.com/SandWraithPL/questdo.git
cd questdo
docker compose up --build
