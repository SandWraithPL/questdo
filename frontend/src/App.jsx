import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import "./index.css";
import DatePicker from "./DatePicker";

const API = "https://translations-springfield-ericsson-fewer.trycloudflare.com";

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState("month");
  const selectedStr = toDateStr(selectedDate);
  const selectedDateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedStr + "T12:00:00");

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const formatDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const getTasksForDate = (dateStr) => tasks.filter((t) => t.due_date === dateStr);

  const renderMonthView = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, month, day);
      const dayTasks = getTasksForDate(dateStr);
      const completedCount = dayTasks.filter((t) => t.completed).length;
      const isSelected = selectedStr === dateStr;
      days.push(
        <div key={day} className={`calendar-day ${isSelected ? "selected" : ""}`} onClick={() => onDateSelect(dateStr)}>
          <span className="day-number">{day}</span>
          {dayTasks.length > 0 && <div className="day-badge">{completedCount}/{dayTasks.length}</div>}
        </div>
      );
    }
    return days;
  };

  const renderWeekView = () => {
    const today = new Date();
    const startOfWeek = new Date(selectedDateObj);
    startOfWeek.setDate(selectedDateObj.getDate() - selectedDateObj.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = toDateStr(d);
      const dayTasks = getTasksForDate(dateStr);
      const isToday = d.toDateString() === today.toDateString();
      const isSelected = selectedStr === dateStr;
      days.push(
        <div key={i} className={`week-day ${isSelected ? "week-day-selected" : ""}`} onClick={() => onDateSelect(dateStr)}>
          <div className={`week-day-header ${isToday ? "today" : ""}`}>
            <div>{["Nie", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"][d.getDay()]}</div>
            <div className="week-day-number">{d.getDate()}</div>
          </div>
          <div className="week-day-tasks">
            {dayTasks.map(task => (
              <div key={task.id} className={`week-task ${task.completed ? "completed" : ""}`}>
                <input type="checkbox" checked={task.completed} disabled={task.completed} onChange={(e) => { e.stopPropagation(); if (!task.completed) onTaskToggle(task); }} />
                <span>{task.title}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onTaskDelete(task); }}>🗑</button>
              </div>
            ))}
          </div>
        </div>
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
            <input type="checkbox" checked={task.completed} disabled={task.completed} onChange={() => !task.completed && onTaskToggle(task)} />
            <div className="day-task-info">
              <strong>{task.title}</strong>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>
                <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>
              </div>
            </div>
            <button type="button" onClick={() => onTaskDelete(task)}>🗑</button>
          </div>
        ))}
      </div>
    );
  };

  const changeMonth = (delta) => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  const headerTitle = view === "month" ? currentMonth.toLocaleDateString("pl-PL", { month: "long", year: "numeric" }) : selectedDateObj.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button type="button" onClick={() => changeMonth(-1)}>◀</button>
        <h2>{headerTitle}</h2>
        <button type="button" onClick={() => changeMonth(1)}>▶</button>
        <div className="view-buttons">
          <button type="button" onClick={() => setView("month")} className={view === "month" ? "active" : ""}>Miesiąc</button>
          <button type="button" onClick={() => setView("week")} className={view === "week" ? "active" : ""}>Tydzień</button>
          <button type="button" onClick={() => setView("day")} className={view === "day" ? "active" : ""}>Dzień</button>
        </div>
      </div>
      <div className="calendar-grid">
        {view === "month" && (
          <>
            <div className="calendar-weekdays">{["Nie", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"].map(day => <div key={day} className="weekday">{day}</div>)}</div>
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

function LeaderboardPanel({ leaderboard, currentUser }) {
  const [open, setOpen] = useState(true);
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

  const startEdit = (task) => { if (task.completed) return; setEditingId(task.id); setEditForm({ title: task.title, description: task.description || "", difficulty: task.difficulty, category: task.category, due_date: task.due_date }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const saveEdit = async (task) => {
    if (!editForm.title?.trim()) { onError("Tytuł jest wymagany"); return; }
    try {
      const payload = { title: editForm.title.trim(), description: editForm.description, ...(task.exp_awarded ? {} : { difficulty: editForm.difficulty, category: editForm.category, due_date: editForm.due_date }) };
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
              <div className="edit-actions"><button className="btn-save" onClick={() => saveEdit(task)}>✓ Zapisz</button><button className="btn-cancel-edit" onClick={cancelEdit}>✗ Anuluj</button></div>
            </div>
          ) : (
            <>
              {task.completed ? <div className="task-check checked locked" title="Ukończone - tylko usunięcie">✓</div> : <button className="task-check" onClick={() => onToggle(task)}></button>}
              <div className="task-info">
                <h4 className={task.completed ? "done" : ""}>{task.title}</h4>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>
                  <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>
                  <span className="badge exp">{task.exp_awarded ? `✓ +${task.exp_awarded_amount || EXP_MAP[task.difficulty]} EXP` : `+${task.exp_preview ?? getExpPreview(task.difficulty, task.due_date).amount} EXP`}</span>
                  {!task.exp_awarded && (() => { const t = task.exp_timing_preview ?? getExpPreview(task.difficulty, task.due_date).timing; const info = EXP_TIMING_LABELS[t]; return info ? <span className={`badge timing ${info.className}`}>{info.text}</span> : null; })()}
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

function Profile({ user, onLogout, onDeleteAccount, achievements }) {
  const [showAchievements, setShowAchievements] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const unlocked = achievements?.unlocked ?? [];
  const nextAch = achievements?.next;

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
  const [levelThresholds, setLevelThresholds] = useState(DEFAULT_LEVEL_THRESHOLDS);
  const [challenges, setChallenges] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [toast, setToast] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddTask, setShowAddTask] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [category, setCategory] = useState("Inne");
  const [taskDate, setTaskDate] = useState(toDateStr(new Date()));

  const headers = { Authorization: `Bearer ${token}` };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [userRes, tasksRes, achRes, chRes, lbRes, levelsRes] = await Promise.all([
        axios.get(`${API}/me`, { headers }), axios.get(`${API}/tasks`, { headers }), axios.get(`${API}/achievements`, { headers }),
        axios.get(`${API}/challenges`, { headers }), axios.get(`${API}/leaderboard`, { headers }), axios.get(`${API}/game/levels`, { headers }).catch(() => ({ data: null })),
      ]);
      const oldCount = achievements.unlocked?.length || 0;
      const newUnlocked = achRes.data.unlocked || [];
      if (newUnlocked.length > oldCount) { const newest = newUnlocked[newUnlocked.length - 1]; showToast(`🏆 Odblokowano: ${newest.title}! ${newest.icon}`); }
      setUser(userRes.data); setTasks(tasksRes.data); setAchievements(newUnlocked.length ? { unlocked: newUnlocked, next: achRes.data.next } : achRes.data);
      if (levelsRes.data?.length) setLevelThresholds(levelsRes.data.map(l => l.threshold));
      setChallenges(chRes.data); setLeaderboard(lbRes.data);
      try { const rareDropRes = await axios.post(`${API}/rare-drops/claim-daily`, {}, { headers }); if (rareDropRes.data.status === "success") showToast(`✨ ${rareDropRes.data.message}`); } catch (e) {}
    } catch (err) { console.error("Fetch error:", err); localStorage.removeItem("token"); setToken(null); }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);
  useEffect(() => { setTaskDate(toDateStr(selectedDate)); }, [selectedDate]);

  const addTask = async () => {
    if (!title.trim()) { showToast("Podaj nazwę zadania"); return; }
    try {
      await axios.post(`${API}/tasks`, { title, description: desc, difficulty, category, due_date: taskDate }, { headers });
      setTitle(""); setDesc(""); setShowAddTask(false); fetchData(); showToast(`✅ Dodano quest na ${taskDate}`);
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
      <div className="header"><h1>⚔️ QuestDo</h1><Profile user={user} onLogout={logout} onDeleteAccount={deleteAccount} achievements={achievements} /></div>
      <div className="profile-card">
        <div className="avatar">{user.username[0].toUpperCase()}</div>
        <div className="profile-info"><h2>Poziom {user.level}</h2><div className="title">{user.title}</div><div className="exp-bar-bg"><div className="exp-bar" style={{ width: `${progress}%` }} /></div><div className="exp-text">{user.exp} EXP</div>{user.next_level_title && <div className="level-next-hint">Do "{user.next_level_title}": {user.next_level_exp} EXP</div>}{user.exp_tip && <p className="exp-tip">{user.exp_tip}</p>}</div>
        <div className="streak"><div className="flame">🔥</div><div className="count">{user.streak}</div><div className="label">seria</div></div>
      </div>
      <ChallengesBar challenges={challenges} />
      <LeaderboardPanel leaderboard={leaderboard} currentUser={user.username} />
      <Calendar tasks={tasks} selectedDate={selectedDate} onDateSelect={(dateStr) => setSelectedDate(new Date(dateStr + "T12:00:00"))} onTaskToggle={toggleTask} onTaskDelete={deleteTask} />
      {!showAddTask ? <button className="add-task-btn" onClick={() => setShowAddTask(true)}>+ Dodaj zadanie</button> : (
        <div className="add-task"><h3>+ Nowy Quest na {taskDate}</h3><input placeholder="Nazwa zadania..." value={title} onChange={(e) => setTitle(e.target.value)} /><textarea placeholder="Opis..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="add-task-meta">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">⚔️ Łatwe (+10 EXP)</option><option value="medium">🗡️ Średnie (+25 EXP)</option><option value="hard">💀 Trudne (+50 EXP)</option></select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}</select>
            <DatePicker value={taskDate} onChange={setTaskDate} label="Termin" />
          </div>
          {(() => { const p = getExpPreview(difficulty, taskDate); const info = EXP_TIMING_LABELS[p.timing]; return <p className="exp-preview-hint">Ukończ dziś: <strong>+{p.amount} EXP</strong> ({info.text})</p>; })()}
          <div className="row"><button onClick={addTask}>Dodaj Quest</button><button onClick={() => setShowAddTask(false)} className="cancel-btn">Anuluj</button></div>
        </div>
      )}
      <DayTasksPanel selectedDate={selectedDate} tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} onSave={saveTask} onError={showToast} />
      {toast && <Toast message={toast} />}
    </div>
  );
}