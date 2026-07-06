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

const INTERVAL_TYPE_LABELS = {
  daily: "Codziennie",
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
  yearly: "Co rok",
};

function getIntervalLabel(event) {
  const typeLabel = INTERVAL_TYPE_LABELS[event.interval_type] || event.interval_type;
  const value = event.interval_value || 1;
  if (value === 1) return typeLabel;
  const unit = event.interval_type === "daily" ? "dni"
    : event.interval_type === "weekly" ? "tygodnie"
    : event.interval_type === "monthly" ? "miesiące" : "lata";
  return `Co ${value} ${unit}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function RecurringPanel({ api, headers, onToast, onRefresh }) {
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("birthday");
  const [intervalType, setIntervalType] = useState("yearly");
  const [intervalValue, setIntervalValue] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("birthday");
  const [editIntervalType, setEditIntervalType] = useState("yearly");
  const [editIntervalValue, setEditIntervalValue] = useState(1);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const loadRecurringEvents = async () => {
    try {
      const res = await axios.get(`${api}/recurring-events`, { headers });
      setRecurringEvents(res.data);
    } catch (err) {
    }
  };

  useEffect(() => {
    loadRecurringEvents();
  }, []);

  const resetForm = () => {
    setTitle("");
    setCategory("birthday");
    setIntervalType("yearly");
    setIntervalValue(1);
    setStartDate("");
    setEndDate("");
  };

  const addRecurringEvent = async () => {
    if (!title.trim()) {
      onToast("Podaj nazwę wydarzenia");
      return;
    }
    if (!startDate) {
      onToast("Podaj datę startową");
      return;
    }
    try {
      await axios.post(`${api}/recurring-events`, {
        title,
        category,
        interval_type: intervalType,
        interval_value: intervalValue,
        start_date: startDate,
        end_date: endDate || null,
      }, { headers });
      resetForm();
      setShowAdd(false);
      onToast("✅ Dodano wydarzenie cykliczne");
      loadRecurringEvents();
      onRefresh?.();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd dodawania");
    }
  };

  const deleteRecurringEvent = async (id) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć to wydarzenie cykliczne?`)) return;

    try {
      await axios.delete(`${api}/recurring-events/${id}`, { headers });
      onToast("🗑️ Usunięto wydarzenie cykliczne");
      loadRecurringEvents();
      onRefresh?.();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd usuwania");
    }
  };

  const deleteAllRecurringEvents = async () => {
    const count = recurringEvents.length;
    if (count === 0) {
      onToast("Brak wydarzeń do usunięcia");
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz usunąć WSZYSTKIE ${count} wydarzeń cyklicznych?`)) return;

    try {
      await Promise.all(recurringEvents.map(event => axios.delete(`${api}/recurring-events/${event.id}`, { headers })));
      onToast(`🗑️ Usunięto wszystkie ${count} wydarzeń cyklicznych`);
      loadRecurringEvents();
      onRefresh?.();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd usuwania");
    }
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setEditTitle(event.title);
    setEditCategory(event.category);
    setEditIntervalType(event.interval_type || "yearly");
    setEditIntervalValue(event.interval_value || 1);
    setEditStartDate(event.start_date || "");
    setEditEndDate(event.end_date || "");
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    if (!editStartDate) {
      onToast("Podaj datę startową");
      return;
    }
    try {
      await axios.patch(`${api}/recurring-events/${editingId}`, {
        title: editTitle,
        category: editCategory,
        interval_type: editIntervalType,
        interval_value: editIntervalValue,
        start_date: editStartDate,
        end_date: editEndDate || null,
        month: null,
        day: null,
      }, { headers });
      setEditingId(null);
      onToast("✅ Zaktualizowano wydarzenie");
      loadRecurringEvents();
      onRefresh?.();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd aktualizacji");
    }
  };

  const sortedEvents = [...recurringEvents].sort((a, b) => {
    const aDate = a.start_date ? new Date(a.start_date) : new Date(0);
    const bDate = b.start_date ? new Date(b.start_date) : new Date(0);
    return aDate - bDate;
  });

  return (
    <div className="module-panel recurring-panel">
      <div className="day-tasks-panel">
        <div className="tasks-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <h3>🔄 Wydarzenia cykliczne</h3>
          <button
            type="button"
            className="danger-btn danger-btn--inline"
            onClick={deleteAllRecurringEvents}
          >
            🗑️ Usuń wszystkie
          </button>
        </div>
        <p className="panel-hint">Dodaj wydarzenia powtarzające się w regularnych odstępach (urodziny, rocznice, przypomnienia).</p>
      </div>

      {!showAdd ? (
        <button type="button" className="add-task-btn" onClick={() => setShowAdd(true)}>
          + Dodaj wydarzenie cykliczne
        </button>
      ) : (
        <div className="add-task">
          <h3>+ Nowe wydarzenie cykliczne</h3>
          <input
            placeholder="Nazwa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
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
              placeholder="Co ile (np. 2)"
              value={intervalValue}
              onChange={(e) => setIntervalValue(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <DatePicker value={startDate} onChange={setStartDate} label="Data startowa" />
          <DatePicker value={endDate} onChange={setEndDate} label="Data zakończenia (opcjonalnie)" />
          <div className="row">
            <button type="button" className="add-task-btn" onClick={addRecurringEvent}>
              Dodaj wydarzenie
            </button>
            <button type="button" className="cancel-btn" onClick={() => { setShowAdd(false); resetForm(); }}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="day-tasks-panel">
        {sortedEvents.length === 0 && (
          <p className="empty">Brak wydarzeń cyklicznych. Dodaj pierwsze!</p>
        )}
        {sortedEvents.map((event) => {
          const editing = editingId === event.id;
          return (
            <div key={event.id} className="task-card medium event">
              {editing ? (
                <div className="edit-mode">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Nazwa" />
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
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
                    placeholder="Co ile"
                    value={editIntervalValue}
                    onChange={(e) => setEditIntervalValue(parseInt(e.target.value, 10) || 1)}
                  />
                  <DatePicker value={editStartDate} onChange={setEditStartDate} label="Data startowa" />
                  <DatePicker value={editEndDate} onChange={setEditEndDate} label="Data zakończenia" />
                  <button type="button" className="save-mini" onClick={saveEdit}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => setEditingId(null)}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4>{getEventCategoryEmoji(event.category)} {event.title}</h4>
                    <div className="task-meta">
                      <span className="badge category">{getEventCategoryLabel(event.category)}</span>
                      <span className="badge recurring">{getIntervalLabel(event)}</span>
                      {event.start_date && <span className="badge timing-ontime">Od {formatDisplayDate(event.start_date)}</span>}
                      {event.end_date && <span className="badge timing-late">Do {formatDisplayDate(event.end_date)}</span>}
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
