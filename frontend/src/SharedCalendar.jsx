/* eslint-disable react-hooks/set-state-in-effect */
import { useState } from "react";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const WEEKDAYS_LONG = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

function toDateStr(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === "string") return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayIndex(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

export default function SharedCalendar({
  items = [],
  selectedDate,
  onDateSelect,
  matchItemToDate,
  getItemLabel,
  isItemCompleted = () => false,
  renderItemMeta,
  onItemToggle,
  onItemDelete,
  sectionTitle = "📅 Kalendarz",
  emptyLabel = "Brak wpisów",
  itemNoun = "wpisów",
  collapsedStorageKey = "questdo-shared-calendar-collapsed",
  defaultCollapsed = true,
  freeDays = [],
}) {
  const [cursor, setCursor] = useState(() => (selectedDate instanceof Date ? selectedDate : new Date()));
  const [view, setView] = useState("month");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(collapsedStorageKey);
      if (saved !== null) return saved === "true";
    } catch {
      /* ignore */
    }
    return defaultCollapsed;
  });

  const selectedStr = toDateStr(selectedDate);
  const selectedDateObj = selectedDate instanceof Date ? selectedDate : new Date(`${selectedStr}T12:00:00`);

  const getFreeDayType = (dateStr) => {
    const freeDay = freeDays.find(fd => fd.date === dateStr);
    return freeDay ? freeDay.day_type : null;
  };

  const getItemsForDate = (dateStr) => items.filter((item) => matchItemToDate(item, dateStr));
  const itemStats = (dateStr) => {
    const dayItems = getItemsForDate(dateStr);
    return { total: dayItems.length, done: dayItems.filter((item) => isItemCompleted(item)).length };
  };

  const selectDay = (dateStr) => {
    onDateSelect(dateStr);
    setCursor(new Date(`${dateStr}T12:00:00`));
  };

  const goToday = () => {
    const today = new Date();
    setCursor(today);
    onDateSelect(toDateStr(today));
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(collapsedStorageKey, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const shift = (delta) => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1, 12, 0, 0));
    if (view === "week") {
      const next = new Date(selectedDateObj);
      next.setDate(selectedDateObj.getDate() + delta * 7);
      selectDay(toDateStr(next));
    }
    if (view === "day") {
      const next = new Date(selectedDateObj);
      next.setDate(selectedDateObj.getDate() + delta);
      selectDay(toDateStr(next));
    }
  };

  const renderMonthView = () => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < firstWeekday; i++) days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateStr(new Date(year, month, day, 12, 0, 0));
      const stats = itemStats(dateStr);
      const isSelected = selectedStr === dateStr;
      const isToday = toDateStr(new Date()) === dateStr;
      const freeDayType = getFreeDayType(dateStr);
      days.push(
        <button key={dateStr} type="button" className={`calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${freeDayType ? `free-day free-day-${freeDayType}` : ""}`} onClick={() => selectDay(dateStr)}>
          <span className="day-number">{day}</span>
          {freeDayType === "holiday" && <span className="free-day-icon">🎉</span>}
          {freeDayType === "deans_day" && <span className="free-day-icon">🎓</span>}
          {freeDayType === "rector_day" && <span className="free-day-icon">🏛️</span>}
          {stats.total > 0 && <span className={`day-badge ${stats.done === stats.total ? "done" : ""}`}>{stats.done}/{stats.total}</span>}
        </button>
      );
    }
    return days;
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDateObj);
    const mondayIndex = (selectedDateObj.getDay() + 6) % 7;
    startOfWeek.setDate(selectedDateObj.getDate() - mondayIndex);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = toDateStr(d);
      const dayItems = getItemsForDate(dateStr);
      const stats = itemStats(dateStr);
      const isToday = dateStr === toDateStr(new Date());
      const isSelected = selectedStr === dateStr;
      const freeDayType = getFreeDayType(dateStr);
      days.push(
        <button key={dateStr} type="button" className={`week-day ${isSelected ? "week-day-selected" : ""} ${freeDayType ? `week-day-free week-day-free-${freeDayType}` : ""}`} onClick={() => selectDay(dateStr)}>
          <div className={`week-day-header ${isToday ? "today" : ""}`}>
            <span>{WEEKDAYS_LONG[i]}</span>
            <strong>{d.getDate()}</strong>
            {freeDayType === "holiday" && <span className="week-free-icon">🎉</span>}
            {freeDayType === "deans_day" && <span className="week-free-icon">🎓</span>}
            {freeDayType === "rector_day" && <span className="week-free-icon">🏛️</span>}
            <em>{stats.total ? `${stats.done}/${stats.total}` : "0"}</em>
          </div>
          <div className="week-day-tasks">
            {dayItems.length === 0 && <span className="week-empty">{emptyLabel}</span>}
            {dayItems.slice(0, 4).map((item) => (
              <div key={item.id} className={`week-task ${isItemCompleted(item) ? "completed" : ""}`}>
                <span className="week-task-dot" />
                <span>{getItemLabel(item)}</span>
              </div>
            ))}
            {dayItems.length > 4 && <span className="week-more">+{dayItems.length - 4} więcej</span>}
          </div>
        </button>
      );
    }
    return days;
  };

  const renderDayView = () => {
    const dayItems = getItemsForDate(selectedStr);
    const freeDayType = getFreeDayType(selectedStr);
    return (
      <div className="day-view">
        <h3>
          {selectedDateObj.toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {freeDayType === "holiday" && <span className="day-free-indicator"> 🎉 Święto</span>}
          {freeDayType === "deans_day" && <span className="day-free-indicator"> 🎓 Dzień dziekański</span>}
          {freeDayType === "rector_day" && <span className="day-free-indicator"> 🏛️ Dzień rektorski</span>}
        </h3>
        {dayItems.length === 0 && <p className="empty">{emptyLabel}</p>}
        {dayItems.map((item) => (
          <div key={item.id} className={`day-task ${isItemCompleted(item) ? "completed" : ""}`}>
            {onItemToggle ? (
              isItemCompleted(item) ? (
                <div className="task-check checked locked">✓</div>
              ) : (
                <button type="button" className="task-check" onClick={() => onItemToggle(item)} />
              )
            ) : (
              <div className="task-check checked locked" style={{ opacity: 0.3 }}>·</div>
            )}
            <div className="day-task-info">
              <strong>{getItemLabel(item)}</strong>
              {renderItemMeta?.(item)}
            </div>
            {onItemDelete && <button type="button" className="icon-btn delete" onClick={() => onItemDelete(item)}>🗑</button>}
          </div>
        ))}
      </div>
    );
  };

  const weekTitle = (() => {
    const start = new Date(selectedDateObj);
    start.setDate(selectedDateObj.getDate() - ((selectedDateObj.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}`;
  })();

  const headerTitle = view === "month"
    ? cursor.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })
    : view === "week"
      ? weekTitle
      : selectedDateObj.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  const selectedDayStats = itemStats(selectedStr);
  const selectedDayLabel = selectedDateObj.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
  const selectedDayMeta = selectedDayStats.total > 0
    ? `${selectedDayStats.done}/${selectedDayStats.total} ${itemNoun}`
    : `brak ${itemNoun}`;

  return (
    <section className={`calendar-section ${collapsed ? "calendar-section--collapsed" : "calendar-section--expanded"}`}>
      <div className="calendar-section-bar">
        <button type="button" className="calendar-section-toggle" onClick={toggleCollapsed} aria-expanded={!collapsed}>
          <span className="calendar-section-title">{sectionTitle}</span>
          <span className="calendar-section-meta">{selectedDayLabel} · {selectedDayMeta}</span>
          <span className="calendar-section-chevron" aria-hidden="true">{collapsed ? "▼" : "▲"}</span>
        </button>
        {collapsed && (
          <button type="button" className="calendar-section-today" onClick={goToday}>Dzisiaj</button>
        )}
      </div>
      {!collapsed && (
        <div className="calendar-container">
          <div className="calendar-header">
            <div className="calendar-nav">
              <button type="button" onClick={() => shift(-1)} aria-label="Poprzedni zakres">◀</button>
              <h2>{headerTitle}</h2>
              <button type="button" onClick={() => shift(1)} aria-label="Następny zakres">▶</button>
            </div>
            <div className="view-buttons">
              <button type="button" onClick={() => setView("month")} className={view === "month" ? "active" : ""}>Miesiąc</button>
              <button type="button" onClick={() => setView("week")} className={view === "week" ? "active" : ""}>Tydzień</button>
              <button type="button" onClick={() => setView("day")} className={view === "day" ? "active" : ""}>Dzień</button>
            </div>
            {view === "month" && <button type="button" className="calendar-today" onClick={goToday}>Dzisiaj</button>}
          </div>
          <div className="calendar-grid">
            {view === "month" && (
              <>
                <div className="calendar-weekdays">{WEEKDAYS.map((day) => <div key={day} className="weekday">{day}</div>)}</div>
                <div className="calendar-days">{renderMonthView()}</div>
              </>
            )}
            {view === "week" && <div className="week-view">{renderWeekView()}</div>}
            {view === "day" && renderDayView()}
          </div>
        </div>
      )}
    </section>
  );
}

export { toDateStr, weekdayIndex, WEEKDAYS_LONG };
