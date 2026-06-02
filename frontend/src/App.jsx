/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import "./index.css";
import DatePicker from "./DatePicker";

const API = "https://questdo-backend.onrender.com";

const DEFAULT_LEVEL_THRESHOLDS = [
  0, 80, 180, 320, 480, 660, 860, 1080, 1320, 1600, 1900, 2250, 2650, 3100, 3600,
  4150, 4750, 5400, 6100, 7000,
];
const EXP_MAP = { easy: 10, medium: 25, hard: 50 };
const EXP_TIMING_LABELS = {
  early: { text: "Wcześnie +50%", className: "timing-early" },
  ontime: { text: "Na czas", className: "timing-ontime" },
  late: { text: "Spóźnione -50%", className: "timing-late" },
};
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const WEEKDAYS_LONG = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const REMINDER_OPTIONS = [
  { value: "", label: "Bez przypomnienia" },
  { value: "0", label: "W dniu zadania" },
  { value: "1", label: "Dzień wcześniej" },
  { value: "3", label: "3 dni wcześniej" },
  { value: "7", label: "Tydzień wcześniej" },
];

function getExpPreview(difficulty, dueDateStr) {
  const base = EXP_MAP[difficulty] || 10;
  const today = toDateStr(new Date());
  if (today < dueDateStr) {
    return { amount: Math.max(1, Math.round(base * 1.5)), timing: "early", base };
  }
  if (today > dueDateStr) {
    return { amount: Math.max(1, Math.round(base * 0.5)), timing: "late", base };
  }
  return { amount: base, timing: "ontime", base };
}

function expToastSuffix(timing) {
  if (timing === "early") return " 🌟 Wcześnie (+50%)";
  if (timing === "late") return " ⏰ Spóźnione (-50%)";
  return "";
}

const CATEGORIES = [
  { value: "Inne", emoji: "📦" },
  { value: "Studia", emoji: "📚" },
  { value: "Nauka", emoji: "📖" },
  { value: "Dom", emoji: "🏠" },
  { value: "Praca", emoji: "💼" },
  { value: "Sport", emoji: "⚽" },
  { value: "Projekt", emoji: "🛠️" },
  { value: "Zakupy", emoji: "🛒" },
  { value: "Zdrowie", emoji: "💊" },
];

function toDateStr(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === "string") return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCategoryEmoji(cat) {
  return CATEGORIES.find((c) => c.value === cat)?.emoji || "📦";
}

function getReminderLabel(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return REMINDER_OPTIONS.find((o) => o.value === normalized)?.label || "Przypomnienie";
}

function parseReminderValue(value) {
  return value === "" ? null : Number(value);
}

function getExpProgress(exp, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
  let current = 0, next = thresholds[1] || 100;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (exp >= thresholds[i]) {
      current = thresholds[i];
      next = thresholds[i + 1] ?? thresholds[i];
      break;
    }
  }
  const progress = next === current ? 100 : ((exp - current) / (next - current)) * 100;
  return { progress, current, next };
}

function Toast({ message }) {
  return <div className="toast">{message}</div>;
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

async function showAppNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const payload = { title, body, icon: "/favicon.svg", badge: "/favicon.svg" };
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, payload);
      return true;
    }
  }
  new Notification(title, payload);
  return true;
}

function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      if (isRegister) {
        await axios.post(`${API}/register`, { username, password });
      }
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);
      const res = await axios.post(`${API}/token`, form);
      localStorage.setItem("token", res.data.access_token);
      onLogin();
    } catch (e) {
      setError(e.response?.data?.detail || "Błąd logowania");
    }
  };

  return (
    <div className="auth-container">
      <h1>⚔️ QuestDo</h1>
      <p style={{ color: "#aaa", marginBottom: 16 }}>Twoja lista zadań w stylu RPG</p>
      {error && <p style={{ color: "#f44336" }}>{error}</p>}
      <input placeholder="Nazwa użytkownika" value={username} onChange={(e) => setUsername(e.target.value)} />
      <div className="password-field">
        <input
          placeholder="Hasło"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button type="button" className="eye-icon" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? "🙈" : "👁️"}
        </button>
      </div>
      <button onClick={submit}>{isRegister ? "Zarejestruj się" : "Zaloguj się"}</button>
      <p className="switch" onClick={() => setIsRegister(!isRegister)}>
        {isRegister ? "Masz już konto? " : "Nie masz konta? "}
        <span>{isRegister ? "Zaloguj się" : "Zarejestruj się"}</span>
      </p>
    </div>
  );
}

