import { useState, useEffect } from "react";
import axios from "axios";
import DatePicker from "./DatePicker";

const EVENT_CATEGORIES = [
  { value: "birthday", emoji: "🎂", label: "Urodziny" },
  { value: "anniversary", emoji: "💍", label: "Rocznica" },
  { value: "holiday", emoji: "🎉", label: "Święto" },
  { value: "reminder", emoji: "🔔", label: "Przypomnienie" },
];

function getEventCategoryEmoji(cat) {
  return EVENT_CATEGORIES.find((c) => c.value === cat)?.emoji || "📅";
}

function getEventCategoryLabel(cat) {
  return EVENT_CATEGORIES.find((c) => c.value === cat)?.label || "Inne";
}

export default function RecurringPanel({ api, headers, onToast, selectedDate, onDateSelect }) {
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("birthday");
  // Legacy fields
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  // New interval fields
  const [useInterval, setUseInterval] = useState(false);
  const [intervalType, setIntervalType] = useState("yearly");
  const [intervalValue, setIntervalValue] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("birthday");
  const [editMonth, setEditMonth] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editUseInterval, setEditUseInterval] = useState(false);
  const [editIntervalType, setEditIntervalType] = useState("yearly");
  const [editIntervalValue, setEditIntervalValue] = useState(1);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const loadRecurringEvents = async () => {
    try {
      const res = await axios.get(`${api}/recurring-events`, { headers });
      setRecurringEvents(res.data);
    } catch (err) {
      console.error("Błąd ładowania wydarzeń cyklicznych:", err);
    }
  };

  useEffect(() => {
    loadRecurringEvents();
  }, []);

  const addRecurringEvent = async () => {
    if (!title.trim()) {
      onToast("Podaj nazwę wydarzenia");
      return;
    }
    if (useInterval) {
      if (!startDate) {
        onToast("Podaj datę początkową");
        return;
      }
    } else {
      if (!month || !day) {
        onToast("Wybierz datę (dzień i miesiąc)");
        return;
      }
    }
    try {
      const payload = {
        title,
        category,
      };
      if (useInterval) {
        payload.interval_type = intervalType;
        payload.interval_value = intervalValue;
        payload.start_date = startDate;
        if (endDate) payload.end_date = endDate;
      } else {
        payload.month = parseInt(month);
        payload.day = parseInt(day);
      }
      await axios.post(`${api}/recurring-events`, payload, { headers });
      setTitle("");
      setCategory("birthday");
      setMonth("");
      setDay("");
      setUseInterval(false);
      setIntervalType("yearly");
      setIntervalValue(1);
      setStartDate("");
      setEndDate("");
      setShowAdd(false);
      onToast("✅ Dodano wydarzenie cykliczne");
      loadRecurringEvents();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd dodawania");
    }
  };

  const deleteRecurringEvent = async (id) => {
    try {
      await axios.delete(`${api}/recurring-events/${id}`, { headers });
      onToast("🗑️ Usunięto wydarzenie cykliczne");
      loadRecurringEvents();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd usuwania");
    }
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setEditTitle(event.title);
    setEditCategory(event.category);
    const isInterval = event.interval_type && event.start_date;
    setEditUseInterval(isInterval);
    if (isInterval) {
      setEditIntervalType(event.interval_type);
      setEditIntervalValue(event.interval_value || 1);
      setEditStartDate(event.start_date);
      setEditEndDate(event.end_date || "");
    } else {
      setEditMonth(String(event.month));
      setEditDay(String(event.day));
    }
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    try {
      const payload = {
        title: editTitle,
        category: editCategory,
      };
      if (editUseInterval) {
        payload.interval_type = editIntervalType;
        payload.interval_value = editIntervalValue;
        payload.start_date = editStartDate;
        if (editEndDate) payload.end_date = editEndDate;
        payload.month = null;
        payload.day = null;
      } else {
        payload.month = parseInt(editMonth);
        payload.day = parseInt(editDay);
        payload.interval_type = null;
        payload.interval_value = null;
        payload.start_date = null;
        payload.end_date = null;
      }
      await axios.patch(`${api}/recurring-events/${editingId}`, payload, { headers });
      setEditingId(null);
      setEditTitle("");
      setEditCategory("birthday");
      setEditMonth("");
      setEditDay("");
      setEditUseInterval(false);
      setEditIntervalType("yearly");
      setEditIntervalValue(1);
      setEditStartDate("");
      setEditEndDate("");
      onToast("✅ Zaktualizowano wydarzenie");
      loadRecurringEvents();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd aktualizacji");
    }
  };

  const monthNames = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  const intervalTypeLabels = {
    daily: "Codziennie",
    weekly: "Co tydzień",
    monthly: "Co miesiąc",
    yearly: "Co rok",
  };

  const getIntervalLabel = (event) => {
    if (event.interval_type && event.start_date) {
      const typeLabel = intervalTypeLabels[event.interval_type] || event.interval_type;
      const value = event.interval_value || 1;
      if (value === 1) {
        return typeLabel;
      }
      return `Co ${value} ${event.interval_type === "daily" ? "dni" : event.interval_type === "weekly" ? "tygodnie" : event.interval_type === "monthly" ? "miesiące" : "lata"}`;
    }
    return "Co rok";
  };

  const sortedEvents = [...recurringEvents].sort((a, b) => {
    // Sort by start_date for interval events, by month/day for legacy events
    if (a.start_date && b.start_date) {
      return new Date(a.start_date) - new Date(b.start_date);
    }
    if (a.month && b.month) {
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    }
    // Mixed: interval events first
    if (a.start_date) return -1;
    if (b.start_date) return 1;
    return 0;
  });

  return (
    <div className="module-panel recurring-panel">
      <h3>🔄 Wydarzenia Cykliczne</h3>
      <p style={{ color: "#aaa", marginBottom: 16, fontSize: "0.9rem" }}>
        Tutaj dodaj wydarzenia, które powtarzają się w regularnych odstępach (np. urodziny, rocznice, przypomnienia).
      </p>

      {!showAdd ? (
        <button type="button" className="add-task-btn" onClick={() => setShowAdd(true)}>
          + Dodaj wydarzenie cykliczne
        </button>
      ) : (
        <div className="add-task">
          <h3>+ Nowe wydarzenie cykliczne</h3>
          <input
            placeholder="Nazwa (np. Urodziny Zuzi)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EVENT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <label className="important-toggle">
            <input type="checkbox" checked={useInterval} onChange={(e) => setUseInterval(e.target.checked)} />
            <span>Dowolny interwał (nowy format)</span>
          </label>
          {!useInterval ? (
            <div className="add-task-meta">
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">Wybierz miesiąc</option>
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name}</option>
                ))}
              </select>
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">Wybierz dzień</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="add-task-meta">
                <select value={intervalType} onChange={(e) => setIntervalType(e.target.value)}>
                  <option value="daily">Codziennie</option>
                  <option value="weekly">Co tydzień</option>
                  <option value="monthly">Co miesiąc</option>
                  <option value="yearly">Co rok</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Co X (np. 2)"
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(parseInt(e.target.value) || 1)}
                />
              </div>
              <DatePicker value={startDate} onChange={setStartDate} />
              <input
                type="date"
                placeholder="Data zakończenia (opcjonalnie)"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          )}
          <div className="row">
            <button type="button" className="add-task-btn" onClick={addRecurringEvent}>
              Dodaj wydarzenie
            </button>
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="product-list">
        {sortedEvents.length === 0 && (
          <p className="empty">Brak wydarzeń cyklicznych. Dodaj pierwsze!</p>
        )}
        {sortedEvents.map((event) => {
          const editing = editingId === event.id;
          const isInterval = event.interval_type && event.start_date;
          return (
            <div key={event.id} className="task-card medium">
              {editing ? (
                <div className="edit-mode">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Nazwa" />
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {EVENT_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <label className="important-toggle">
                    <input type="checkbox" checked={editUseInterval} onChange={(e) => setEditUseInterval(e.target.checked)} />
                    <span>Dowolny interwał</span>
                  </label>
                  {!editUseInterval ? (
                    <>
                      <select value={editMonth} onChange={(e) => setEditMonth(e.target.value)}>
                        {monthNames.map((name, idx) => (
                          <option key={idx + 1} value={idx + 1}>{name}</option>
                        ))}
                      </select>
                      <select value={editDay} onChange={(e) => setEditDay(e.target.value)}>
                        {Array.from({ length: 31 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <select value={editIntervalType} onChange={(e) => setEditIntervalType(e.target.value)}>
                        <option value="daily">Codziennie</option>
                        <option value="weekly">Co tydzień</option>
                        <option value="monthly">Co miesiąc</option>
                        <option value="yearly">Co rok</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        placeholder="Co X"
                        value={editIntervalValue}
                        onChange={(e) => setEditIntervalValue(parseInt(e.target.value) || 1)}
                      />
                      <DatePicker value={editStartDate} onChange={setEditStartDate} />
                      <input
                        type="date"
                        placeholder="Data zakończenia"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                      />
                    </>
                  )}
                  <button type="button" className="save-mini" onClick={saveEdit}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => { setEditingId(null); setEditTitle(""); setEditCategory("birthday"); setEditMonth(""); setEditDay(""); setEditUseInterval(false); setEditIntervalType("yearly"); setEditIntervalValue(1); setEditStartDate(""); setEditEndDate(""); }}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4>{getEventCategoryEmoji(event.category)} {event.title}</h4>
                    <div className="task-meta">
                      <span className="badge category">{getEventCategoryLabel(event.category)}</span>
                      {isInterval ? (
                        <>
                          <span className="badge recurring">{getIntervalLabel(event)}</span>
                          <span className="badge timing-ontime">Od {event.start_date}</span>
                          {event.end_date && <span className="badge timing-late">Do {event.end_date}</span>}
                        </>
                      ) : (
                        <>
                          <span className="badge recurring">{event.day} {monthNames[event.month - 1]}</span>
                          <span className="badge timing-ontime">Co rok</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button type="button" className="icon-btn" onClick={() => startEdit(event)} title="Edytuj">✏️</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteRecurringEvent(event.id)} title="Usuń">🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
