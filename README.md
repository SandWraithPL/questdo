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

### 🔐 Bezpieczeństwo
- Hashowanie haseł (bcrypt)
- JWT autoryzacja
- HTTPS (po wdrożeniu)

## 🛠️ Technologie

| Warstwa | Technologia |
|---------|-------------|
| Backend | Python + FastAPI |
| Baza danych | PostgreSQL |
| Frontend | React + Vite |
| Konteneryzacja | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Chmura | Microsoft Azure (ACR + App Service) |

## 🚀 Uruchomienie lokalne

### Wymagania
- Docker i Docker Compose
- Git

### Instrukcja

```bash
git clone https://github.com/SandWraithPL/questdo.git
cd questdo
docker compose up --build