function Calendar({ tasks, selectedDate, onDateSelect, onTaskToggle, onTaskDelete }) {
  const [cursor, setCursor] = useState(() => selectedDate instanceof Date ? selectedDate : new Date());
  const [view, setView] = useState("month");
  const selectedStr = toDateStr(selectedDate);
  const selectedDateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedStr + "T12:00:00");

  const getTasksForDate = (dateStr) => tasks.filter((t) => t.due_date === dateStr);
  const taskStats = (dateStr) => {
    const dayTasks = getTasksForDate(dateStr);
    return { total: dayTasks.length, done: dayTasks.filter((t) => t.completed).length };
  };

  const selectDay = (dateStr) => {
    onDateSelect(dateStr);
    setCursor(new Date(dateStr + "T12:00:00"));
  };

  const goToday = () => {
    const today = new Date();
    setCursor(today);
    onDateSelect(toDateStr(today));
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
      const stats = taskStats(dateStr);
      const isSelected = selectedStr === dateStr;
      const isToday = toDateStr(new Date()) === dateStr;
      days.push(
        <button key={dateStr} type="button" className={`calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`} onClick={() => selectDay(dateStr)}>
          <span className="day-number">{day}</span>
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
      const dayTasks = getTasksForDate(dateStr);
      const stats = taskStats(dateStr);
      const isToday = dateStr === toDateStr(new Date());
      const isSelected = selectedStr === dateStr;
      days.push(
        <button key={dateStr} type="button" className={`week-day ${isSelected ? "week-day-selected" : ""}`} onClick={() => selectDay(dateStr)}>
          <div className={`week-day-header ${isToday ? "today" : ""}`}>
            <span>{WEEKDAYS_LONG[i]}</span>
            <strong>{d.getDate()}</strong>
            <em>{stats.total ? `${stats.done}/${stats.total}` : "0"}</em>
          </div>
          <div className="week-day-tasks">
            {dayTasks.length === 0 && <span className="week-empty">Brak questów</span>}
            {dayTasks.slice(0, 4).map(task => (
              <div key={task.id} className={`week-task ${task.completed ? "completed" : ""} ${task.important ? "important" : ""}`}>
                <span className="week-task-dot" />
                <span>{task.title}</span>
              </div>
            ))}
            {dayTasks.length > 4 && <span className="week-more">+{dayTasks.length - 4} więcej</span>}
          </div>
        </button>
      );
    }
    return days;
  };

  const renderDayView = () => {
    const dayTasks = getTasksForDate(selectedStr);
    return (
      <div className="day-view">
        <h3>{selectedDateObj.toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h3>
        {dayTasks.length === 0 && <p className="empty">Brak zadań na ten dzień</p>}
        {dayTasks.map(task => (
          <div key={task.id} className={`day-task ${task.completed ? "completed" : ""}`}>
            {task.completed ? <div className="task-check checked locked">✓</div> : <button type="button" className="task-check" onClick={() => onTaskToggle(task)} />}
            <div className="day-task-info">
              <strong>{task.important ? "Ważne · " : ""}{task.title}</strong>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>
                <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>
                {task.reminder_offset_days !== null && task.reminder_offset_days !== undefined && <span className="badge reminder">{getReminderLabel(task.reminder_offset_days)}</span>}
              </div>
            </div>
            <button type="button" onClick={() => onTaskDelete(task)}>🗑</button>
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

  return (
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
            <div className="calendar-weekdays">{WEEKDAYS.map(day => <div key={day} className="weekday">{day}</div>)}</div>
            <div className="calendar-days">{renderMonthView()}</div>
          </>
        )}
        {view === "week" && <div className="week-view">{renderWeekView()}</div>}
        {view === "day" && renderDayView()}
      </div>
    </div>
  );
}

function ChallengesBar({ challenges }) {
  if (!challenges?.goals?.length) return null;
  const bonusExp = challenges.triple_bonus_exp || 35;
  
  const getChallengeDescription = (goal) => {
    if (goal.description) return goal.description;
    const label = goal.label;
    const target = goal.target;
    const descMap = {
      "Średnie tempo": `Ukończ ${target} zadanie o średniej trudności`,
      "Nocny patrol": `Ukończ ${target} zadania dziś`,
      "Pozostałe sprawy": `Ukończ zadanie z kategorii "Inne"`,
      "Jeden krok": `Ukończ ${target} zadanie dziś`,
      "Podwójny wysiłek": `Ukończ ${target} zadania dziś`,
      "Trzy przed zmierzchem": `Ukończ ${target} zadania dziś`,
      "Łatwa para": `Ukończ ${target} łatwe zadania`,
      "Pojedynek z trudnym": `Ukończ ${target} trudne zadanie`,
      "Nauka w bibliotece": `Ukończ zadanie z kategorii "Studia"`,
      "Domowe porządki": `Ukończ zadanie z kategorii "Dom"`,
      "Wszystko dziś": `Ukończ wszystkie zadania na dziś`,
    };
    return descMap[label] || `Ukończ ${target} ${target === 1 ? 'zadanie' : 'zadania'}`;
  };
  
  return (
    <div className="challenges-bar">
      <div className="challenges-header-row"><h4>🎯 Wyzwania na dziś</h4></div>
      {challenges.bonus_claimed ? (
        <p className="challenges-bonus-done">✨ Bonus +{bonusExp} EXP odebrany!</p>
      ) : (
        <p className="challenges-hint">Ukończ wszystkie 3 → +{bonusExp} EXP bonus</p>
      )}
      <div className="challenges-list">
        {challenges.goals.map((g) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
          const done = g.done || g.current >= g.target;
          return (
            <div key={g.id} className={`challenge-item ${done ? "done" : ""}`}>
              <div className="challenge-row-top">
                <span className="challenge-icon">{g.icon}</span>
                <span className="challenge-label">{g.label}</span>
                <div className="challenge-progress-small"><div className="challenge-fill-small" style={{ width: `${pct}%` }} /></div>
                <span className="challenge-count-small">{g.current}/{g.target}</span>
              </div>
              <div className="challenge-description">{getChallengeDescription(g)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardPanel({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [rankType, setRankType] = useState("exp");
  const [allRankings, setAllRankings] = useState(null);

  const categories = [
    { id: "exp", label: "🏆 EXP" },
    { id: "streak", label: "🔥 Seria" },
    { id: "achievements", label: "🏅 Osiągnięcia" },
    { id: "rare_drops", label: "✨ Znajdźki" },
    { id: "exclusive", label: "👑 Exclusive" },
    { id: "completed", label: "✅ Ukończone" },
  ];

  const fetchRanking = async (type) => {
    try {
      let url = "";
      if (type === "exp") url = `${API}/rankings/exp`;
      else if (type === "streak") url = `${API}/rankings/streak`;
      else if (type === "achievements") url = `${API}/rankings/achievements`;
      else if (type === "rare_drops") url = `${API}/rankings/rare-drops`;
      else if (type === "exclusive") url = `${API}/rankings/exclusive-achievements`;
      else if (type === "completed") url = `${API}/rankings/completed-tasks`;
      const res = await axios.get(url);
      setAllRankings(prev => ({ ...prev, [type]: res.data }));
    } catch (err) { console.error("Ranking error:", err); }
  };

  const getCurrentRanking = () => allRankings?.[rankType] || [];

  const toggleOpen = () => {
    if (!open) categories.forEach(cat => fetchRanking(cat.id));
    setOpen(!open);
  };

  const handleCategoryChange = (type) => { setRankType(type); if (!allRankings?.[type]) fetchRanking(type); };

  // Auto-refresh rankings every 30 seconds when open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      fetchRanking(rankType);
    }, 30000);
    return () => clearInterval(interval);
  }, [open, rankType]);
  
  return (
    <div className="leaderboard-panel">
      <button type="button" className="leaderboard-toggle" onClick={toggleOpen}>🏅 Rankingi {open ? "▲" : "▼"}</button>
      {open && (
        <div className="leaderboard-content">
          <div className="leaderboard-categories">
            {categories.map(cat => <button key={cat.id} className={`rank-cat-btn ${rankType === cat.id ? "active" : ""}`} onClick={() => handleCategoryChange(cat.id)}>{cat.label}</button>)}
          </div>
          <ol className="leaderboard-list">
            {getCurrentRanking().map((item) => (
              <li key={item.username} className={item.username === currentUser ? "me" : ""}>
                <span className="rank">#{item.rank}</span>
                <span className="name">{item.username}</span>
                <span className="score">
                  {rankType === "exp" && `${item.exp} EXP · Lv.${item.level}`}
                  {rankType === "streak" && `${item.streak} dni 🔥`}
                  {rankType === "achievements" && `${item.achievements} 🏅`}
                  {rankType === "rare_drops" && `${item.rare_drops} ✨`}
                  {rankType === "exclusive" && `${item.exclusive_achievements} 👑`}
                  {rankType === "completed" && `${item.completed_tasks} ✅`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function DayTasksPanel({ selectedDate, tasks, onToggle, onDelete, onSave, onError }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const dateStr = toDateStr(selectedDate);
  const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const dayTasks = useMemo(() => {
    let list = tasks.filter((t) => t.due_date === dateStr);
    if (filter === "done") list = list.filter((t) => t.completed);
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return list;
  }, [tasks, dateStr, filter, search]);

  const allDay = tasks.filter((t) => t.due_date === dateStr);
  const doneCount = allDay.filter((t) => t.completed).length;
  const percent = allDay.length ? Math.round((doneCount / allDay.length) * 100) : 0;

  const startEdit = (task) => {
    if (task.completed) return;
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      description: task.description || "",
      difficulty: task.difficulty,
      category: task.category,
      due_date: task.due_date,
      important: !!task.important,
      reminder_offset_days: task.reminder_offset_days ?? "",
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const saveEdit = async (task) => {
    if (!editForm.title?.trim()) { onError("Tytuł jest wymagany"); return; }
    try {
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description,
        important: !!editForm.important,
        reminder_offset_days: parseReminderValue(editForm.reminder_offset_days),
        ...(task.exp_awarded ? {} : { difficulty: editForm.difficulty, category: editForm.category, due_date: editForm.due_date }),
      };
      await onSave(task.id, payload);
      cancelEdit();
    } catch (e) { onError(e.response?.data?.detail || "Błąd zapisu"); }
  };

  return (
    <div className="day-tasks-panel">
      <div className="tasks-header"><h3>Questy · {dateLabel}</h3>
        <div className="filter-group">{["all", "active", "done"].map(f => <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "Wszystkie" : f === "active" ? "Aktywne" : "Ukończone"}</button>)}</div>
      </div>
      <input className="search-input" type="search" placeholder="🔍 Szukaj questa..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {allDay.length > 0 && (<div className="progress-wrap"><div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div><span>{percent}% ukończone ({doneCount}/{allDay.length})</span></div>)}
      <div className="stats-counter"><span>Wszystkich: <strong>{allDay.length}</strong></span><span>Ukończonych: <strong>{doneCount}</strong></span><span>Pozostało: <strong>{allDay.length - doneCount}</strong></span></div>
      {dayTasks.length === 0 && <div className="empty">{allDay.length ? "Brak questów pasujących do filtrów." : "Brak questów na ten dzień. Dodaj pierwszy! ⚔️"}</div>}
      {dayTasks.map((task) => (
        <div key={task.id} className={`task-card ${task.difficulty} ${task.completed ? "done" : ""}`}>
          {editingId === task.id ? (
            <div className="task-edit-form">
              <input className="input-edit" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Nazwa zadania" />
              <textarea className="input-edit" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Opis" />
              {!task.exp_awarded && (<>
                <div className="add-task-meta">
                  <select value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}>
                    <option value="easy">⚔️ Łatwe (+10 EXP)</option><option value="medium">🗡️ Średnie (+25 EXP)</option><option value="hard">💀 Trudne (+50 EXP)</option>
                  </select>
                  <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
                  </select>
                </div>
                <DatePicker label="Termin" value={editForm.due_date || ""} onChange={(due_date) => setEditForm({ ...editForm, due_date })} />
              </>)}
              <label className="important-toggle">
                <input type="checkbox" checked={!!editForm.important} onChange={(e) => setEditForm({ ...editForm, important: e.target.checked, reminder_offset_days: e.target.checked && editForm.reminder_offset_days === "" ? "7" : editForm.reminder_offset_days })} />
                <span>Ważne</span>
              </label>
              <select className="input-edit" value={editForm.reminder_offset_days ?? ""} onChange={(e) => setEditForm({ ...editForm, reminder_offset_days: e.target.value })}>
                {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="edit-actions"><button className="btn-save" onClick={() => saveEdit(task)}>✓ Zapisz</button><button className="btn-cancel-edit" onClick={cancelEdit}>✗ Anuluj</button></div>
            </div>
          ) : (
            <>
              {task.completed ? <div className="task-check checked locked" title="Ukończone - tylko usunięcie">✓</div> : <button className="task-check" onClick={() => onToggle(task)}></button>}
              <div className="task-info">
                <h4 className={task.completed ? "done" : ""}>{task.important && <span className="important-mark">Ważne · </span>}{task.title}</h4>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>
                  <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>
                  <span className="badge exp">{task.exp_awarded ? `✓ +${task.exp_awarded_amount || EXP_MAP[task.difficulty]} EXP` : `+${task.exp_preview ?? getExpPreview(task.difficulty, task.due_date).amount} EXP`}</span>
                  {!task.exp_awarded && (() => { const t = task.exp_timing_preview ?? getExpPreview(task.difficulty, task.due_date).timing; const info = EXP_TIMING_LABELS[t]; return info ? <span className={`badge timing ${info.className}`}>{info.text}</span> : null; })()}
                  {task.reminder_offset_days !== null && task.reminder_offset_days !== undefined && <span className="badge reminder">{getReminderLabel(task.reminder_offset_days)}</span>}
                </div>
              </div>
              <div className="task-actions">
                {!task.completed && <button className="icon-btn" onClick={() => startEdit(task)}>✏️</button>}
                <button className="task-delete" onClick={() => onDelete(task)}>🗑</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminPanel({ isOpen, onClose, headers }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/stats`, { headers })
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Admin error:", err);
      setError(err.response?.data?.detail || "Błąd ładowania danych admina");
    }
    setLoading(false);
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm(`Na pewno usunąć użytkownika "${username}"? Ta operacja jest nieodwracalna.`)) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { headers });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Błąd usuwania użytkownika");
    }
  };

  useEffect(() => { if (isOpen) fetchData(); }, [isOpen]);

  // Auto-refresh admin data every 30 seconds when open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2>🔧 Panel Admina</h2>
          <button type="button" onClick={onClose} className="admin-close">✕</button>
        </div>
        {loading ? <p>Ładowanie...</p> : error ? <p style={{ color: "#e74c3c" }}>{error}</p> : (
          <>
            {stats && (
              <div className="admin-stats">
                <div className="stat-card"><h3>Użytkownicy</h3><p>{stats.total_users}</p></div>
                <div className="stat-card"><h3>Zadania</h3><p>{stats.total_tasks}</p></div>
                <div className="stat-card"><h3>Ukończone</h3><p>{stats.total_completed_tasks}</p></div>
                <div className="stat-card"><h3>Osiągnięcia</h3><p>{stats.total_achievements_unlocked}</p></div>
                <div className="stat-card"><h3>Znajdźki</h3><p>{stats.total_rare_drops}</p></div>
              </div>
            )}
            <div className="admin-users-section">
              <h3>Użytkownicy</h3>
              <div className="users-list">
                {users.length === 0 ? <p className="muted">Brak użytkowników</p> : users.map(u => (
                  <div key={u.id} className="user-row">
                    <div className="user-info">
                      <strong>{u.username}</strong>
                      <span>EXP: {u.exp} | Seria: {u.streak} | Zadania: {u.tasks_count} | Osiągnięcia: {u.achievements_count}</span>
                    </div>
                    {u.username !== "Igor" && (
                      <button type="button" className="delete-user-btn" onClick={() => deleteUser(u.id, u.username)}>🗑️ Usuń</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Profile({ user, onLogout, onDeleteAccount, achievements, rareDrops, onOpenAdmin }) {
  const [showAchievements, setShowAchievements] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const unlocked = achievements?.unlocked ?? [];
  const nextAch = achievements?.next;
  const isAdmin = user.username === "Igor";

  const submitDelete = () => { if (!deletePassword.trim()) return; onDeleteAccount(deletePassword, () => { setDeleteMode(false); setDeletePassword(""); }); };

  return (
    <div className="profile-dropdown">
      <div className="profile-trigger" onClick={() => setShowAchievements(!showAchievements)}>
        <div className="avatar-small">{user.username[0].toUpperCase()}</div><span>{user.username}</span><span>▼</span>
      </div>
      {showAchievements && (
        <div className="profile-menu">
          <div className="profile-info-dropdown"><p><strong>{user.username}</strong></p><p>Poziom {user.level} - {user.title}</p><p>{user.exp} EXP | 🔥 {user.streak} dni</p></div>
          {nextAch && (<div className="next-achievement"><h4>Następne osiągnięcie 🎯</h4><div className="achievement-item next"><span>{nextAch.icon}</span><div><strong>{nextAch.title}</strong><p>{nextAch.description}</p><p className="ach-progress">Postęp: {nextAch.progress}</p></div></div></div>)}
          <div className="achievements-list"><h4>Odznaczone 🏆 ({unlocked.length})</h4>{unlocked.length === 0 && <p className="muted">Jeszcze brak - pierwszy quest czeka!</p>}{unlocked.map(ach => (<div key={ach.slug || ach.title} className="achievement-item"><span>{ach.icon}</span><div><strong>{ach.title}</strong><p>{ach.description}</p></div></div>))}</div>
          <div className="rare-drops-list"><h4>Znajdźki ✨ ({rareDrops?.total_items || 0})</h4>{(!rareDrops?.items || rareDrops.items.length === 0) && <p className="muted">Jeszcze brak znajdziek - codziennie masz szansę!</p>}{rareDrops?.items?.map(drop => (<div key={drop.slug} className="rare-drop-item"><span className={`rare-drop-${drop.rarity}`}>{drop.icon}</span><div><strong>{drop.name}</strong><p>{drop.description}</p><p className="rare-drop-count">x{drop.count} · {drop.rarity}</p></div></div>))}</div>
          {isAdmin && <button type="button" onClick={onOpenAdmin} className="admin-btn">🔧 Panel Admina</button>}
          <button type="button" onClick={onLogout} className="logout-btn">Wyloguj</button>
          {!deleteMode ? <button className="delete-account-btn" onClick={() => setDeleteMode(true)}>Usuń konto</button> : (
            <div className="delete-account-form"><input type="password" placeholder="Hasło do potwierdzenia" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /><button className="delete-account-confirm" onClick={submitDelete}>Potwierdź usunięcie</button><button className="delete-account-cancel" onClick={() => setDeleteMode(false)}>Anuluj</button></div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [achievements, setAchievements] = useState({ unlocked: [], next: null });
  const [rareDrops, setRareDrops] = useState(null);
  const [levelThresholds, setLevelThresholds] = useState(DEFAULT_LEVEL_THRESHOLDS);
  const [challenges, setChallenges] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddTask, setShowAddTask] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [category, setCategory] = useState("Inne");
  const [taskDate, setTaskDate] = useState(toDateStr(new Date()));
  const [important, setImportant] = useState(false);
  const [reminderOffset, setReminderOffset] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => ("Notification" in window ? Notification.permission === "granted" : false));
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const enableNotifications = async () => {
    const permission = await ensureNotificationPermission();
    const enabled = permission === "granted";
    setNotificationsEnabled(enabled);
    showToast(enabled ? "Powiadomienia są włączone" : permission === "unsupported" ? "Ta przeglądarka nie obsługuje powiadomień" : "Nie włączono powiadomień");
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("SW register error:", err));
  }, []);

  useEffect(() => {
    if (!notificationsEnabled || !tasks.length) return undefined;
    const timers = [];
    const now = Date.now();
    tasks
      .filter((task) => !task.completed && task.reminder_offset_days !== null && task.reminder_offset_days !== undefined)
      .forEach((task) => {
        const reminderAt = new Date(`${task.due_date}T09:00:00`);
        reminderAt.setDate(reminderAt.getDate() - Number(task.reminder_offset_days || 0));
        const delay = reminderAt.getTime() - now;
        const storageKey = `questdo-reminded-${task.id}-${task.due_date}-${task.reminder_offset_days}`;
        if (delay < -1000 || delay > 2147483647 || localStorage.getItem(storageKey)) return;
        const timer = setTimeout(() => {
          localStorage.setItem(storageKey, "1");
          showAppNotification(task.important ? "Ważny quest czeka" : "QuestDo przypomina", `${task.title} · termin ${task.due_date}`);
        }, Math.max(0, delay));
        timers.push(timer);
      });
    return () => timers.forEach(clearTimeout);
  }, [tasks, notificationsEnabled]);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [userRes, tasksRes, achRes, chRes, levelsRes, rareDropsRes] = await Promise.all([
        axios.get(`${API}/me`, { headers }), axios.get(`${API}/tasks`, { headers }), axios.get(`${API}/achievements`, { headers }),
        axios.get(`${API}/challenges`, { headers }), axios.get(`${API}/game/levels`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/rare-drops/inventory`, { headers }).catch(() => ({ data: null })),
      ]);
      const oldCount = achievements.unlocked?.length || 0;
      const newUnlocked = achRes.data.unlocked || [];
      if (newUnlocked.length > oldCount) {
        const newest = newUnlocked[newUnlocked.length - 1];
        showToast(`🏆 Odblokowano: ${newest.title}! ${newest.icon}`);
        showAppNotification("Nowe osiągnięcie", `${newest.title}: ${newest.description}`);
      }
      setUser(userRes.data); setTasks(tasksRes.data); setAchievements(newUnlocked.length ? { unlocked: newUnlocked, next: achRes.data.next } : achRes.data);
      if (levelsRes.data?.length) setLevelThresholds(levelsRes.data.map(l => l.threshold));
      setChallenges(chRes.data);
      if (rareDropsRes.data) setRareDrops(rareDropsRes.data);
      try {
        const rareDropRes = await axios.post(`${API}/rare-drops/claim-daily`, {}, { headers });
        if (rareDropRes.data.status === "success") {
          showToast(`✨ ${rareDropRes.data.message}`);
          showAppNotification("Nowa znajdźka", rareDropRes.data.item ? `${rareDropRes.data.item.name}: ${rareDropRes.data.item.description}` : rareDropRes.data.message);
        }
      } catch (err) { console.debug("Rare drop claim skipped:", err); }
    } catch (err) { console.error("Fetch error:", err); localStorage.removeItem("token"); setToken(null); }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);
  useEffect(() => { setTaskDate(toDateStr(selectedDate)); }, [selectedDate]);

  const addTask = async () => {
    if (!title.trim()) { showToast("Podaj nazwę zadania"); return; }
    try {
      await axios.post(`${API}/tasks`, { title, description: desc, difficulty, category, due_date: taskDate, important, reminder_offset_days: parseReminderValue(reminderOffset) }, { headers });
      setTitle(""); setDesc(""); setImportant(false); setReminderOffset(""); setShowAddTask(false); fetchData(); showToast(`✅ Dodano quest na ${taskDate}`);
    } catch (err) { showToast(err.response?.data?.detail || "Błąd dodawania"); }
  };

  const toggleTask = async (task) => {
    if (task.completed) return;
    try {
      const res = await axios.patch(`${API}/tasks/${task.id}`, { completed: true }, { headers });
      const { exp_gained, daily_bonus, exp_timing } = res.data;
      if (daily_bonus > 0) showToast(`🎉 Wszystkie wyzwania dziś! +${daily_bonus} EXP bonus`);
      else if (exp_gained > 0) showToast(`✅ Quest ukończony! +${exp_gained} EXP${expToastSuffix(exp_timing)}`);
      fetchData();
    } catch (err) { showToast(err.response?.data?.detail || "Błąd aktualizacji"); }
  };

  const saveTask = async (id, updates) => { await axios.patch(`${API}/tasks/${id}`, updates, { headers }); showToast("💾 Zapisano zmiany"); fetchData(); };
  const deleteAccount = async (password, onDone) => { if (!window.confirm("Na pewno usunąć konto?")) return; try { await axios.delete(`${API}/me`, { headers, data: { password } }); localStorage.removeItem("token"); setToken(null); setUser(null); showToast("Konto usunięte"); onDone?.(); } catch (err) { showToast(err.response?.data?.detail || "Nie udało się usunąć konta"); } };
  const deleteTask = async (task) => {
    const exp = task.exp_awarded_amount || EXP_MAP[task.difficulty] || 10;
    if (task.exp_awarded && !window.confirm(`Usunąć ukończony quest "${task.title}"? Odejmie ${exp} EXP.`)) return;
    try { const res = await axios.delete(`${API}/tasks/${task.id}`, { headers }); showToast(res.data.exp_removed > 0 ? `🗑️ Usunięto quest (-${res.data.exp_removed} EXP)` : "🗑️ Usunięto quest"); fetchData(); } catch (err) { showToast(err.response?.data?.detail || "Błąd usuwania"); }
  };
  const logout = () => { localStorage.removeItem("token"); setToken(null); setUser(null); };
  const handleLogin = () => { const newToken = localStorage.getItem("token"); setToken(newToken); if (newToken) setTimeout(fetchData, 100); };

  if (!token) return <Auth onLogin={handleLogin} />;
  if (!user) return <div className="app"><p>Ładowanie...</p></div>;

  const { progress } = getExpProgress(user.exp, levelThresholds);

  return (
    <div className="app">
      <div className="header"><h1>⚔️ QuestDo</h1><Profile user={user} onLogout={logout} onDeleteAccount={deleteAccount} achievements={achievements} rareDrops={rareDrops} onOpenAdmin={() => setShowAdminPanel(true)} /></div>
      <Calendar tasks={tasks} selectedDate={selectedDate} onDateSelect={(dateStr) => setSelectedDate(new Date(dateStr + "T12:00:00"))} onTaskToggle={toggleTask} onTaskDelete={deleteTask} />
      <DayTasksPanel selectedDate={selectedDate} tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} onSave={saveTask} onError={showToast} />
      {!showAddTask ? <button className="add-task-btn" onClick={() => setShowAddTask(true)}>+ Dodaj zadanie</button> : (
        <div className="add-task"><h3>+ Nowy Quest na {taskDate}</h3><input placeholder="Nazwa zadania..." value={title} onChange={(e) => setTitle(e.target.value)} /><textarea placeholder="Opis..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="add-task-meta">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">⚔️ Łatwe (+10 EXP)</option><option value="medium">🗡️ Średnie (+25 EXP)</option><option value="hard">💀 Trudne (+50 EXP)</option></select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}</select>
            <DatePicker value={taskDate} onChange={setTaskDate} label="Termin" />
          </div>
          <div className="task-options-row">
            <label className="important-toggle">
              <input type="checkbox" checked={important} onChange={(e) => { setImportant(e.target.checked); if (e.target.checked && reminderOffset === "") setReminderOffset("7"); }} />
              <span>Ważne</span>
            </label>
            <select value={reminderOffset} onChange={(e) => setReminderOffset(e.target.value)}>
              {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {(() => { const p = getExpPreview(difficulty, taskDate); const info = EXP_TIMING_LABELS[p.timing]; return <p className="exp-preview-hint">Ukończ dziś: <strong>+{p.amount} EXP</strong> ({info.text})</p>; })()}
          <div className="row"><button onClick={addTask}>Dodaj Quest</button><button onClick={() => setShowAddTask(false)} className="cancel-btn">Anuluj</button></div>
        </div>
      )}
      <button type="button" className={`notifications-btn ${notificationsEnabled ? "enabled" : ""}`} onClick={enableNotifications}>
        {notificationsEnabled ? "Powiadomienia włączone" : "Włącz powiadomienia"}
      </button>
      <div className="profile-card">
        <div className="avatar">{user.username[0].toUpperCase()}</div>
        <div className="profile-info"><h2>Poziom {user.level}</h2><div className="title">{user.title}</div><div className="exp-bar-bg"><div className="exp-bar" style={{ width: `${progress}%` }} /></div><div className="exp-text">{user.exp} EXP</div>{user.next_level_title && <div className="level-next-hint">Do "{user.next_level_title}": {user.next_level_exp} EXP</div>}{user.exp_tip && <p className="exp-tip">{user.exp_tip}</p>}</div>
        <div className="streak"><div className="flame">🔥</div><div className="count">{user.streak}</div><div className="label">seria</div></div>
      </div>
      <ChallengesBar challenges={challenges} />
      <LeaderboardPanel currentUser={user.username} />
      {toast && <Toast message={toast} />}
      <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} headers={headers} />
    </div>
  );
}
