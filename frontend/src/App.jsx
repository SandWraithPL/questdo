/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import "./index.css";
import DatePicker from "./DatePicker";
import AppTabs, { readMainTab } from "./AppTabs";
import ShoppingPanel from "./ShoppingPanel";
import SchedulePanel from "./SchedulePanel";
import EarningsPanel from "./EarningsPanel";
import CategoriesPanel from "./CategoriesPanel";
import FamilyPanel from "./FamilyPanel";
import RecurringPanel from "./RecurringPanel";
import FamilyInvitationsBanner from "./FamilyInvitationsBanner";
import { getRecurringCategoriesForDate, toVirtualRecurringTasks } from "./recurringHelpers";
import { useEditItem } from "./hooks/useEditItem";

const API = "https://questdo-backend.onrender.com";

const DEFAULT_LEVEL_THRESHOLDS = [
  0, 80, 180, 320, 480, 660, 860, 1080, 1320, 1600, 1900, 2250, 2650, 3100, 3600,
  4150, 4750, 5400, 6100, 7000,
];
const DEFAULT_LEVELS_META = [
  { threshold: 0, level: 1, title: "Kadet" },
  { threshold: 80, level: 2, title: "Rekrut" },
  { threshold: 180, level: 3, title: "Zwiadowca" },
  { threshold: 320, level: 4, title: "Żołnierz" },
  { threshold: 480, level: 5, title: "As" },
  { threshold: 660, level: 6, title: "Taktyk" },
  { threshold: 860, level: 7, title: "Rywal" },
  { threshold: 1080, level: 8, title: "Weteran w drodze" },
  { threshold: 1320, level: 9, title: "W treningu" },
  { threshold: 1600, level: 10, title: "Mistrz rytmu" },
  { threshold: 1900, level: 11, title: "Uczeń" },
  { threshold: 2250, level: 12, title: "Rycerz" },
  { threshold: 2650, level: 13, title: "W przebiegu" },
  { threshold: 3100, level: 14, title: "Strażnik" },
  { threshold: 3600, level: 15, title: "W cieniu" },
  { threshold: 4150, level: 16, title: "Architekt" },
  { threshold: 4750, level: 17, title: "Teoretyk" },
  { threshold: 5400, level: 18, title: "Decydent" },
  { threshold: 6100, level: 19, title: "W zasięgu" },
  { threshold: 7000, level: 20, title: "Legenda" },
];
const NOTIFICATIONS_PREF_KEY = "questdo-notifications-enabled";
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

// Cache dla poziomów (optymalizacja)
const LEVELS_CACHE_KEY = "questdo-levels-cache";
const LEVELS_CACHE_DURATION = 24 * 60 * 60 * 1000;

const getCachedLevels = () => {
  try {
    const cached = localStorage.getItem(LEVELS_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < LEVELS_CACHE_DURATION) {
        return data;
      }
    }
  } catch { /* ignore */ }
  return null;
};

