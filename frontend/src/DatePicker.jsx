// Komponent wyboru daty - wyświetla kalendarz z widokami dni/miesięcy/lat
import { useState, useEffect, useRef } from "react";

// Skróty dni tygodnia w języku polskim
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

// Nazwy miesięcy po polsku
const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

// Parsuje string daty (YYYY-MM-DD) na obiekt Date
function parseValue(value) {
  if (!value) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0); // Ustawiamy na południe (unikamy problemów ze strefami)
}

// Konwertuje Date na string YYYY-MM-DD
function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Formatuje datę do wyświetlenia w polskim formacie (np. "pon. 15 stycznia 2025")
function formatDisplay(value) {
  if (!value) return "Wybierz datę";
  const d = parseValue(value);
  return d.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Główny komponent wyboru daty
export default function DatePicker({ value, onChange, label = "Termin" }) {
  // Czy kalendarz jest otwarty
  const [open, setOpen] = useState(false);
  // Aktualny widok: "days" (dni), "months" (miesiące), "years" (lata)
  const [view, setView] = useState("days");
  // Aktualna data wyświetlana w kalendarzu (może być inna niż wybrana)
  const [cursor, setCursor] = useState(() => parseValue(value));
  const wrapRef = useRef(null);

  // Aktualizujemy kursor gdy zmieni się wartość z zewnątrz
  useEffect(() => {
    if (value) setCursor(parseValue(value));
  }, [value]);

  // Zamykamy kalendarz gdy klikniesz poza nim
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc, true);
    return () => document.removeEventListener("click", onDoc, true);
  }, [open]);

  // Przełącza otwarcie kalendarza
  const togglePicker = () => {
    if (open) {
      setOpen(false);
    } else {
      setCursor(parseValue(value));
      setView("days");
      setOpen(true);
    }
  };

  // Wybiera dzień - zamyka kalendarz i zwraca wybraną datę
  const pickDay = (day) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12, 0, 0);
    onChange(toIso(next));
    setOpen(false);
    setView("days");
  };

  // Wybiera miesiąc - przełącza na widok dni
  const pickMonth = (monthIndex) => {
    setCursor(new Date(cursor.getFullYear(), monthIndex, 1, 12, 0, 0));
    setView("days");
  };

  // Wybiera rok - przełącza na widok miesięcy
  const pickYear = (year) => {
    setCursor(new Date(year, cursor.getMonth(), 1, 12, 0, 0));
    setView("months");
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIso(new Date());
  const selectedIso = value || "";

  // Generuje dni dla aktualnego miesiąca
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayCells = [];
  // Puste komórki przed pierwszym dniem miesiąca
  for (let i = 0; i < firstWeekday; i++) {
    dayCells.push(<div key={`e-${i}`} className="dp-day empty" />);
  }
  // Dni miesiąca
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toIso(new Date(year, month, d, 12, 0, 0));
    dayCells.push(
      <button
        key={d}
        type="button"
        className={`dp-day ${iso === selectedIso ? "selected" : ""} ${iso === todayIso ? "today" : ""}`}
        onClick={() => pickDay(d)}
      >
        {d}
      </button>
    );
  }

  // Generuje przyciski lat dla widoku lat (12 lat na raz)
  const yearStart = year - (year % 12) - 1;
  const yearButtons = [];
  for (let y = yearStart; y < yearStart + 12; y++) {
    yearButtons.push(
      <button
        key={y}
        type="button"
        className={`dp-year ${y === year ? "selected" : ""}`}
        onClick={() => pickYear(y)}
      >
        {y}
      </button>
    );
  }

  return (
    <div className={`date-picker-wrap ${open ? "open" : ""}`} ref={wrapRef}>
      {/* Etykieta */}
      {label && <span className="date-picker-label">{label}</span>}
      
      {/* Przycisk otwierający kalendarz */}
      <button type="button" className="date-picker-trigger" onClick={togglePicker}>
        <span className="date-picker-icon">📅</span>
        <span>{formatDisplay(value)}</span>
        <span className="date-picker-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {/* Wyskakujący kalendarz */}
      {open && (
        <div
          className="date-picker-popup"
          style={{
            zIndex: 999999,
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          role="dialog"
          aria-label="Wybierz datę"
        >
          {/* Nagłówek kalendarza z nawigacją */}
          <div className="dp-header">
            {view === "days" && (
              <>
                <button
                  type="button"
                  className="dp-nav"
                  onClick={() => setCursor(new Date(year, month - 1, 1, 12, 0, 0))}
                  aria-label="Poprzedni miesiąc"
                >
                  ◀
                </button>
                <div className="dp-title-group">
                  <button type="button" className="dp-title" onClick={() => setView("months")}>
                    {MONTHS[month]}
                  </button>
                  <button type="button" className="dp-title dp-year-title" onClick={() => setView("years")}>
                    {year}
                  </button>
                </div>
                <button
                  type="button"
                  className="dp-nav"
                  onClick={() => setCursor(new Date(year, month + 1, 1, 12, 0, 0))}
                  aria-label="Następny miesiąc"
                >
                  ▶
                </button>
              </>
            )}
            {view === "months" && (
              <>
                <button type="button" className="dp-nav" onClick={() => setView("days")}>←</button>
                <button type="button" className="dp-title" onClick={() => setView("years")}>{year}</button>
                <button type="button" className="dp-nav" onClick={() => setView("days")}>✓</button>
              </>
            )}
            {view === "years" && (
              <>
                <button type="button" className="dp-nav" onClick={() => setCursor(new Date(year - 12, month, 1, 12, 0, 0))}>◀</button>
                <span className="dp-title-static">Wybierz rok</span>
                <button type="button" className="dp-nav" onClick={() => setCursor(new Date(year + 12, month, 1, 12, 0, 0))}>▶</button>
              </>
            )}
          </div>

          {/* Widok dni */}
          {view === "days" && (
            <>
              <div className="dp-weekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="dp-grid">{dayCells}</div>
              <button
                type="button"
                className="dp-today-btn"
                onClick={() => {
                  const t = toIso(new Date());
                  onChange(t);
                  setCursor(parseValue(t));
                  setOpen(false);
                }}
              >
                Dziś
              </button>
            </>
          )}

          {/* Widok miesięcy - 3 kolumny po 4 miesiące */}
          {view === "months" && (
            <div className="dp-months">
              {MONTHS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={`dp-month ${i === month ? "selected" : ""}`}
                  onClick={() => pickMonth(i)}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* Widok lat - 3 kolumny po 4 lata */}
          {view === "years" && <div className="dp-years">{yearButtons}</div>}
        </div>
      )}
    </div>
  );
}