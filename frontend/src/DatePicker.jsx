import { useState, useEffect, useRef } from "react";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function parseValue(value) {
  if (!value) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

/** Interaktywny wybór daty — klik: dzień, miesiąc, rok */
export default function DatePicker({ value, onChange, label = "Termin" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("days");
  const [cursor, setCursor] = useState(() => parseValue(value));
  const wrapRef = useRef(null);

  useEffect(() => {
    if (value) setCursor(parseValue(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const togglePicker = () => {
    if (open) {
      setOpen(false);
    } else {
      setCursor(parseValue(value));
      setView("days");
      setOpen(true);
    }
  };

  const pickDay = (day) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12, 0, 0);
    onChange(toIso(next));
    setOpen(false);
    setView("days");
  };

  const pickMonth = (monthIndex) => {
    setCursor(new Date(cursor.getFullYear(), monthIndex, 1, 12, 0, 0));
    setView("days");
  };

  const pickYear = (year) => {
    setCursor(new Date(year, cursor.getMonth(), 1, 12, 0, 0));
    setView("months");
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIso(new Date());
  const selectedIso = value || "";

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayCells = [];
  for (let i = 0; i < firstWeekday; i++) {
    dayCells.push(<div key={`e-${i}`} className="dp-day empty" />);
  }
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
    <div className="date-picker-wrap" ref={wrapRef}>
      {label && <span className="date-picker-label">{label}</span>}
      <button type="button" className="date-picker-trigger" onClick={togglePicker}>
        <span className="date-picker-icon">📅</span>
        <span>{formatDisplay(value)}</span>
        <span className="date-picker-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="date-picker-popup" role="dialog" aria-label="Wybierz datę">
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
                <button type="button" className="dp-nav" onClick={() => setView("days")}>
                  ←
                </button>
                <button type="button" className="dp-title" onClick={() => setView("years")}>
                  {year}
                </button>
                <button type="button" className="dp-nav" onClick={() => setView("days")}>
                  ✓
                </button>
              </>
            )}
            {view === "years" && (
              <>
                <button
                  type="button"
                  className="dp-nav"
                  onClick={() => setCursor(new Date(year - 12, month, 1, 12, 0, 0))}
                >
                  ◀
                </button>
                <span className="dp-title-static">Wybierz rok</span>
                <button
                  type="button"
                  className="dp-nav"
                  onClick={() => setCursor(new Date(year + 12, month, 1, 12, 0, 0))}
                >
                  ▶
                </button>
              </>
            )}
          </div>

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

          {view === "years" && <div className="dp-years">{yearButtons}</div>}
        </div>
      )}
    </div>
  );
}