const setCachedLevels = (data) => {
  try {
    localStorage.setItem(LEVELS_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch { /* ignore */ }
};

function getExpPreview(difficulty, dueDateStr) {
  const base = EXP_MAP[difficulty] || 10;
  const today = toDateStr(new Date());
  if (today < dueDateStr) {
    return { amount: Math.max(1, Math.floor(base * 1.5)), timing: "early", base };
  }
  if (today > dueDateStr) {
    return { amount: Math.max(1, Math.floor(base * 0.5)), timing: "late", base };
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

const EVENT_CATEGORIES = [
  { value: "birthday", emoji: "🎂", label: "Urodziny" },
  { value: "anniversary", emoji: "💍", label: "Rocznica" },
  { value: "holiday", emoji: "🎉", label: "Święto" },
  { value: "reminder", emoji: "🔔", label: "Przypomnienie" },
];

// Komponent FreeDayManager - wspólny dla wszystkich kalendarzy
function FreeDayManager({ freeDays, setFreeDays, selectedDate, api, headers, onToast, enqueueRequest }) {
  const [showFreeDayManager, setShowFreeDayManager] = useState(false);
  const [freeDayType, setFreeDayType] = useState("holiday");
  const [freeDayName, setFreeDayName] = useState("");

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  const handleCreateFreeDay = () => {
    if (enqueueRequest) {
      enqueueRequest(async () => {
        try {
          const res = await axios.post(`${api}/free-days`, {
            date: selectedStr,
            day_type: freeDayType,
            notes: freeDayName
          }, { headers });
          if (setFreeDays) {
            setFreeDays(prev => [...prev, res.data]);
          }
          setFreeDayName("");
          setShowFreeDayManager(false);
          onToast("✅ Oznaczono dzień jako wolny");
        } catch (err) {
          onToast(err.response?.data?.detail || "Błąd oznaczania dnia");
        }
      });
    } else {
      // Fallback bez queue
      axios.post(`${api}/free-days`, {
        date: selectedStr,
        day_type: freeDayType,
        notes: freeDayName
      }, { headers }).then(res => {
        if (setFreeDays) {
          setFreeDays(prev => [...prev, res.data]);
        }
        setFreeDayName("");
        setShowFreeDayManager(false);
        onToast("✅ Oznaczono dzień jako wolny");
      }).catch(err => {
        onToast(err.response?.data?.detail || "Błąd oznaczania dnia");
      });
    }
  };

  const handleDeleteFreeDay = () => {
    const existingFreeDay = freeDays.find(fd => fd.date === selectedStr);
    if (!existingFreeDay) return;

    if (enqueueRequest) {
      enqueueRequest(async () => {
        try {
          await axios.delete(`${api}/free-days/${existingFreeDay.id}`, { headers });
          if (setFreeDays) {
            setFreeDays(prev => prev.filter(fd => fd.id !== existingFreeDay.id));
          }
          onToast("🗑️ Usunięto oznaczenie dnia wolnego");
        } catch (err) {
          onToast(err.response?.data?.detail || "Błąd usuwania oznaczenia");
        }
      });
    } else {
      axios.delete(`${api}/free-days/${existingFreeDay.id}`, { headers }).then(() => {
        if (setFreeDays) {
          setFreeDays(prev => prev.filter(fd => fd.id !== existingFreeDay.id));
        }
        onToast("🗑️ Usunięto oznaczenie dnia wolnego");
      }).catch(err => {
        onToast(err.response?.data?.detail || "Błąd usuwania oznaczenia");
      });
    }
  };

  const existingFreeDay = freeDays.find(fd => fd.date === selectedStr);

  return (
    <>
      <button
        type="button"
        className="icon-btn free-day-btn"
        onClick={() => setShowFreeDayManager(!showFreeDayManager)}
        title="Zarządzaj dniami wolnymi"
        aria-label="Zarządzaj dniami wolnymi"
      >
        🎓
      </button>
      {showFreeDayManager && (
        <div className="add-task free-day-manager">
          <h3>🎓 Zarządzaj dniami wolnymi</h3>
          {existingFreeDay ? (
            <div>
              <p>Ten dzień jest oznaczony jako: <strong>
                {existingFreeDay.day_type === "holiday" ? "Święto" :
                 existingFreeDay.day_type === "deans_day" ? "Dzień dziekański" : "Dzień rektorski"}
              </strong>
              {existingFreeDay.notes && <span> — {existingFreeDay.notes}</span>}</p>
              <div className="row" style={{ marginTop: 12, gap: "8px" }}>
                <button type="button" className="danger-btn" onClick={handleDeleteFreeDay}>🗑️ Usuń oznaczenie</button>
                <button type="button" className="cancel-btn" onClick={() => setShowFreeDayManager(false)}>Anuluj</button>
              </div>
            </div>
          ) : (
            <>
              <select value={freeDayType} onChange={(e) => setFreeDayType(e.target.value)}>
                <option value="holiday">🎉 Święto</option>
                <option value="deans_day">🎓 Dzień dziekański</option>
                <option value="rector_day">🏛️ Dzień rektorski</option>
              </select>
              <input
                placeholder="Nazwa święta (opcjonalne)"
                value={freeDayName}
                onChange={(e) => setFreeDayName(e.target.value)}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="add-task-btn" onClick={handleCreateFreeDay}>Oznacz dzień</button>
                <button type="button" className="cancel-btn" onClick={() => setShowFreeDayManager(false)}>Anuluj</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const RECURRING_PATTERNS = [
  { value: "", label: "Brak cyklu" },
  { value: "yearly", label: "Co rok" },
  { value: "monthly", label: "Co miesiąc" },
  { value: "weekly", label: "Co tydzień" },
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

function getEventCategoryEmoji(cat) {
  return EVENT_CATEGORIES.find((c) => c.value === cat)?.emoji || "📅";
}

function getEventCategoryLabel(cat) {
  return EVENT_CATEGORIES.find((c) => c.value === cat)?.label || "Inne";
}

function getReminderLabel(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return REMINDER_OPTIONS.find((o) => o.value === normalized)?.label || "Przypomnienie";
}

function parseReminderValue(value) {
  return value === "" ? null : Number(value);
}

function formatHistoryDate(value) {
  if (!value) return "";
  const normalized = String(value).replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function getExpProgress(exp, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
  let current = 0;
  let next = thresholds[1] || 100;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (exp >= thresholds[i]) {
      current = thresholds[i];
      next = thresholds[i + 1] ?? thresholds[i];
      break;
    }
  }
  const progress = next === current ? 100 : (exp / next) * 100;
  return { progress, current, next };
}

function getGamificationFromExp(exp, levelsMeta = DEFAULT_LEVELS_META, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
  const meta = levelsMeta?.length ? levelsMeta : DEFAULT_LEVELS_META;
  const thresh = thresholds?.length ? thresholds : DEFAULT_LEVEL_THRESHOLDS;
  let level = meta[0]?.level ?? 1;
  let title = meta[0]?.title ?? "Kadet";
  let nextLevelExp = null;
  let nextLevelTitle = null;
  for (let i = meta.length - 1; i >= 0; i--) {
    if (exp >= meta[i].threshold) {
      level = meta[i].level;
      title = meta[i].title;
      if (meta[i + 1]) {
        nextLevelExp = meta[i + 1].threshold;
        nextLevelTitle = meta[i + 1].title;
      }
      break;
    }
  }
  const { progress } = getExpProgress(exp, thresh);
  return { level, title, next_level_exp: nextLevelExp, next_level_title: nextLevelTitle, progress };
}

function readNotificationsPreference() {
  try {
    if (localStorage.getItem(NOTIFICATIONS_PREF_KEY) === "0") return false;
  } catch {
    /* ignore */
  }
  return "Notification" in window && Notification.permission === "granted";
}

function writeNotificationsPreference(enabled) {
  try {
    localStorage.setItem(NOTIFICATIONS_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function Toast({ toasts, onRemove }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner({ label = "Ładowanie…" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      {label && <p>{label}</p>}
    </div>
  );
}

function canUncheckTask(task) {
  if (!task.completed || !task.completed_at) return false;
  const completedAt = new Date(task.completed_at);
  const hoursSinceCompletion = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceCompletion < 24;
}

function getTaskCheckState(task) {
  if (!task.completed) {
    return { className: "", title: "Oznacz jako ukończone", disabled: false, showUncheckBadge: false };
  }
  if (canUncheckTask(task)) {
    return {
      className: "checked uncheckable",
      title: "Można odznaczyć (24h)",
      disabled: false,
      showUncheckBadge: true,
    };
  }
  return {
    className: "checked locked",
    title: "Nie można odznaczyć (minęło więcej niż 24h)",
    disabled: true,
    showUncheckBadge: false,
  };
}

const REMINDER_HOUR = 9;
const REMINDER_GRACE_MS = 24 * 60 * 60 * 1000;

function getReminderFireTime(task) {
  if (task.reminder_offset_days === null || task.reminder_offset_days === undefined) return null;
  const offset = Number(task.reminder_offset_days);
  if (Number.isNaN(offset)) return null;
  const parts = String(task.due_date).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  const dueAtNine = new Date(year, month - 1, day, REMINDER_HOUR, 0, 0, 0);
  const fireAt = new Date(dueAtNine);
  fireAt.setDate(fireAt.getDate() - offset);
  return fireAt;
}

function getReminderStorageKey(task) {
  const fireAt = getReminderFireTime(task);
  const fireDay = fireAt ? toDateStr(fireAt) : "unknown";
  return `questdo-reminded-${task.id}-${task.due_date}-${task.reminder_offset_days}-${fireDay}`;
}

function isWithinReminderGracePeriod(fireTimeMs, nowMs = Date.now()) {
  return nowMs >= fireTimeMs && nowMs < fireTimeMs + REMINDER_GRACE_MS;
}

function buildReminderBody(task) {
  return task.important
    ? `Ważny quest: „${task.title}" · termin ${task.due_date}`
    : `Przypomnienie: zadanie „${task.title}" ma termin ${task.due_date}`;
}

async function fireTaskReminder(task) {
  const storageKey = getReminderStorageKey(task);
  if (localStorage.getItem(storageKey)) return false;
  localStorage.setItem(storageKey, "1");
  await showAppNotification(buildReminderBody(task), {
    tag: storageKey,
    data: { url: `/?date=${task.due_date}`, taskId: task.id },
  });
  return true;
}

async function processMissedTaskReminders(tasks) {
  if (!readNotificationsPreference()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  for (const task of tasks) {
    if (task.completed) continue;
    const fireAt = getReminderFireTime(task);
    if (!fireAt) continue;
    const fireTime = fireAt.getTime();
    if (!isWithinReminderGracePeriod(fireTime, now)) continue;
    await fireTaskReminder(task);
  }
}

function scheduleTaskReminders(tasks) {
  if (!readNotificationsPreference()) return [];
  const timers = [];
  const now = Date.now();
  tasks.forEach((task) => {
    if (task.completed) return;
    const fireAt = getReminderFireTime(task);
    if (!fireAt) return;
    const fireTime = fireAt.getTime();
    const storageKey = getReminderStorageKey(task);
    if (localStorage.getItem(storageKey)) return;

    if (fireTime > now) {
      const delay = fireTime - now;
      if (delay > 0 && delay <= 2147483647) {
        timers.push(setTimeout(() => { fireTaskReminder(task); }, delay));
      }
      return;
    }
    if (isWithinReminderGracePeriod(fireTime, now)) {
      fireTaskReminder(task);
    }
  });
  return timers;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData], (char) => char.charCodeAt(0));
}

function isStandalonePwa() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function subscribeToWebPush(authHeaders) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { ok: false, reason: "unsupported" };
  try {
    const { data } = await axios.get(`${API}/push/vapid-public-key`, { headers: authHeaders });
    if (!data?.publicKey) return { ok: false, reason: "server" };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }
    await axios.post(`${API}/push/subscribe`, sub.toJSON(), { headers: authHeaders });
    return { ok: true, reason: "subscribed" };
  } catch (err) {
    console.error("[push] subscribe failed:", err);
    return { ok: false, reason: "error" };
  }
}

async function unsubscribeFromWebPush(authHeaders) {
  try {
    await axios.delete(`${API}/push/subscribe`, { headers: authHeaders });
  } catch (err) {
    console.error("[push] backend unsubscribe failed:", err);
  }
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch (err) {
    console.error("[push] browser unsubscribe failed:", err);
  }
}

const PWA_HINT_DISMISSED_KEY = "questdo-pwa-hint-dismissed";
const PWA_HINT_COLLAPSED_KEY = "questdo-pwa-hint-collapsed";

function readPwaHintDismissed() {
  try {
    return localStorage.getItem(PWA_HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function readPwaHintCollapsed() {
  try {
    return localStorage.getItem(PWA_HINT_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

async function showAppNotification(body, options = {}) {
  if (!readNotificationsPreference()) return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const notificationOptions = {
    body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: options.tag,
    data: options.data || { url: "/" },
  };
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(NOTIFICATION_TITLE, notificationOptions);
      return true;
    }
  }
  new Notification(NOTIFICATION_TITLE, notificationOptions);
  return true;
}

function reloadForNewServiceWorker() {
  if (sessionStorage.getItem("questdo-sw-reloading") === "1") return;
  sessionStorage.setItem("questdo-sw-reloading", "1");
  window.location.reload();
}

async function registerServiceWorkerForUpdates() {
  if (!("serviceWorker" in navigator)) return undefined;

  let refreshing = false;
  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    reloadForNewServiceWorker();
  };
  const onMessage = (event) => {
    if (event.data?.type === "QUESTDO_SW_ACTIVATED" && navigator.serviceWorker.controller) {
      reloadForNewServiceWorker();
    }
  };

  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  navigator.serviceWorker.addEventListener("message", onMessage);

  const registration = await navigator.serviceWorker.register("/sw.js?v=questdo-v8", { updateViaCache: "none" });
  sessionStorage.removeItem("questdo-sw-reloading");

  const activateWaitingWorker = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      registration.waiting.postMessage({ type: "QUESTDO_SKIP_WAITING" });
    }
  };

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "QUESTDO_SKIP_WAITING" });
      }
    });
  });

  activateWaitingWorker();
  registration.update().catch((err) => console.error("SW update error:", err));

  const interval = window.setInterval(() => {
    registration.update().catch((err) => console.error("SW update error:", err));
  }, 5 * 60 * 1000);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      registration.update().catch((err) => console.error("SW update error:", err));
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.removeEventListener("message", onMessage);
  };
}

function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    if (!cleanUsername) {
      setError("Nazwa użytkownika jest wymagana");
      return;
    }
    if (!cleanPassword) {
      setError("Hasło jest wymagane");
      return;
    }
    if (isRegister && cleanPassword.length < 3) {
      setError("Hasło musi mieć min. 3 znaki");
      return;
    }
    try {
      if (isRegister) {
        await axios.post(`${API}/register`, { username: cleanUsername, password: cleanPassword });
      }
      const form = new URLSearchParams();
      form.append("username", cleanUsername);
      form.append("password", cleanPassword);
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

const CALENDAR_COLLAPSED_KEY = "questdo-calendar-collapsed";
const CHALLENGES_COLLAPSED_KEY = "questdo-challenges-collapsed";
const NOTIFICATION_ICON = "/notification-icon.svg";
const NOTIFICATION_TITLE = "QuestDo";

function readChallengesCollapsedPreference() {
  try {
    const saved = localStorage.getItem(CHALLENGES_COLLAPSED_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    /* ignore */
  }
  return false;
}

function readCalendarCollapsedPreference() {
  try {
    const saved = localStorage.getItem(CALENDAR_COLLAPSED_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    /* ignore */
  }
  return true;
}

function Calendar({ tasks, recurringEvents = [], selectedDate, onDateSelect, onTaskToggle, onTaskDelete, freeDays = [], onFreeDayChange }) {
  const [cursor, setCursor] = useState(() => selectedDate instanceof Date ? selectedDate : new Date());
  const [view, setView] = useState("month");
  const [collapsed, setCollapsed] = useState(readCalendarCollapsedPreference);
  const selectedStr = toDateStr(selectedDate);
  const selectedDateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedStr + "T12:00:00");

  const getFreeDayType = (dateStr) => {
    const freeDay = freeDays.find(fd => fd.date === dateStr);
    return freeDay ? freeDay.day_type : null;
  };

  const getTasksForDate = (dateStr) => {
    const dayTasks = tasks.filter((t) => t.due_date === dateStr);
    const virtual = toVirtualRecurringTasks(recurringEvents, dateStr, dayTasks);
    return [...dayTasks, ...virtual];
  };
  const taskStats = (dateStr) => {
    const dayTasks = tasks.filter((t) => t.due_date === dateStr);
    const quests = dayTasks.filter((t) => t.task_type !== "event");
    const events = dayTasks.filter((t) => t.task_type === "event");
    const eventCategories = getRecurringCategoriesForDate(recurringEvents, dateStr, dayTasks);
    return { 
      total: quests.length, 
      done: quests.filter((t) => t.completed).length,
      events,
      eventCategories,
    };
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

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CALENDAR_COLLAPSED_KEY, String(next));
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
      const stats = taskStats(dateStr);
      const isSelected = selectedStr === dateStr;
      const isToday = toDateStr(new Date()) === dateStr;
      const freeDayType = getFreeDayType(dateStr);
      days.push(
        <button key={dateStr} type="button" className={`calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${freeDayType ? `free-day free-day-${freeDayType}` : ""}`} onClick={() => selectDay(dateStr)}>
          <span className="day-number">{day}</span>
          {freeDayType === "holiday" && <span className="free-day-icon">🎉</span>}
          {freeDayType === "deans_day" && <span className="free-day-icon">🎓</span>}
          {freeDayType === "rector_day" && <span className="free-day-icon">🏛️</span>}
          {stats.eventCategories.length > 0 && (
            <div className="day-event-icons">
              {stats.eventCategories.slice(0, 3).map((cat, idx) => (
                <span key={idx} className="event-icon">{getEventCategoryEmoji(cat)}</span>
              ))}
              {stats.eventCategories.length > 3 && <span className="event-icon-more">+</span>}
            </div>
          )}
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
      const freeDayType = getFreeDayType(dateStr);
      days.push(
        <button key={dateStr} type="button" className={`week-day ${isSelected ? "week-day-selected" : ""} ${freeDayType ? `week-day-free week-day-free-${freeDayType}` : ""}`} onClick={() => selectDay(dateStr)}>
          <div className={`week-day-header ${isToday ? "today" : ""}`}>
            <span>{WEEKDAYS_LONG[i]}</span>
            <strong>{d.getDate()}</strong>
            {freeDayType === "holiday" && <span className="week-free-icon">🎉</span>}
            {freeDayType === "deans_day" && <span className="week-free-icon">🎓</span>}
            {freeDayType === "rector_day" && <span className="week-free-icon">🏛️</span>}
            <div className="week-day-stats">
              {stats.eventCategories.length > 0 && (
                <div className="week-event-icons">
                  {stats.eventCategories.slice(0, 2).map((cat, idx) => (
                    <span key={idx} className="event-icon">{getEventCategoryEmoji(cat)}</span>
                  ))}
                  {stats.eventCategories.length > 2 && <span className="event-icon-more">+</span>}
                </div>
              )}
              <em>{stats.total ? `${stats.done}/${stats.total}` : "0"}</em>
            </div>
          </div>
          <div className="week-day-tasks">
            {dayTasks.length === 0 && <span className="week-empty">Brak questów</span>}
            {dayTasks.slice(0, 4).map(task => (
              <div key={task.id} className={`week-task ${task.completed ? "completed" : ""} ${task.important ? "important" : ""} ${task.task_type === "event" ? "event" : ""}`}>
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
    const freeDayType = getFreeDayType(selectedStr);
    return (
      <div className="day-view">
        <h3>
          {selectedDateObj.toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {freeDayType === "holiday" && <span className="day-free-indicator"> 🎉 {freeDays.find(fd => fd.date === selectedStr)?.notes || "Święto"}</span>}
          {freeDayType === "deans_day" && <span className="day-free-indicator"> 🎓 Dzień dziekański</span>}
          {freeDayType === "rector_day" && <span className="day-free-indicator"> 🏛️ Dzień rektorski</span>}
        </h3>
        {dayTasks.length === 0 && <p className="empty">Brak zadań na ten dzień</p>}
        {dayTasks.map(task => {
          const isEvent = task.task_type === "event";
          const isVirtual = task.isRecurringVirtual;
          return (
            <div key={task.id} className={`day-task ${task.completed ? "completed" : ""} ${isEvent ? "event" : ""}`}>
              {!isEvent && (task.completed ? <div className="task-check checked locked">✓</div> : (
                <button type="button" className="task-check" onClick={() => onTaskToggle(task)} />
              ))}
              {isEvent && <div className="task-check event-indicator">{getEventCategoryEmoji(task.event_category)}</div>}
              <div className="day-task-info">
                <strong>{isEvent && <span className="event-mark">{getEventCategoryEmoji(task.event_category)} </span>}{task.important ? "Ważne · " : ""}{task.title}</strong>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  {isEvent && <span className="badge event-type">{getEventCategoryLabel(task.event_category)}</span>}
                  {isVirtual && <span className="badge recurring">🔄 Cykliczne</span>}
                  {!isEvent && <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>}
                  {!isEvent && <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>}
                  {isEvent && task.recurring_pattern && <span className="badge recurring">{task.recurring_pattern === "yearly" ? "🔄 Co rok" : task.recurring_pattern === "monthly" ? "🔄 Co miesiąc" : "🔄 Co tydzień"}</span>}
                  {task.reminder_offset_days !== null && task.reminder_offset_days !== undefined && <span className="badge reminder">{getReminderLabel(task.reminder_offset_days)}</span>}
                </div>
              </div>
              {!isVirtual && <button type="button" className="icon-btn delete" onClick={() => onTaskDelete(task)}>🗑</button>}
            </div>
          );
        })}
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

  const selectedDayStats = taskStats(selectedStr);
  const selectedDayLabel = selectedDateObj.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const selectedDayMeta = selectedDayStats.total > 0
    ? `${selectedDayStats.done}/${selectedDayStats.total} questów`
    : "brak questów";

  return (
    <section className={`calendar-section ${collapsed ? "calendar-section--collapsed" : "calendar-section--expanded"}`}>
      <div className="calendar-section-bar">
        <button
          type="button"
          className="calendar-section-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="questdo-calendar-body"
        >
          <span className="calendar-section-title">📅 Kalendarz</span>
          <span className="calendar-section-meta">{selectedDayLabel} · {selectedDayMeta}</span>
          <span className="calendar-section-chevron" aria-hidden="true">{collapsed ? "▼" : "▲"}</span>
        </button>
        {collapsed && (
          <button type="button" className="calendar-section-today" onClick={goToday}>
            Dzisiaj
          </button>
        )}
      </div>
      {!collapsed && (
      <div id="questdo-calendar-body" className="calendar-container">
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
        {onFreeDayChange && (
          <FreeDayManager
            freeDays={freeDays}
            setFreeDays={onFreeDayChange}
            selectedDate={selectedDate}
            api={API}
            headers={headers}
            onToast={() => {}}
            enqueueRequest={null}
          />
        )}
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
      )}
    </section>
  );
}

function PlayerSummary({ user, progress }) {
  return (
    <div className="profile-card profile-card--top">
      <div className="avatar">{user.username[0].toUpperCase()}</div>
      <div className="profile-info">
        <h2>Poziom {user.level}</h2>
        <div className="title">{user.title}</div>
        <div className="exp-bar-bg"><div className="exp-bar" style={{ width: `${progress}%` }} /></div>
        <div className="exp-text">{user.exp} EXP</div>
        {user.next_level_title && <div className="level-next-hint">Do &quot;{user.next_level_title}&quot;: {user.next_level_exp} EXP</div>}
        {user.exp_tip && <p className="exp-tip">{user.exp_tip}</p>}
      </div>
      <div className="streak">
        <div className="flame">🔥</div>
        <div className="count">{user.streak}</div>
        <div className="label">seria</div>
      </div>
    </div>
  );
}

function ChallengesBar({ challenges }) {
  const [collapsed, setCollapsed] = useState(readChallengesCollapsedPreference);
  if (!challenges?.goals?.length) return null;
  const bonusExp = challenges.triple_bonus_exp || 35;
  const completedGoals = challenges.goals.filter((g) => g.done || g.current >= g.target).length;
  
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

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHALLENGES_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <section className={`challenges-section ${collapsed ? "challenges-section--collapsed" : "challenges-section--expanded"}`}>
      <button
        type="button"
        className="challenges-section-toggle"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="questdo-challenges-body"
      >
        <span className="challenges-section-title">🎯 Wyzwania na dziś</span>
        <span className="challenges-section-meta">{completedGoals}/{challenges.goals.length} ukończone</span>
        <span className="challenges-section-chevron" aria-hidden="true">{collapsed ? "▼" : "▲"}</span>
      </button>
      {!collapsed && (
        <div id="questdo-challenges-body" className="challenges-bar">
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
                <div key={g.id} className={`challenge-item ${done ? "done completed" : ""}`}>
                  <div className="challenge-row-top">
                    <span className="challenge-icon">{done ? "✅" : g.icon}</span>
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
      )}
    </section>
  );
}

function LeaderboardPanel({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [rankType, setRankType] = useState("exp");
  const [allRankings, setAllRankings] = useState({});
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingLoaded, setRankingLoaded] = useState(false);

  const categories = [
    { id: "exp", label: "🏆 EXP" },
    { id: "streak", label: "🔥 Seria" },
    { id: "achievements", label: "🏅 Osiągnięcia" },
    { id: "rare_drops", label: "✨ Znajdźki" },
    { id: "exclusive", label: "👑 Ekskluzywne" },
    { id: "completed", label: "✅ Ukończone" },
  ];

  const normalizeRankings = (data) => ({
    exp: data?.exp || [],
    streak: data?.streak || [],
    achievements: data?.achievements || [],
    rare_drops: data?.rare_drops || [],
    exclusive: data?.exclusive || data?.exclusive_achievements || [],
    completed: data?.completed || data?.completed_tasks || [],
  });

  const fetchAllRankings = async () => {
    setRankingLoading(true);
    try {
      const res = await axios.get(`${API}/rankings/all`);
      setAllRankings(normalizeRankings(res.data));
      setRankingLoaded(true);
    } catch (err) {
      console.error("Ranking error:", err);
      if (!rankingLoaded) setAllRankings({});
    }
    setRankingLoading(false);
  };

  useEffect(() => {
    fetchAllRankings();
  }, []);

  const currentRanking = allRankings[rankType] || [];
  const currentCategory = categories.find((cat) => cat.id === rankType);

  const toggleOpen = () => {
    if (!open && !rankingLoaded && !rankingLoading) {
      fetchAllRankings();
    }
    setOpen(!open);
  };

  const handleCategoryChange = (type) => setRankType(type);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      fetchAllRankings();
    }, 30000);
    return () => clearInterval(interval);
  }, [open]);
  
  return (
    <div className="leaderboard-panel">
      <button type="button" className="leaderboard-toggle" onClick={toggleOpen}>🏅 Rankingi {open ? "▲" : "▼"}</button>
      {open && (
        <div className="leaderboard-content">
          <div className="leaderboard-categories">
            {categories.map(cat => <button key={cat.id} className={`rank-cat-btn ${rankType === cat.id ? "active" : ""}`} onClick={() => handleCategoryChange(cat.id)}>{cat.label}</button>)}
          </div>
          {!rankingLoaded ? <LoadingSpinner label="Ładowanie rankingów…" /> : (
            <ol className="leaderboard-list">
              {currentRanking.map((item) => (
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
          )}
          {rankingLoaded && currentRanking.length === 0 && (
            <p className="leaderboard-empty">Brak danych dla rankingu: {currentCategory?.label || "ranking"}.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DayTasksPanel({ selectedDate, tasks, recurringEvents = [], onToggle, onDelete, onSave, onToast, onUncheck, loadingTaskIds, deletingTaskIds }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const saveItem = async (id, form) => {
    if (!form.title?.trim()) { onToast("Tytuł jest wymagany"); return; }
    try {
      const task = tasks.find(t => t.id === id);
      const payload = {
        title: form.title.trim(),
        description: form.description,
        important: !!form.important,
        reminder_offset_days: parseReminderValue(form.reminder_offset_days),
        task_type: form.task_type,
        event_category: form.event_category || null,
        recurring_pattern: form.recurring_pattern || null,
        recurring_end_date: form.recurring_end_date || null,
        ...(task?.exp_awarded ? {} : { difficulty: form.difficulty, category: form.category, due_date: form.due_date }),
      };
      await onSave(id, payload);
    } catch (e) { onToast(e.response?.data?.detail || "Błąd zapisu"); }
  };

  const { editingId, editForm, setEditForm, startEdit, cancelEdit, saveEdit } = useEditItem(saveItem);

  const handleToggleClick = (task) => {
    if (task.completed) {
      if (canUncheckTask(task) && onUncheck) {
        onUncheck(task);
      } else if (!canUncheckTask(task)) {
        onToast("Nie można odznaczyć tego zadania (minęło więcej niż 24h)");
      }
    } else {
      onToggle(task);
    }
  };

  const startEditItem = (task) => {
    if (task.completed) return;
    startEdit(task, {
      title: task.title,
      description: task.description || "",
      difficulty: task.difficulty,
      category: task.category,
      due_date: task.due_date,
      important: !!task.important,
      reminder_offset_days: task.reminder_offset_days ?? "",
      task_type: task.task_type || "quest",
      event_category: task.event_category || "",
      recurring_pattern: task.recurring_pattern || "",
      recurring_end_date: task.recurring_end_date || "",
    });
  };

  const dateStr = toDateStr(selectedDate);
  const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const baseDayTasks = useMemo(() => tasks.filter((t) => t.due_date === dateStr), [tasks, dateStr]);
  const virtualRecurring = useMemo(
    () => toVirtualRecurringTasks(recurringEvents, dateStr, baseDayTasks),
    [recurringEvents, dateStr, baseDayTasks],
  );
  const allTasksForDay = useMemo(() => [...baseDayTasks, ...virtualRecurring], [baseDayTasks, virtualRecurring]);

  const dayTasks = useMemo(() => {
    let list = allTasksForDay;
    if (filter === "done") list = list.filter((t) => t.completed);
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (typeFilter === "quest") list = list.filter((t) => t.task_type !== "event");
    if (typeFilter === "event") list = list.filter((t) => t.task_type === "event");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q));
    }
    return list;
  }, [allTasksForDay, filter, search, typeFilter]);

  const allDay = allTasksForDay;
  const doneCount = baseDayTasks.filter((t) => t.completed).length;
  const questCount = baseDayTasks.filter((t) => t.task_type !== "event").length;
  const percent = questCount ? Math.round((doneCount / questCount) * 100) : 0;

  return (
    <div className="day-tasks-panel">
      <div className="tasks-header"><h3>Questy · {dateLabel}</h3>
        <div className="filter-group">
          {["all", "active", "done"].map(f => <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "Wszystkie" : f === "active" ? "Aktywne" : "Ukończone"}</button>)}
        </div>
      </div>
      <input className="search-input" type="search" placeholder="🔍 Szukaj questa..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {questCount > 0 && (<div className="progress-wrap"><div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div><span>{percent}% ukończone ({doneCount}/{questCount})</span></div>)}
      <div className="stats-counter"><span>Wszystkich: <strong>{allDay.length}</strong></span><span>Ukończonych: <strong>{doneCount}</strong></span><span>Pozostało: <strong>{questCount - doneCount}</strong></span></div>
      {dayTasks.length === 0 && <div className="empty">{allDay.length ? "Brak questów pasujących do filtrów." : "Brak questów na ten dzień. Dodaj pierwszy! ⚔️"}</div>}
      {dayTasks.map((task) => {
        const checkState = getTaskCheckState(task);
        const isEvent = task.task_type === "event";
        const isVirtual = task.isRecurringVirtual;
        const editing = editingId === task.id;
        return (
        <div key={task.id} className={`task-card ${isEvent ? "event" : task.difficulty} ${task.completed ? "done" : ""} ${checkState.showUncheckBadge ? "can-uncheck" : ""}`}>
          {editing && !isVirtual ? (
            <div className="edit-mode">
              <input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Nazwa zadania" />
              <textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Opis" rows="2" />
              <select value={editForm.task_type || "quest"} onChange={(e) => setEditForm({ ...editForm, task_type: e.target.value })}>
                <option value="quest">⚔️ Quest (do wykonania)</option>
                <option value="event">📅 Wydarzenie (urodziny, notatka)</option>
              </select>
              {editForm.task_type !== "event" && !tasks.find(t => t.id === task.id)?.exp_awarded && (<>
                <select value={editForm.difficulty || "easy"} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}>
                  <option value="easy">⚔️ Łatwe (+10 EXP)</option><option value="medium">🗡️ Średnie (+25 EXP)</option><option value="hard">💀 Trudne (+50 EXP)</option>
                </select>
                <select value={editForm.category || "Inne"} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
                </select>
                <DatePicker value={editForm.due_date || ""} onChange={(due_date) => setEditForm({ ...editForm, due_date })} />
              </>)}
              {editForm.task_type === "event" && (
                <>
                  <select value={editForm.event_category || ""} onChange={(e) => setEditForm({ ...editForm, event_category: e.target.value })}>
                    <option value="">Wybierz kategorię wydarzenia</option>
                    {EVENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                  </select>
                  <select value={editForm.recurring_pattern || ""} onChange={(e) => setEditForm({ ...editForm, recurring_pattern: e.target.value })}>
                    {RECURRING_PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  {editForm.recurring_pattern && (
                    <DatePicker value={editForm.recurring_end_date || ""} onChange={(recurring_end_date) => setEditForm({ ...editForm, recurring_end_date })} label="Data końcowa cyklu (opcjonalne)" />
                  )}
                  <DatePicker value={editForm.due_date || ""} onChange={(due_date) => setEditForm({ ...editForm, due_date })} />
                </>
              )}
              <label className="important-toggle">
                <input type="checkbox" checked={!!editForm.important} onChange={(e) => setEditForm({ ...editForm, important: e.target.checked, reminder_offset_days: e.target.checked && editForm.reminder_offset_days === "" ? "7" : editForm.reminder_offset_days })} />
                <span>Ważne</span>
              </label>
              <select value={editForm.reminder_offset_days ?? ""} onChange={(e) => setEditForm({ ...editForm, reminder_offset_days: e.target.value })}>
                {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" className="save-mini" onClick={() => saveEdit(task)} disabled={loadingTaskIds.has(task.id)}>{loadingTaskIds.has(task.id) ? "⏳" : "✓"}</button>
              <button type="button" className="cancel-mini" onClick={cancelEdit}>✗</button>
            </div>
          ) : (
            <>
              {!isEvent && (
                <button
                  type="button"
                  className={`task-check ${checkState.className} ${loadingTaskIds.has(task.id) ? "loading" : ""}`}
                  disabled={checkState.disabled || loadingTaskIds.has(task.id)}
                  onClick={() => handleToggleClick(task)}
                  title={checkState.title}
                  aria-label={checkState.title}
                >
                  {loadingTaskIds.has(task.id) ? "⏳" : (task.completed ? "✓" : "")}
                </button>
              )}
              {isEvent && <div className="task-check event-indicator">{getEventCategoryEmoji(task.event_category)}</div>}
              <div className="task-info">
                <h4 className={task.completed ? "done" : ""}>{isEvent && <span className="event-mark">{getEventCategoryEmoji(task.event_category)} </span>}{task.important && <span className="important-mark">Ważne · </span>}{task.title}</h4>
                {task.description && <p className={task.completed ? "done-desc" : ""}>{task.description}</p>}
                <div className="task-meta">
                  {isEvent && <span className="badge event-type">{getEventCategoryLabel(task.event_category)}</span>}
                  {isVirtual && <span className="badge recurring">🔄 Cykliczne</span>}
                  {!isEvent && <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>}
                  {!isVirtual && !isEvent && <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>}
                  {!isEvent && !isVirtual && <span className="badge exp">{task.exp_awarded ? `✓ +${task.exp_awarded_amount || EXP_MAP[task.difficulty]} EXP` : `+${task.exp_preview ?? getExpPreview(task.difficulty, task.due_date).amount} EXP`}</span>}
                  {task.exp_awarded && task.exp_timing && !isVirtual && (() => { const info = EXP_TIMING_LABELS[task.exp_timing]; return info ? <span className={`badge timing ${info.className}`}>{info.text}</span> : null; })()}
                  {!task.exp_awarded && !isEvent && !isVirtual && (() => { const t = task.exp_timing_preview ?? getExpPreview(task.difficulty, task.due_date).timing; const info = EXP_TIMING_LABELS[t]; return info ? <span className={`badge timing ${info.className}`}>{info.text}</span> : null; })()}
                  {task.reminder_offset_days !== null && task.reminder_offset_days !== undefined && !isVirtual && <span className="badge reminder">{getReminderLabel(task.reminder_offset_days)}</span>}
                  {isEvent && task.recurring_pattern && !isVirtual && <span className="badge recurring">{task.recurring_pattern === "yearly" ? "🔄 Co rok" : task.recurring_pattern === "monthly" ? "🔄 Co miesiąc" : "🔄 Co tydzień"}</span>}
                  {checkState.showUncheckBadge && <span className="badge uncheck-badge">↩️ Można odznaczyć (24h)</span>}
                  {task.completed && checkState.disabled && <span className="badge locked-badge">🔒 Zablokowane</span>}
                </div>
              </div>
              {!isVirtual && (
              <div className="task-actions">
                <button className="icon-btn" onClick={() => startEditItem(task)} disabled={loadingTaskIds.has(task.id)}>✏️</button>
                <button className="task-delete" onClick={() => onDelete(task)} disabled={deletingTaskIds.has(task.id)}>{deletingTaskIds.has(task.id) ? "⏳" : "🗑"}</button>
              </div>
              )}
            </>
          )}
        </div>
      );})}
    </div>
  );
}

function AdminPanel({ isOpen, onClose, headers, onRefreshAppData, onShowToast }) {
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

  const resetAllProgress = async () => {
    const confirmMsg = "Zresetować WSZYSTKO (osiągnięcia, znajdźki, serie, EXP i historię) dla wszystkich użytkowników? Ta operacja jest nieodwracalna.";
    if (!window.confirm(confirmMsg)) return;
    try {
      await axios.post(`${API}/admin/reset-all-progress`, {}, { headers });
      onShowToast("✅ Reset wykonano, dane odświeżone");
      await onRefreshAppData();
      onClose();
    } catch (err) {
      onShowToast(err.response?.data?.detail || "Błąd resetowania");
    }
  };

  useEffect(() => { if (isOpen) fetchData(); }, [isOpen]);

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
        {loading ? <LoadingSpinner label="Ładowanie panelu…" /> : error ? <p style={{ color: "#e74c3c" }}>{error}</p> : (
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
            <div className="admin-danger-zone">
              <p className="admin-danger-hint">Resetuje osiągnięcia, znajdźki, serie (streak), EXP (→ 0) i historię wszystkich użytkowników.</p>
              <button type="button" className="reset-progress-btn" onClick={resetAllProgress}>Resetuj wszystko</button>
            </div>
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

function PwaInstallBanner({ standalonePwa, onShowToast, onDismissForever }) {
  const [dismissed, setDismissed] = useState(readPwaHintDismissed);
  const [collapsed, setCollapsed] = useState(readPwaHintCollapsed);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (standalonePwa || dismissed) return null;

  const dismissForever = () => {
    try {
      localStorage.setItem(PWA_HINT_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    onDismissForever?.();
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PWA_HINT_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      promptEvent.prompt();
      await promptEvent.userChoice;
      deferredPromptRef.current = null;
      return;
    }
    onShowToast?.("Użyj menu przeglądarki: Dodaj do ekranu głównego / Zainstaluj aplikację");
  };

  return (
    <section className={`pwa-install-banner ${collapsed ? "pwa-install-banner--collapsed" : ""}`}>
      <div className="pwa-install-banner-bar">
        <button type="button" className="pwa-install-banner-toggle" onClick={toggleCollapsed} aria-expanded={!collapsed}>
          <span className="pwa-install-banner-title">📲 Zainstaluj QuestDo</span>
          <span className="pwa-install-banner-chevron" aria-hidden="true">{collapsed ? "▼" : "▲"}</span>
        </button>
        {!collapsed && (
          <button type="button" className="pwa-install-banner-dismiss" onClick={dismissForever} aria-label="Nie pokazuj więcej">
            ✕
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="pwa-install-banner-body">
          <p>
            Dodaj aplikację do ekranu głównego, aby otrzymywać przypomnienia o 09:00 także przy zamkniętej aplikacji.
          </p>
          <div className="pwa-install-banner-actions">
            <button type="button" className="pwa-install-banner-install" onClick={handleInstall}>
              Zainstaluj
            </button>
            <button type="button" className="pwa-install-banner-hide" onClick={dismissForever}>
              OK, nie pokazuj więcej
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Profile({
  user,
  onLogout,
  onDeleteAccount,
  achievements,
  rareDrops,
  history,
  onOpenAdmin,
  notificationsEnabled,
  notificationsUnsupported,
  isStandalonePwa: standalonePwa,
  pwaHintDismissed,
  onToggleNotifications,
}) {
  const [showAchievements, setShowAchievements] = useState(false);
  const [activeTab, setActiveTab] = useState("achievements");
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
          <div className="profile-notifications-block">
            <button
              type="button"
              className={`profile-notifications-btn ${notificationsEnabled ? "enabled" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleNotifications();
              }}
              disabled={notificationsUnsupported}
            >
              {notificationsEnabled ? "🔕 Wyłącz powiadomienia" : "🔔 Włącz powiadomienia"}
            </button>
            {!notificationsUnsupported && (
              <p className="profile-notifications-hint">
                {notificationsEnabled && standalonePwa && "Przypomnienia o 09:00 — także gdy aplikacja jest zamknięta."}
                {notificationsEnabled && !standalonePwa && !pwaHintDismissed && "Przypomnienia lokalne o 09:00 działają w tle. Zainstaluj aplikację — baner na stronie głównej."}
                {notificationsEnabled && !standalonePwa && pwaHintDismissed && "Przypomnienia o 09:00, gdy aplikacja jest otwarta lub w tle."}
                {!notificationsEnabled && "Włącz powiadomienia, aby dostawać przypomnienia o questach o 09:00."}
              </p>
            )}
            {notificationsUnsupported && (
              <p className="profile-notifications-hint">Ta przeglądarka nie obsługuje powiadomień.</p>
            )}
          </div>
          <div className="profile-tabs">
            <button type="button" className={activeTab === "achievements" ? "active" : ""} onClick={() => setActiveTab("achievements")}>Osiągnięcia</button>
            <button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>Historia</button>
          </div>
          {activeTab === "achievements" ? (
            <>
              {nextAch && (<div className="next-achievement"><h4>Następne osiągnięcie 🎯</h4><div className="achievement-item next"><span>{nextAch.icon}</span><div><strong>{nextAch.title}</strong><p>{nextAch.description}</p><p className="ach-progress">Postęp: {nextAch.progress}</p></div></div></div>)}
              <div className="achievements-list"><h4>Odznaczone 🏆 ({unlocked.length})</h4>{unlocked.length === 0 && <p className="muted">Jeszcze brak - pierwszy quest czeka!</p>}{unlocked.map(ach => (<div key={ach.slug || ach.title} className="achievement-item"><span>{ach.icon}</span><div><strong>{ach.title}</strong><p>{ach.description}</p></div></div>))}</div>
              <div className="rare-drops-list"><h4>Znajdźki ✨ ({rareDrops?.total_items || 0})</h4>{(!rareDrops?.items || rareDrops.items.length === 0) && <p className="muted">Jeszcze brak znajdziek - codziennie masz szansę!</p>}{rareDrops?.items?.map(drop => (<div key={drop.slug} className="rare-drop-item"><span className={`rare-drop-${drop.rarity}`}>{drop.icon}</span><div><strong>{drop.name}</strong><p>{drop.description}</p><p className="rare-drop-count">x{drop.count} · {drop.rarity}</p></div></div>))}</div>
            </>
          ) : (
            <div className="history-list"><h4>Dziennik zdobyczy</h4>{(!history || history.length === 0) && <p className="muted">Historia pojawi się po zdobyciu nagród.</p>}{history?.map(entry => (<div key={entry.id} className="history-item"><span><strong>{formatHistoryDate(entry.occurred_at)}</strong> - {entry.message}</span></div>))}</div>
          )}
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
  const [history, setHistory] = useState([]);
  const [levelThresholds, setLevelThresholds] = useState(DEFAULT_LEVEL_THRESHOLDS);
  const [levelsMeta, setLevelsMeta] = useState(DEFAULT_LEVELS_META);
  const [challenges, setChallenges] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddTask, setShowAddTask] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [category, setCategory] = useState("Inne");
  const [taskDate, setTaskDate] = useState(toDateStr(new Date()));
  const [important, setImportant] = useState(false);
  const [reminderOffset, setReminderOffset] = useState("");
  const [taskType, setTaskType] = useState("quest");
  const [eventCategory, setEventCategory] = useState("");
  const [recurringPattern, setRecurringPattern] = useState("");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(readNotificationsPreference);
  const [standalonePwa, setStandalonePwa] = useState(false);
  const notificationsUnsupported = !("Notification" in window);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [loadingTaskIds, setLoadingTaskIds] = useState(new Set());
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [deletingTaskIds, setDeletingTaskIds] = useState(new Set());
  const [mainTab, setMainTab] = useState(readMainTab);
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [workSummary, setWorkSummary] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [freeDays, setFreeDays] = useState([]);
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [familyInvitations, setFamilyInvitations] = useState([]);
  const [pwaHintDismissed, setPwaHintDismissed] = useState(readPwaHintDismissed);
  const apiQueue = useRef([]);
  const isProcessingQueue = useRef(false);

  const headers = { Authorization: `Bearer ${token}` };

  const enqueueRequest = async (requestFn) => {
    apiQueue.current.push({ fn: requestFn });
    if (!isProcessingQueue.current) {
      isProcessingQueue.current = true;
      while (apiQueue.current.length > 0) {
        const next = apiQueue.current.shift();
        await next.fn();
      }
      isProcessingQueue.current = false;
    }
  };

  const showToast = (msg) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message: msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const enableNotifications = async () => {
    const permission = await ensureNotificationPermission();
    const enabled = permission === "granted";
    if (!enabled) {
      writeNotificationsPreference(false);
      setNotificationsEnabled(false);
      showToast(permission === "unsupported" ? "Ta przeglądarka nie obsługuje powiadomień" : "Nie włączono powiadomień");
      return;
    }
    writeNotificationsPreference(true);
    setNotificationsEnabled(true);
    const push = await subscribeToWebPush(headers);
    processMissedTaskReminders(tasks);
    if (push.ok) {
      showToast(standalonePwa
        ? "Powiadomienia włączone — przypomnienia o 09:00 także przy zamkniętej aplikacji"
        : "Powiadomienia włączone — przypomnienia o 09:00 (push po zainstalowaniu PWA)");
    } else if (push.reason === "server") {
      showToast("Powiadomienia lokalne włączone (09:00). Push wymaga konfiguracji serwera VAPID.");
    } else {
      showToast("Powiadomienia włączone — przypomnienia o 09:00, gdy aplikacja jest otwarta lub w tle");
    }
  };

  const disableNotifications = async () => {
    writeNotificationsPreference(false);
    setNotificationsEnabled(false);
    await unsubscribeFromWebPush(headers);
    showToast("Powiadomienia wyłączone w aplikacji. Aby całkowicie wyłączyć powiadomienia w przeglądarce, zmień ustawienia (kliknij ikonę kłódki 🔒 w pasku adresu).");
  };

  const toggleNotifications = async () => {
    try {
      if (notificationsEnabled) {
        await disableNotifications();
      } else {
        await enableNotifications();
      }
    } catch (err) {
      console.error("[notifications] toggle failed:", err);
      showToast("Nie udało się zmienić ustawień powiadomień");
    }
  };

  useEffect(() => {
    setStandalonePwa(isStandalonePwa());
    const onDisplayMode = () => setStandalonePwa(isStandalonePwa());
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);
    return () => window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayMode);
  }, []);

  // Temporarily disable service worker
  /*
  useEffect(() => {
    const cleanup = registerServiceWorkerForUpdates();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);
  */

  useEffect(() => {
    if (!notificationsEnabled || !tasks.length) return undefined;

    processMissedTaskReminders(tasks);
    const timers = scheduleTaskReminders(tasks);

    const interval = window.setInterval(() => {
      processMissedTaskReminders(tasks);
    }, 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") processMissedTaskReminders(tasks);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      timers.forEach(clearTimeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tasks, notificationsEnabled]);

  const fetchData = async () => {
    if (!token) return;
    
    const noCacheHeaders = {
      ...headers,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    try {
      const shoppingParams = familyId ? { family_id: familyId } : {};
      
      // Poziomy z cache (optymalizacja)
      let levelsRes;
      const cachedLevels = getCachedLevels();
      if (cachedLevels) {
        levelsRes = { data: cachedLevels };
      } else {
        levelsRes = await axios.get(`${API}/game/levels`, { headers: noCacheHeaders }).catch(() => ({ data: null }));
        if (levelsRes.data) setCachedLevels(levelsRes.data);
      }
      
      const [userRes, tasksRes, chRes, rareDropsRes, scheduleRes, shoppingRes, workRes, workSummaryRes, freeDaysRes, recurringRes] = await Promise.all([
        axios.get(`${API}/me`, { headers: noCacheHeaders }),
        axios.get(`${API}/tasks`, { headers: noCacheHeaders }),
        axios.get(`${API}/challenges`, { headers: noCacheHeaders }),
        axios.get(`${API}/rare-drops/inventory`, { headers: noCacheHeaders }).catch(() => ({ data: null })),
        axios.get(`${API}/schedule`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API}/shopping`, { headers: noCacheHeaders, params: shoppingParams }).catch(() => ({ data: [] })),
        axios.get(`${API}/work`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API}/work/summary`, { headers: noCacheHeaders }).catch(() => ({ data: null })),
        axios.get(`${API}/free-days`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API}/recurring-events`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
      ]);
      const achRes = await axios.get(`${API}/achievements`, { headers: noCacheHeaders });
      const historyRes = await axios.get(`${API}/history`, { headers: noCacheHeaders }).catch(() => ({ data: [] }));
      
      const newUnlocked = achRes.data.unlocked || [];
      
      setUser(userRes.data);
      
      const sortedTasks = [...tasksRes.data].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return new Date(a.due_date) - new Date(b.due_date);
      });
      setTasks(sortedTasks);
      
      setAchievements(newUnlocked.length ? { unlocked: newUnlocked, next: achRes.data.next } : achRes.data);
      if (levelsRes.data?.length) {
        setLevelsMeta(levelsRes.data);
        setLevelThresholds(levelsRes.data.map((l) => l.threshold));
      }
      setChallenges(chRes.data);
      if (rareDropsRes.data) setRareDrops(rareDropsRes.data);
      setHistory(historyRes.data || []);
      setScheduleEntries(scheduleRes.data || []);
      setShoppingItems(shoppingRes.data || []);
      setWorkEntries(workRes.data || []);
      setWorkSummary(workSummaryRes.data || null);
      setFreeDays(freeDaysRes.data || []);
      setRecurringEvents(recurringRes.data || []);

      // Auto-generate holidays for years 2020-2030
      try {
        for (let year = 2020; year <= 2030; year++) {
          await axios.post(`${API}/free-days/generate/${year}`, {}, { headers: noCacheHeaders });
        }
      } catch (err) {
        // Ignore errors - holidays might already exist
        console.log("Holidays generation:", err.response?.status);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      localStorage.removeItem("token");
      setToken(null);
    }
  };

  useEffect(() => {
    let cleanup;
    registerServiceWorkerForUpdates().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => { if (token) fetchData(); }, [token]);
  useEffect(() => { setTaskDate(toDateStr(selectedDate)); }, [selectedDate]);
  useEffect(() => { if (token) fetchData(); }, [familyId]);

  const loadFamilyInvitations = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/family/invitations`, { headers });
      setFamilyInvitations(res.data);
    } catch (err) {
      console.error("Błąd ładowania zaproszeń:", err);
    }
  };

  useEffect(() => {
    loadFamilyInvitations();
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadFamilyInvitations();
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(new Date(`${dateParam}T12:00:00`));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    
    const pingBackend = async () => {
      try {
        await axios.get(`${API}/me`, { headers });
      } catch (err) {
        // ignoruj błędy – ping nie musi być potwierdzany
      }
    };
    
    const interval = setInterval(pingBackend, 300000);
    
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pingBackend();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [token]);

  const addTask = async () => {
    if (!title.trim()) { showToast("Podaj nazwę zadania"); return; }
    if (isAddingTask) return;

    setIsAddingTask(true);

    const apiPayload = {
      title,
      description: desc,
      difficulty: taskType === "quest" ? difficulty : "easy",
      category,
      due_date: taskDate,
      important,
      reminder_offset_days: parseReminderValue(reminderOffset),
      task_type: taskType,
      event_category: taskType === "event" ? eventCategory || null : null,
      recurring_pattern: taskType === "event" ? recurringPattern || null : null,
      recurring_end_date: taskType === "event" ? recurringEndDate || null : null,
    };

    setTitle("");
    setDesc("");
    setDifficulty("easy");
    setTaskType("quest");
    setImportant(false);
    setReminderOffset("");
    setEventCategory("");
    setRecurringPattern("");
    setRecurringEndDate("");
    setShowAddTask(false);

    enqueueRequest(async () => {
      try {
        await axios.post(`${API}/tasks`, apiPayload, { headers });
        await fetchData();
        showToast("✅ Zadanie dodane");
      } catch (err) {
        showToast(err.response?.data?.detail || "Błąd dodawania – spróbuj ponownie");
      } finally {
        setIsAddingTask(false);
      }
    });
  };

  const toggleTask = async (task) => {
    if (task.completed) return;
    if (loadingTaskIds.has(task.id)) return;

    setLoadingTaskIds(prev => new Set([...prev, task.id]));

    enqueueRequest(async () => {
      try {
        const response = await axios.patch(`${API}/tasks/${task.id}`, { completed: true }, { headers });
        const data = response.data;

        setUser(prev => ({
          ...prev,
          exp: data.exp,
          streak: data.streak,
          level: data.level,
          title: data.title,
          next_level_exp: data.next_level_exp,
          next_level_title: data.next_level_title,
        }));

        setTasks(prev => {
          const sorted = [...prev];
          const idx = sorted.findIndex(t => t.id === data.task.id);
          if (idx !== -1) {
            sorted[idx] = data.task;
          }
          return sorted.sort((a, b) => {
            if (a.completed !== b.completed) {
              return a.completed ? 1 : -1;
            }
            return new Date(a.due_date) - new Date(b.due_date);
          });
        });

        if (data.new_achievements && data.new_achievements.length > 0) {
          setAchievements(prev => ({
            ...prev,
            unlocked: [...(prev.unlocked || []), ...data.new_achievements],
          }));
        }

        if (data.earned_drop) {
          setRareDrops(prev => {
            if (!prev) return { total_items: 1, items: [data.earned_drop] };
            const existingItem = prev.items?.find(i => i.slug === data.earned_drop.slug);
            if (existingItem) {
              return {
                ...prev,
                items: prev.items.map(i => i.slug === data.earned_drop.slug ? { ...i, count: i.count + 1 } : i),
              };
            }
            return {
              ...prev,
              total_items: (prev.total_items || 0) + 1,
              items: [...(prev.items || []), data.earned_drop],
            };
          });
        }

        if (data.achievements) setAchievements(data.achievements);
        if (data.history) setHistory(data.history);

        const expPreview = getExpPreview(task.difficulty, task.due_date);
        const today = toDateStr(new Date());
        const timing = today < task.due_date ? "early" : today > task.due_date ? "late" : "ontime";
        showToast(`✅ Quest ukończony! +${expPreview.amount} EXP${expToastSuffix(timing)}`);

        const newAchievements = data.new_achievements || [];
        newAchievements.forEach((ach) => {
          showToast(`🏆 Osiągnięcie: ${ach.icon} ${ach.title}`);
        });

        const newExclusiveAchievements = data.new_exclusive_achievements || [];
        newExclusiveAchievements.forEach((ach) => {
          showToast(`⭐ Osiągnięcie ekskluzywne: ${ach.icon} ${ach.title}`);
        });

        if (data.earned_drop) {
          const drop = data.earned_drop;
          showToast(`💎 Znalazłeś: ${drop.icon} ${drop.name} (${drop.rarity})!`);
        }

        if (data.daily_bonus > 0) {
          showToast(`🎁 Bonus dzienny: +${data.daily_bonus} EXP`);
        }

        const challengesRes = await axios.get(`${API}/challenges`, { headers });
        setChallenges(challengesRes.data);
      } catch (err) {
        showToast(err.response?.data?.detail || "Błąd aktualizacji – spróbuj ponownie");
      } finally {
        setLoadingTaskIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(task.id);
          return newSet;
        });
      }
    });
  };

  const saveTask = async (id, updates) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Optimistic update
    const originalTask = { ...task };
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    enqueueRequest(async () => {
      try {
        const response = await axios.patch(`${API}/tasks/${id}`, updates, { headers });
        const data = response.data;
        
        if (data.exp !== undefined) {
          setUser(prev => ({
            ...prev,
            exp: data.exp,
            level: data.level,
            title: data.title,
            next_level_exp: data.next_level_exp,
            next_level_title: data.next_level_title,
            streak: data.streak,
          }));
        }
        
        if (data.task) {
          setTasks(prev => prev.map(t => t.id === id ? data.task : t));
        }
        
        if (data.achievements) setAchievements(data.achievements);
        if (data.history) setHistory(data.history);
        
        showToast("✅ Zadanie zapisane");
      } catch (err) {
        // Rollback optimistic update
        setTasks(prev => prev.map(t => t.id === id ? originalTask : t));
        showToast(err.response?.data?.detail || "Błąd zapisu – spróbuj ponownie");
      }
    });
  };

  const uncheckTask = async (task) => {
    if (!canUncheckTask(task)) {
      showToast("Nie można odznaczyć tego zadania (minęło więcej niż 24h)");
      return;
    }
    if (loadingTaskIds.has(task.id)) return;

    setLoadingTaskIds(prev => new Set([...prev, task.id]));

    enqueueRequest(async () => {
      try {
        const response = await axios.patch(`${API}/tasks/${task.id}`, { completed: false }, { headers });
        const data = response.data;

        setUser(prev => ({
          ...prev,
          exp: data.exp,
          streak: data.streak,
          level: data.level,
          title: data.title,
          next_level_exp: data.next_level_exp,
          next_level_title: data.next_level_title,
        }));

        setTasks(prev => {
          const sorted = [...prev];
          const idx = sorted.findIndex(t => t.id === data.task.id);
          if (idx !== -1) {
            sorted[idx] = data.task;
          }
          return sorted.sort((a, b) => {
            if (a.completed !== b.completed) {
              return a.completed ? 1 : -1;
            }
            return new Date(a.due_date) - new Date(b.due_date);
          });
        });

        if (data.revoked_achievements && data.revoked_achievements.length > 0) {
          setAchievements(prev => ({
            ...prev,
            unlocked: (prev.unlocked || []).filter(ach => 
              !data.revoked_achievements.some(rev => rev.slug === ach.slug || rev.title === ach.title)
            ),
          }));
        }

        if (data.earned_drop) {
          setRareDrops(prev => {
            if (!prev) return { total_items: 1, items: [data.earned_drop] };
            const existingItem = prev.items?.find(i => i.slug === data.earned_drop.slug);
            if (existingItem) {
              return {
                ...prev,
                items: prev.items.map(i => i.slug === data.earned_drop.slug ? { ...i, count: i.count + 1 } : i),
              };
            }
            return {
              ...prev,
              total_items: (prev.total_items || 0) + 1,
              items: [...(prev.items || []), data.earned_drop],
            };
          });
        }

        if (data.history) setHistory(data.history);
        if (data.achievements) setAchievements(data.achievements);
        if (data.rare_drops) setRareDrops(data.rare_drops);

        showToast("🔄 Cofnięto ukończenie zadania");

        const challengesRes = await axios.get(`${API}/challenges`, { headers });
        setChallenges(challengesRes.data);
      } catch (err) {
        showToast(err.response?.data?.detail || "Błąd aktualizacji – spróbuj ponownie");
      } finally {
        setLoadingTaskIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(task.id);
          return newSet;
        });
      }
    });
  };
  
  const deleteAccount = async (password, onDone) => { 
    if (!window.confirm("Na pewno usunąć konto?")) return; 
    try { 
      await axios.delete(`${API}/me`, { headers, data: { password } }); 
      localStorage.removeItem("token"); 
      setToken(null); 
      setUser(null); 
      showToast("Konto usunięte"); 
      onDone?.(); 
    } catch (err) { 
      showToast(err.response?.data?.detail || "Nie udało się usunąć konta"); 
    } 
  };
  
  const deleteTask = async (task) => {
    const exp = task.exp_awarded_amount || EXP_MAP[task.difficulty] || 10;
    if (task.exp_awarded && !window.confirm(`Usunąć ukończony quest "${task.title}"? Odejmie ${exp} EXP.`)) return;
    if (deletingTaskIds.has(task.id)) return;

    setDeletingTaskIds(prev => new Set([...prev, task.id]));

    enqueueRequest(async () => {
      try {
        const response = await axios.delete(`${API}/tasks/${task.id}`, { headers });
        const data = response.data;

        setUser(prev => ({
          ...prev,
          exp: data.exp,
          level: data.level,
          title: data.title,
          next_level_exp: data.next_level_exp,
          next_level_title: data.next_level_title,
        }));

        setTasks(prev => prev.filter(t => t.id !== task.id));

        if (data.achievements) setAchievements(data.achievements);
        if (data.history) setHistory(data.history);

        showToast("🗑️ Zadanie usunięte");
      } catch (err) {
        if (err.response?.status === 404) {
          showToast("Zadanie już nie istnieje");
          setTasks(prev => prev.filter(t => t.id !== task.id));
        } else {
          showToast(err.response?.data?.detail || "Błąd usuwania – spróbuj ponownie");
        }
      } finally {
        setDeletingTaskIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(task.id);
          return newSet;
        });
      }
    });
  };
  
  const logout = () => { localStorage.removeItem("token"); setToken(null); setUser(null); };
  const handleLogin = () => { const newToken = localStorage.getItem("token"); setToken(newToken); if (newToken) setTimeout(fetchData, 100); };

  const updateUserFromModule = (patch) => {
    setUser((prev) => ({ ...prev, ...patch }));
  };

  const handleDateSelect = (dateStr) => setSelectedDate(new Date(`${dateStr}T12:00:00`));

  if (!token) return <Auth onLogin={handleLogin} />;
  if (!user) return <div className="app"><LoadingSpinner label="Ładowanie questów…" /></div>;

  const { progress } = getGamificationFromExp(user.exp, levelsMeta, levelThresholds);

  return (
    <div className="app">
      <div className="header">
        <h1>⚔️ QuestDo</h1>
        <Profile
          user={user}
          onLogout={logout}
          onDeleteAccount={deleteAccount}
          achievements={achievements}
          rareDrops={rareDrops}
          history={history}
          onOpenAdmin={() => setShowAdminPanel(true)}
          notificationsEnabled={notificationsEnabled}
          notificationsUnsupported={notificationsUnsupported}
          isStandalonePwa={standalonePwa}
          pwaHintDismissed={pwaHintDismissed}
          onToggleNotifications={toggleNotifications}
        />
      </div>
      <PwaInstallBanner
        standalonePwa={standalonePwa}
        onShowToast={showToast}
        onDismissForever={() => setPwaHintDismissed(true)} 
      />
      <PlayerSummary user={user} progress={progress} />
      <AppTabs activeTab={mainTab} onTabChange={setMainTab} />

      {mainTab === "tasks" && (
        <>
      <ChallengesBar challenges={challenges} />
      <FamilyInvitationsBanner 
        api={API} 
        headers={headers} 
        onToast={showToast} 
        onFamilyChange={fetchData} 
      />
      <Calendar tasks={tasks} recurringEvents={recurringEvents} selectedDate={selectedDate} onDateSelect={handleDateSelect} onTaskToggle={toggleTask} onTaskDelete={deleteTask} freeDays={freeDays} onFreeDayChange={setFreeDays} />
      <DayTasksPanel selectedDate={selectedDate} tasks={tasks} recurringEvents={recurringEvents} onToggle={toggleTask} onDelete={deleteTask} onSave={saveTask} onToast={showToast} onUncheck={uncheckTask} loadingTaskIds={loadingTaskIds} deletingTaskIds={deletingTaskIds} />
      {!showAddTask ? <button className="add-task-btn" onClick={() => setShowAddTask(true)}>+ Dodaj zadanie</button> : (
        <div className="add-task"><h3>+ Nowy Quest na {taskDate}</h3><input placeholder="Nazwa zadania..." value={title} onChange={(e) => setTitle(e.target.value)} /><textarea placeholder="Opis..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="add-task-meta">
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)}><option value="quest">⚔️ Quest (do wykonania)</option><option value="event">📅 Wydarzenie (urodziny, notatka)</option></select>
            {taskType === "quest" && <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">⚔️ Łatwe (+10 EXP)</option><option value="medium">🗡️ Średnie (+25 EXP)</option><option value="hard">💀 Trudne (+50 EXP)</option></select>}
            {taskType === "event" && (
              <>
                <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)}>
                  <option value="">Wybierz kategorię wydarzenia</option>
                  {EVENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                </select>
              </>
            )}
            {taskType === "quest" && <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}</select>}
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
          {taskType === "quest" && (() => { const p = getExpPreview(difficulty, taskDate); const info = EXP_TIMING_LABELS[p.timing]; return <p className="exp-preview-hint">Ukończ dziś: <strong>+{p.amount} EXP</strong> ({info.text})</p>; })()}
          {taskType === "event" && <p className="exp-preview-hint">📅 Wydarzenie kalendarzowe - bez EXP, tylko informacja</p>}
          <div className="row">
            <button onClick={addTask} disabled={isAddingTask}>{isAddingTask ? "⏳ Dodawanie..." : taskType === "quest" ? "Dodaj Quest" : "Dodaj Wydarzenie"}</button>
            <button onClick={() => setShowAddTask(false)} className="cancel-btn">Anuluj</button>
          </div>
        </div>
      )}
        </>
      )}

      {mainTab === "recurring" && (
        <RecurringPanel
          api={API}
          headers={headers}
          onToast={showToast}
          onRefresh={fetchData}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      )}

      {mainTab === "schedule" && (
        <SchedulePanel
          api={API}
          headers={headers}
          entries={scheduleEntries}
          setEntries={setScheduleEntries}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onToast={showToast}
          enqueueRequest={enqueueRequest}
          freeDays={freeDays}
          setFreeDays={setFreeDays}
        />
      )}

      {mainTab === "shopping" && (
        <ShoppingPanel
          api={API}
          headers={headers}
          items={shoppingItems}
          setItems={setShoppingItems}
          onUserUpdate={updateUserFromModule}
          onToast={showToast}
          enqueueRequest={enqueueRequest}
          familyId={familyId}
          onFamilyChange={setFamilyId}
        />
      )}

      {mainTab === "earnings" && (
        <EarningsPanel
          api={API}
          headers={headers}
          entries={workEntries}
          setEntries={setWorkEntries}
          summary={workSummary}
          setSummary={setWorkSummary}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onUserUpdate={updateUserFromModule}
          onToast={showToast}
          enqueueRequest={enqueueRequest}
          freeDays={freeDays}
          setFreeDays={setFreeDays}
        />
      )}

      {mainTab === "settings" && (
        <CategoriesPanel
          api={API}
          headers={headers}
          onToast={showToast}
        />
      )}

      {mainTab === "tasks" && <LeaderboardPanel currentUser={user.username} />}
      {toasts.length > 0 && <Toast toasts={toasts} />}
      <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} headers={headers} onRefreshAppData={fetchData} onShowToast={showToast} />
    </div>
  );
}