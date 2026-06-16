import { useState, useEffect } from "react";
import axios from "axios";
import DatePicker from "./DatePicker";

const EVENT_CATEGORIES = [
  { value: "birthday", emoji: "🎂", label: "Urodziny" },
  { value: "anniversary", emoji: "💍", label: "Rocznica" },
  { value: "holiday", emoji: "🎉", label: "Święto" },
  { value: "reminder", emoji: "🔔", label: "Przypomnienie" },
  { value: "other", emoji: "📅", label: "Inne" },
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
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("birthday");
  const [editMonth, setEditMonth] = useState("");
  const [editDay, setEditDay] = useState("");

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
    if (!month || !day) {
      onToast("Wybierz datę (dzień i miesiąc)");
      return;
    }
    try {
      await axios.post(`${api}/recurring-events`, {
        title,
        category,
        month: parseInt(month),
        day: parseInt(day),
      }, { headers });
      setTitle("");
      setCategory("birthday");
      setMonth("");
      setDay("");
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
    setEditMonth(String(event.month));
    setEditDay(String(event.day));
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    try {
      await axios.patch(`${api}/recurring-events/${editingId}`, {
        title: editTitle,
        category: editCategory,
        month: parseInt(editMonth),
        day: parseInt(editDay),
      }, { headers });
      setEditingId(null);
      setEditTitle("");
      setEditCategory("birthday");
      setEditMonth("");
      setEditDay("");
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

  const sortedEvents = [...recurringEvents].sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  return (
    <div className="module-panel recurring-panel">
      <h3>🔄 Wydarzenia Cykliczne</h3>
      <p style={{ color: "#aaa", marginBottom: 16, fontSize: "0.9rem" }}>
        Tutaj dodaj wydarzenia, które powtarzają się co roku (np. urodziny, rocznice). 
        Wydarzenie zostanie automatycznie dodane do kalendarza każdego roku w wybranym dniu.
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
                  <button type="button" className="save-mini" onClick={saveEdit}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => { setEditingId(null); setEditTitle(""); setEditCategory("birthday"); setEditMonth(""); setEditDay(""); }}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4>{getEventCategoryEmoji(event.category)} {event.title}</h4>
                    <div className="task-meta">
                      <span className="badge category">{getEventCategoryLabel(event.category)}</span>
                      <span className="badge recurring">{event.day} {monthNames[event.month - 1]}</span>
                      <span className="badge timing-ontime">Co rok</span>
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
