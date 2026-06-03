/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import "./index.css";
import DatePicker from "./DatePicker";

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
const TASK_ACHIEVEMENT_REQUIREMENTS = {
  first_step: 1,
  second_bite: 3,
  scout_badge: 10,
  veteran_wall: 25,
  hundred_club: 50,
  mission_archive: 100,
  invincible_grind: 200,
};
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
  const progress = next === current ? 100 : ((exp - current) / (next - current)) * 100;
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

function countCompletedTasks(tasks) {
  return tasks.filter((t) => t.completed && t.exp_awarded).length;
}

function computeAchievementsOptimistic(tasks, achievements) {
  if (!achievements) return achievements;
  const completedCount = countCompletedTasks(tasks);

  // Achievement definitions for count-based achievements
  const ACHIEVEMENT_DEFS_TASK = [
    { slug: "first_step", title: "Pierwszy krok", description: "Ukończ pierwszy quest.", icon: "🌟", value: 1 },
    { slug: "second_bite", title: "Dobry start", description: "Ukończ 3 questy.", icon: "✨", value: 3 },
    { slug: "scout_badge", title: "Dziesiątka zadań", description: "Ukończ 10 questów.", icon: "⚔️", value: 10 },
    { slug: "veteran_wall", title: "Stały rytm", description: "Ukończ 25 questów.", icon: "🛡️", value: 25 },
    { slug: "hundred_club", title: "Pięćdziesiątka", description: "Ukończ 50 questów.", icon: "🏆", value: 50 },
    { slug: "mission_archive", title: "Archiwum zadań", description: "Ukończ 100 questów.", icon: "📜", value: 100 },
    { slug: "invincible_grind", title: "Dwieście zadań", description: "Ukończ 200 questów.", icon: "💥", value: 200 },
  ];

  // Filter unlocked achievements - only keep count-based ones whose conditions are still met
  const unlocked = (achievements.unlocked || []).filter((ach) => {
    const required = TASK_ACHIEVEMENT_REQUIREMENTS[ach.slug];
    // Keep if it's not a count-based achievement (we can't validate those optimistically)
    // or if it's count-based and the condition is still met
    return required == null || completedCount >= required;
  });

  // Add newly-met task-count achievements that are not yet in unlocked
  const unlockedSlugs = new Set(unlocked.map((a) => a.slug));
  for (const def of ACHIEVEMENT_DEFS_TASK) {
    if (!unlockedSlugs.has(def.slug) && completedCount >= def.value) {
      unlocked.push({ slug: def.slug, title: def.title, description: def.description, icon: def.icon });
      unlockedSlugs.add(def.slug);
    }
  }

  // Find the next count-based achievement that is not yet unlocked
  let next = null;
  for (const def of ACHIEVEMENT_DEFS_TASK) {
    if (!unlockedSlugs.has(def.slug)) {
      const current = Math.min(completedCount, def.value);
      next = {
        slug: def.slug,
        title: def.title,
        description: def.description,
        icon: def.icon,
        current,
        target: def.value,
        progress: `${current}/${def.value}`,
      };
      break;
    }
  }

  return { unlocked, next };
}

function reconcileAchievementsOptimistic(tasks, achievements) {
  if (!achievements) return achievements;
  const completedCount = countCompletedTasks(tasks);
  
  // Filter unlocked achievements - only keep those whose conditions are still met
  const unlocked = (achievements.unlocked || []).filter((ach) => {
    const required = TASK_ACHIEVEMENT_REQUIREMENTS[ach.slug];
    return required == null || completedCount >= required;
  });

  // Add newly-met task-count achievements that are not yet in unlocked
  const unlockedSlugs = new Set(unlocked.map((a) => a.slug));
  const ACHIEVEMENT_DEFS_TASK = [
    { slug: "first_step", title: "Pierwszy krok", description: "Ukończ pierwszy quest.", icon: "🌟", value: 1 },
    { slug: "second_bite", title: "Dobry start", description: "Ukończ 3 questy.", icon: "✨", value: 3 },
    { slug: "scout_badge", title: "Dziesiątka zadań", description: "Ukończ 10 questów.", icon: "⚔️", value: 10 },
    { slug: "veteran_wall", title: "Stały rytm", description: "Ukończ 25 questów.", icon: "🛡️", value: 25 },
    { slug: "hundred_club", title: "Pięćdziesiątka", description: "Ukończ 50 questów.", icon: "🏆", value: 50 },
    { slug: "mission_archive", title: "Archiwum zadań", description: "Ukończ 100 questów.", icon: "📜", value: 100 },
    { slug: "invincible_grind", title: "Dwieście zadań", description: "Ukończ 200 questów.", icon: "💥", value: 200 },
  ];
  for (const def of ACHIEVEMENT_DEFS_TASK) {
    if (!unlockedSlugs.has(def.slug) && completedCount >= def.value) {
      unlocked.push({ slug: def.slug, title: def.title, description: def.description, icon: def.icon });
      unlockedSlugs.add(def.slug);
    }
  }
  
  let next = achievements.next;
  if (next) {
    const required = TASK_ACHIEVEMENT_REQUIREMENTS[next.slug];
    if (required != null) {
      const current = Math.min(completedCount, required);
      next = {
        ...next,
        current,
        target: required,
        progress: `${current}/${required}`,
      };
    }
  }
  return { unlocked, next };
}

function Toast({ message }) {
  return <div className="toast">{message}</div>;
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

function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });
}

function makeRequestId(taskId) {
  return `${Date.now()}-${taskId}`;
}

function getExpDeltaFromApi(data) {
  return (data.exp_gained ?? 0) + (data.daily_bonus ?? 0);
}

function applyUserGamificationDelta(
  data,
  setUser,
  levelThresholdsRef,
  levelsMetaRef,
  { optimisticExpDelta = 0, syncStreak = false } = {},
) {
  setUser((prev) => {
    if (!prev) return prev;
    // If the API returned an absolute exp value AND we are the latest gamification sequence,
    // use it directly instead of delta arithmetic. This prevents ghost EXP caused by
    // accumulated rounding or unexpected server-side bonuses/penalties.
    // We still need to keep the optimistic delta in mind: if the API gave us an absolute
    // value we can trust it fully; if not, fall back to delta math.
    let exp;
    if (data.exp != null) {
      // Absolute from server — trust it. No delta math needed.
      exp = Math.max(0, data.exp);
    } else {
      exp = Math.max(0, (prev.exp || 0) + getExpDeltaFromApi(data) - optimisticExpDelta);
    }
    const derived = getGamificationFromExp(exp, levelsMetaRef.current, levelThresholdsRef.current);
    return {
      ...prev,
      exp,
      level: data.level ?? derived.level,
      title: data.title ?? derived.title,
      next_level_exp: data.next_level_exp ?? derived.next_level_exp,
      next_level_title: data.next_level_title ?? derived.next_level_title,
      streak: syncStreak && data.streak != null ? data.streak : prev.streak,
    };
  });
}

function applyUserFromApiAbsolute(data, setUser, levelThresholdsRef, levelsMetaRef) {
  setUser((prev) => {
    if (!prev) return prev;
    const exp = data.exp ?? prev.exp;
    const derived = getGamificationFromExp(exp, levelsMetaRef.current, levelThresholdsRef.current);
    return {
      ...prev,
      exp,
      level: data.level ?? derived.level,
      title: data.title ?? derived.title,
      next_level_exp: data.next_level_exp ?? derived.next_level_exp,
      next_level_title: data.next_level_title ?? derived.next_level_title,
      streak: data.streak ?? prev.streak,
    };
  });
}

function applyGamificationResponse(data, { setChallenges, setAchievements, setRareDrops, setHistory }) {
  if (data.challenges) setChallenges(data.challenges);
  if (data.achievements) setAchievements(data.achievements);
  if (data.rare_drops) setRareDrops(data.rare_drops);
  if (data.history) setHistory(data.history);
}

function computeChallengesOptimistic(tasks, challenges) {
  if (!challenges?.goals?.length) return challenges;

  const today = toDateStr(new Date());

  // Count tasks completed today (local date)
  const done_today = tasks.filter((t) => {
    if (!t.completed || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    const completedLocalDate = toDateStr(completedDate);
    return completedLocalDate === today;
  }).length;

  // Count tasks due today
  const total_today = tasks.filter((t) => t.due_date === today).length;

  // Count tasks completed today by difficulty
  const hard_done = tasks.filter((t) => {
    if (!t.completed || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    const completedLocalDate = toDateStr(completedDate);
    return completedLocalDate === today && t.difficulty === "hard";
  }).length;

  const medium_done = tasks.filter((t) => {
    if (!t.completed || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    const completedLocalDate = toDateStr(completedDate);
    return completedLocalDate === today && t.difficulty === "medium";
  }).length;

  const easy_done = tasks.filter((t) => {
    if (!t.completed || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    const completedLocalDate = toDateStr(completedDate);
    return completedLocalDate === today && t.difficulty === "easy";
  }).length;

  // Count distinct categories of tasks completed today
  const categories_done = new Set(
    tasks.filter((t) => {
      if (!t.completed || !t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      const completedLocalDate = toDateStr(completedDate);
      return completedLocalDate === today;
    }).map((t) => t.category)
  );

  // Count tasks due today that are completed
  const done_due_today = tasks.filter((t) => t.due_date === today && t.completed).length;

  // Evaluate each goal
  const goals = challenges.goals.map((goal) => {
    const qtype = goal.type;
    const target = goal.target || 1;
    let current = 0;

    if (qtype === "complete_count") {
      current = done_today;
    } else if (qtype === "complete_difficulty") {
      const diff = goal.difficulty;
      if (diff === "hard") {
        current = hard_done;
      } else if (diff === "medium") {
        current = medium_done;
      } else {
        current = easy_done;
      }
    } else if (qtype === "complete_difficulty_any") {
      current = hard_done + medium_done;
    } else if (qtype === "complete_category") {
      const cat = goal.category;
      current = categories_done.has(cat) ? 1 : 0;
    } else if (qtype === "complete_all") {
      current = done_due_today;
    } else if (qtype === "complete_categories_distinct") {
      current = categories_done.size;
    } else {
      // Skip types we can't compute optimistically: add_tasks, streak_min
      return goal;
    }

    const clampedCurrent = Math.min(current, target);
    const done = clampedCurrent >= target;

    return {
      ...goal,
      current: clampedCurrent,
      done,
    };
  });

  const all_complete = goals.length > 0 && goals.every((g) => g.done);
  const bonus_claimed = all_complete || challenges.bonus_claimed;

  return {
    ...challenges,
    today_done: done_today,
    goals,
    all_complete,
    bonus_claimed,
  };
}

function adjustChallengesForTask(challenges, task, completed) {
  if (!challenges?.goals?.length) return challenges;
  const delta = completed ? 1 : -1;
  const goals = challenges.goals.map((goal) => {
    if (goal.type !== "complete_count") return goal;
    const current = Math.min(goal.target, Math.max(0, goal.current + delta));
    return { ...goal, current, done: current >= goal.target };
  });
  return {
    ...challenges,
    today_done: Math.max(0, (challenges.today_done || 0) + delta),
    goals,
    all_complete: goals.length > 0 && goals.every((g) => g.done),
  };
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

function Calendar({ tasks, selectedDate, onDateSelect, onTaskToggle, onTaskDelete, processingTaskIds = [] }) {
  const [cursor, setCursor] = useState(() => selectedDate instanceof Date ? selectedDate : new Date());
  const [view, setView] = useState("month");
  const [collapsed, setCollapsed] = useState(readCalendarCollapsedPreference);
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
            {task.completed ? <div className="task-check checked locked">✓</div> : (
              <button type="button" className="task-check" disabled={processingTaskIds.includes(String(task.id))} onClick={() => onTaskToggle(task)} />
            )}
            <div className="day-task-info">
              <strong>{task.important ? "Ważne · " : ""}{task.title}</strong>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>
                <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>
                {task.reminder_offset_days !== null && task.reminder_offset_days !== undefined && <span className="badge reminder">{getReminderLabel(task.reminder_offset_days)}</span>}
              </div>
            </div>
            <button type="button" disabled={processingTaskIds.includes(String(task.id))} onClick={() => onTaskDelete(task)}>🗑</button>
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

function DayTasksPanel({ selectedDate, tasks, onToggle, onDelete, onSave, onError, onUncheck, processingTaskIds = [] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleToggleClick = (task) => {
    if (processingTaskIds.includes(String(task.id))) return;

    if (task.completed) {
      if (canUncheckTask(task) && onUncheck) {
        onUncheck(task);
      } else if (!canUncheckTask(task)) {
        onError("Nie można odznaczyć tego zadania (minęło więcej niż 24h)");
      }
    } else {
      onToggle(task);
    }
  };

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
      {dayTasks.map((task) => {
        const checkState = getTaskCheckState(task);
        return (
        <div key={task.id} className={`task-card ${task.difficulty} ${task.completed ? "done" : ""} ${checkState.showUncheckBadge ? "can-uncheck" : ""}`}>
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
              <button
                type="button"
                className={`task-check ${checkState.className}`}
                disabled={processingTaskIds.includes(String(task.id)) || checkState.disabled}
                onClick={() => handleToggleClick(task)}
                title={processingTaskIds.includes(String(task.id)) ? "Trwa synchronizacja…" : checkState.title}
                aria-label={checkState.title}
              >
                {task.completed ? "✓" : ""}
              </button>
              <div className="task-info">
                <h4 className={task.completed ? "done" : ""}>{task.important && <span className="important-mark">Ważne · </span>}{task.title}</h4>
                {task.description && <p className={task.completed ? "done-desc" : ""}>{task.description}</p>}
                <div className="task-meta">
                  <span className={`badge ${task.difficulty}`}>{task.difficulty === "easy" ? "Łatwe" : task.difficulty === "medium" ? "Średnie" : "Trudne"}</span>
                  <span className="badge category">{getCategoryEmoji(task.category)} {task.category}</span>
                  <span className="badge exp">{task.exp_awarded ? `✓ +${task.exp_awarded_amount || EXP_MAP[task.difficulty]} EXP` : `+${task.exp_preview ?? getExpPreview(task.difficulty, task.due_date).amount} EXP`}</span>
                  {!task.exp_awarded && (() => { const t = task.exp_timing_preview ?? getExpPreview(task.difficulty, task.due_date).timing; const info = EXP_TIMING_LABELS[t]; return info ? <span className={`badge timing ${info.className}`}>{info.text}</span> : null; })()}
                  {task.reminder_offset_days !== null && task.reminder_offset_days !== undefined && <span className="badge reminder">{getReminderLabel(task.reminder_offset_days)}</span>}
                  {checkState.showUncheckBadge && <span className="badge uncheck-badge">↩️ Można odznaczyć (24h)</span>}
                  {task.completed && checkState.disabled && <span className="badge locked-badge">🔒 Zablokowane</span>}
                </div>
              </div>
              <div className="task-actions">
                {!task.completed && <button className="icon-btn" onClick={() => startEdit(task)}>✏️</button>}
                <button className="task-delete" disabled={processingTaskIds.includes(String(task.id))} onClick={() => onDelete(task)}>🗑</button>
              </div>
            </>
          )}
        </div>
      );})}
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

  const resetAllProgress = async () => {
    const confirmMsg = "Zresetować WSZYSTKO (osiągnięcia, znajdźki, serie, EXP i historię) dla wszystkich użytkowników? Ta operacja jest nieodwracalna.";
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await axios.post(`${API}/admin/reset-all-progress`, {}, { headers });
      alert(res.data?.message || "Reset wykonany");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Błąd resetowania progresu");
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(readNotificationsPreference);
  const [standalonePwa, setStandalonePwa] = useState(false);
  const notificationsUnsupported = !("Notification" in window);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [processingTaskIds, setProcessingTaskIds] = useState([]);

  const apiQueueRef = useRef([]);
  const apiQueueRunningRef = useRef(false);
  const lastRequestIdRef = useRef(new Map());
  const gamificationSeqRef = useRef(0);
  const processingTaskIdsRef = useRef(new Set());
  const levelThresholdsRef = useRef(levelThresholds);
  levelThresholdsRef.current = levelThresholds;
  const levelsMetaRef = useRef(levelsMeta);
  levelsMetaRef.current = levelsMeta;

  const beginGamificationUpdate = useCallback(() => {
    gamificationSeqRef.current += 1;
    return gamificationSeqRef.current;
  }, []);

  const isLatestGamification = useCallback((seq) => gamificationSeqRef.current === seq, []);

  const headers = { Authorization: `Bearer ${token}` };
  const gamificationSetters = { setChallenges, setAchievements, setRareDrops, setHistory };

  const syncProcessingTaskIds = useCallback(() => {
    setProcessingTaskIds([...processingTaskIdsRef.current]);
  }, []);

  const isTaskProcessing = useCallback((taskKey) => processingTaskIdsRef.current.has(String(taskKey)), []);

  const isStaleRequest = useCallback((taskKey, requestId) => lastRequestIdRef.current.get(String(taskKey)) !== requestId, []);

  const startTaskRequest = useCallback((taskKey) => {
    const key = String(taskKey);
    const requestId = makeRequestId(key);
    lastRequestIdRef.current.set(key, requestId);
    processingTaskIdsRef.current.add(key);
    syncProcessingTaskIds();
    return requestId;
  }, [syncProcessingTaskIds]);

  const finishTaskRequest = useCallback((taskKey, requestId) => {
    const key = String(taskKey);
    if (lastRequestIdRef.current.get(key) !== requestId) return;
    processingTaskIdsRef.current.delete(key);
    syncProcessingTaskIds();
  }, [syncProcessingTaskIds]);

  const enqueueApiJob = useCallback((job) => {
    apiQueueRef.current.push(job);
    const drainQueue = async () => {
      if (apiQueueRunningRef.current) return;
      apiQueueRunningRef.current = true;
      while (apiQueueRef.current.length > 0) {
        const nextJob = apiQueueRef.current.shift();
        await nextJob();
      }
      apiQueueRunningRef.current = false;
    };
    drainQueue();
  }, []);

  const applyGamificationFromTaskResponse = useCallback((data, { gamSeq, optimisticExpDelta }) => {
    applyUserGamificationDelta(data, setUser, levelThresholdsRef, levelsMetaRef, {
      optimisticExpDelta,
      syncStreak: isLatestGamification(gamSeq),
    });
    // Always update achievements immediately from API — the full list is authoritative.
    // This ensures new achievements appear as soon as the API responds, regardless of
    // request ordering. We never skip this update because data.achievements is additive
    // (the server always returns the complete unlocked list).
    if (data.achievements) setAchievements(data.achievements);
    if (isLatestGamification(gamSeq)) {
      if (data.challenges) setChallenges(data.challenges);
      if (data.rare_drops) setRareDrops(data.rare_drops);
      if (data.history) setHistory(data.history);
    }
  }, [isLatestGamification]);

  const patchTaskInState = useCallback((taskId, patch) => {
    setTasks((prev) => sortTasks(prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))));
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const [pwaHintDismissed, setPwaHintDismissed] = useState(readPwaHintDismissed);

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
    showToast("Powiadomienia wyłączone");
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
      const [userRes, tasksRes, achRes, chRes, levelsRes, rareDropsRes, historyRes] = await Promise.all([
        axios.get(`${API}/me`, { headers: noCacheHeaders }),
        axios.get(`${API}/tasks`, { headers: noCacheHeaders }),
        axios.get(`${API}/achievements`, { headers: noCacheHeaders }),
        axios.get(`${API}/challenges`, { headers: noCacheHeaders }),
        axios.get(`${API}/game/levels`, { headers: noCacheHeaders }).catch(() => ({ data: null })),
        axios.get(`${API}/rare-drops/inventory`, { headers: noCacheHeaders }).catch(() => ({ data: null })),
        axios.get(`${API}/history`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
      ]);
      
      const newUnlocked = achRes.data.unlocked || [];
      
      setUser(userRes.data);
      
      // Sort tasks: uncompleted on top (by date ascending), completed at bottom (by date ascending)
      const sortedTasks = [...tasksRes.data].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1; // uncompleted first
        }
        return new Date(a.due_date) - new Date(b.due_date); // by date ascending
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
    } catch (err) {
      console.error("Fetch error:", err);
      localStorage.removeItem("token");
      setToken(null);
    }
  };

  const showToggleRewards = (data) => {
    const { daily_bonus, new_achievements, new_exclusive_achievements, earned_drop, revoked_achievements } = data;
    if (daily_bonus > 0) showToast(`🎉 Wszystkie wyzwania dziś! +${daily_bonus} EXP bonus`);
    if (earned_drop) {
      showToast(`✨ Zdobyto ${earned_drop.icon} ${earned_drop.name}! ${earned_drop.description}`);
      showAppNotification(`Nowa znajdźka: ${earned_drop.icon} ${earned_drop.name} — ${earned_drop.description}`);
    }
    // Show notifications for ALL newly unlocked achievements (not just the first one)
    const allNewAchievements = [...(new_achievements || []), ...(new_exclusive_achievements || [])];
    if (allNewAchievements.length > 0) {
      allNewAchievements.forEach((ach, index) => {
        setTimeout(() => {
          showToast(`🏆 Odblokowano: ${ach.title}! ${ach.icon}`);
          showAppNotification(`Nowe osiągnięcie: ${ach.icon} ${ach.title} — ${ach.description}`);
        }, index * 500); // Stagger notifications if multiple achievements
      });
    }
    // Show notifications for revoked achievements
    if (revoked_achievements && revoked_achievements.length > 0) {
      revoked_achievements.forEach((ach, index) => {
        setTimeout(() => {
          showToast(`⚠️ Osiągnięcie cofnięte: ${ach.title} ${ach.icon}`);
        }, index * 300);
      });
    }
  };

  useEffect(() => {
    let cleanup;
    registerServiceWorkerForUpdates().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => { if (token) fetchData(); }, [token]);
  useEffect(() => { setTaskDate(toDateStr(selectedDate)); }, [selectedDate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(new Date(`${dateParam}T12:00:00`));
    }
  }, []);

  const addTask = () => {
    if (!title.trim()) { showToast("Podaj nazwę zadania"); return; }

    const savedDate = taskDate;
    const tempId = `temp-${Date.now()}`;
    if (isTaskProcessing(tempId)) return;

    const apiPayload = {
      title,
      description: desc,
      difficulty,
      category,
      due_date: taskDate,
      important,
      reminder_offset_days: parseReminderValue(reminderOffset),
    };
    const tempTask = {
      id: tempId,
      title,
      description: desc,
      difficulty,
      category,
      due_date: taskDate,
      important,
      reminder_offset_days: parseReminderValue(reminderOffset),
      completed: false,
      exp_awarded: false,
      exp_awarded_amount: 0,
    };

    const requestId = startTaskRequest(tempId);
    setTasks((prev) => sortTasks([...prev, tempTask]));
    setTitle("");
    setDesc("");
    setImportant(false);
    setReminderOffset("");
    setShowAddTask(false);

    enqueueApiJob(async () => {
      let serverId = null;
      try {
        const res = await axios.post(`${API}/tasks`, apiPayload, { headers });
        if (isStaleRequest(tempId, requestId)) return;
        serverId = res.data.id;
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === tempId ? { ...tempTask, id: serverId } : t))));
        lastRequestIdRef.current.delete(String(tempId));
        lastRequestIdRef.current.set(String(serverId), requestId);
        processingTaskIdsRef.current.delete(String(tempId));
        processingTaskIdsRef.current.add(String(serverId));
        syncProcessingTaskIds();
        showToast(`✅ Dodano quest na ${savedDate}`);
      } catch (err) {
        console.error("[addTask] API error:", err);
        if (!isStaleRequest(tempId, requestId)) {
          setTasks((prev) => prev.filter((t) => t.id !== tempId));
          showToast(err.response?.data?.detail || "Błąd dodawania");
        }
      } finally {
        finishTaskRequest(serverId ?? tempId, requestId);
      }
    });
  };

  const toggleTask = (task) => {
    if (task.completed || isTaskProcessing(task.id)) return;

    const taskKey = task.id;
    const requestId = startTaskRequest(taskKey);
    const gamSeq = beginGamificationUpdate();
    const snapshot = { task: { ...task }, user: user ? { ...user } : null, challenges: challenges ? { ...challenges } : null, achievements: achievements ? { ...achievements } : null };
    const expPreview = getExpPreview(task.difficulty, task.due_date);
    const optimisticExpDelta = expPreview.amount;
    const today = toDateStr(new Date());
    const timing = today < task.due_date ? "early" : today > task.due_date ? "late" : "ontime";

    // Optimistically update the task
    const nextTasks = sortTasks(tasks.map((t) => (t.id === task.id ? {
      ...t,
      completed: true,
      exp_awarded: true,
      exp_awarded_amount: expPreview.amount,
      completed_at: new Date().toISOString(),
    } : t)));

    // Compute optimistic challenges and achievements
    const optimisticChallenges = computeChallengesOptimistic(nextTasks, challenges);
    const optimisticAchievements = computeAchievementsOptimistic(nextTasks, achievements);

    // Check if completing this task would complete all daily challenges (for optimistic daily bonus)
    const willCompleteAllDaily = optimisticChallenges?.goals?.length > 0 && optimisticChallenges.goals.every((g) => g.done || g.current >= g.target);
    const dailyBonusExp = challenges?.triple_bonus_exp || 35;
    const optimisticDailyBonus = willCompleteAllDaily && !challenges?.bonus_claimed ? dailyBonusExp : 0;
    const totalOptimisticExp = expPreview.amount + optimisticDailyBonus;

    // Single setState for all data to avoid UI flickering
    setTasks(nextTasks);
    setAchievements(optimisticAchievements);
    setUser((prev) => {
      if (!prev) return prev;
      const newExp = (prev.exp || 0) + totalOptimisticExp;
      const derived = getGamificationFromExp(newExp, levelsMetaRef.current, levelThresholdsRef.current);
      return {
        ...prev,
        exp: newExp,
        level: derived.level,
        title: derived.title,
        next_level_exp: derived.next_level_exp,
        next_level_title: derived.next_level_title,
      };
    });
    setChallenges(optimisticChallenges);
    showToast(`✅ Quest ukończony! +${expPreview.amount} EXP${expToastSuffix(timing)}${optimisticDailyBonus > 0 ? ` 🎉 Bonus dzienny +${optimisticDailyBonus} EXP` : ""}`);

    enqueueApiJob(async () => {
      try {
        const res = await axios.patch(`${API}/tasks/${task.id}`, { completed: true }, { headers });
        if (isStaleRequest(taskKey, requestId)) return;
        const data = res.data;
        if (data.task) patchTaskInState(task.id, data.task);
        // Apply API response, but subtract the optimistic daily bonus if we added it
        const apiExpDelta = getExpDeltaFromApi(data);
        const correctedOptimisticDelta = optimisticExpDelta + optimisticDailyBonus;
        applyGamificationFromTaskResponse(data, { gamSeq, optimisticExpDelta: correctedOptimisticDelta });
        if (isLatestGamification(gamSeq)) showToggleRewards(data);
      } catch (err) {
        console.error("[toggleTask] API error:", err);
        if (!isStaleRequest(taskKey, requestId)) {
          setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? snapshot.task : t))));
          if (snapshot.user) setUser(snapshot.user);
          if (snapshot.challenges) setChallenges(snapshot.challenges);
          if (snapshot.achievements) setAchievements(snapshot.achievements);
          showToast(err.response?.data?.detail || "Błąd aktualizacji");
        }
      } finally {
        finishTaskRequest(taskKey, requestId);
      }
    });
  };

  const saveTask = async (id, updates) => {
    if (isTaskProcessing(id)) return;

    const taskKey = id;
    const requestId = startTaskRequest(taskKey);
    const snapshot = tasks.find((t) => t.id === id);
    if (!snapshot) {
      finishTaskRequest(taskKey, requestId);
      return;
    }

    setTasks((prev) => sortTasks(prev.map((t) => (t.id === id ? { ...t, ...updates } : t))));

    enqueueApiJob(async () => {
      try {
        const res = await axios.patch(`${API}/tasks/${id}`, updates, { headers });
        if (isStaleRequest(taskKey, requestId)) return;
        if (res.data.task) patchTaskInState(id, res.data.task);
        if (res.data.exp !== undefined) applyUserFromApiAbsolute(res.data, setUser, levelThresholdsRef, levelsMetaRef);
        showToast("💾 Zapisano zmiany");
      } catch (err) {
        if (!isStaleRequest(taskKey, requestId)) {
          patchTaskInState(id, snapshot);
          showToast(err.response?.data?.detail || "Błąd zapisu");
        }
      } finally {
        finishTaskRequest(taskKey, requestId);
      }
    });
  };

  const uncheckTask = (task) => {
    if (!canUncheckTask(task)) {
      showToast("Nie można odznaczyć tego zadania (minęło więcej niż 24h)");
      return;
    }
    if (isTaskProcessing(task.id)) return;

    const taskKey = task.id;
    const requestId = startTaskRequest(taskKey);
    const gamSeq = beginGamificationUpdate();
    const snapshot = { task: { ...task }, user: user ? { ...user } : null, challenges: challenges ? { ...challenges } : null, achievements: achievements ? { ...achievements } : null };
    const expToRevert = task.exp_awarded_amount || EXP_MAP[task.difficulty] || 10;
    const optimisticExpDelta = -expToRevert;

    // Optimistically update the task
    const nextTasks = sortTasks(tasks.map((t) => (t.id === task.id ? {
      ...t,
      completed: false,
      exp_awarded: false,
      exp_awarded_amount: 0,
      completed_at: null,
    } : t)));

    // Compute optimistic challenges and achievements
    const optimisticChallenges = computeChallengesOptimistic(nextTasks, challenges);
    const optimisticAchievements = computeAchievementsOptimistic(nextTasks, achievements);

    // Check if unchecking this task would revoke the daily bonus
    const willRevokeDailyBonus = challenges?.bonus_claimed && optimisticChallenges?.goals?.length > 0 && !optimisticChallenges.goals.every((g) => g.done || g.current >= g.target);
    const dailyBonusExp = challenges?.triple_bonus_exp || 35;
    const optimisticDailyBonusRevert = willRevokeDailyBonus ? dailyBonusExp : 0;
    const totalOptimisticExpRevert = expToRevert + optimisticDailyBonusRevert;

    // Single setState for all data to avoid UI flickering
    setTasks(nextTasks);
    setAchievements(optimisticAchievements);
    setUser((prev) => {
      if (!prev) return prev;
      const newExp = Math.max(0, (prev.exp || 0) - totalOptimisticExpRevert);
      const derived = getGamificationFromExp(newExp, levelsMetaRef.current, levelThresholdsRef.current);
      return {
        ...prev,
        exp: newExp,
        level: derived.level,
        title: derived.title,
        next_level_exp: derived.next_level_exp,
        next_level_title: derived.next_level_title,
      };
    });
    setChallenges(optimisticChallenges);
    showToast("✅ Cofnięto ukończenie zadania");
    if (optimisticDailyBonusRevert > 0) {
      setTimeout(() => showToast(`⚠️ Bonus dzienny cofnięty (-${optimisticDailyBonusRevert} EXP)`), 500);
    }

    enqueueApiJob(async () => {
      try {
        const res = await axios.patch(`${API}/tasks/${task.id}`, { completed: false }, { headers });
        if (isStaleRequest(taskKey, requestId)) return;
        const data = res.data;
        if (data.task) patchTaskInState(task.id, data.task);
        // Apply API response, but account for the optimistic daily bonus revert
        const correctedOptimisticDelta = -totalOptimisticExpRevert;
        applyGamificationFromTaskResponse(data, { gamSeq, optimisticExpDelta: correctedOptimisticDelta });
      } catch (err) {
        console.error("[uncheckTask] API error:", err);
        if (!isStaleRequest(taskKey, requestId)) {
          setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? snapshot.task : t))));
          if (snapshot.user) setUser(snapshot.user);
          if (snapshot.challenges) setChallenges(snapshot.challenges);
          if (snapshot.achievements) setAchievements(snapshot.achievements);
          showToast(err.response?.data?.detail || "Błąd cofania ukończenia");
        }
      } finally {
        finishTaskRequest(taskKey, requestId);
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
  
  const deleteTask = (task) => {
    if (isTaskProcessing(task.id)) return;

    const exp = task.exp_awarded_amount || EXP_MAP[task.difficulty] || 10;
    if (task.exp_awarded && !window.confirm(`Usunąć ukończony quest "${task.title}"? Odejmie ${exp} EXP.`)) return;

    const taskKey = task.id;
    const requestId = startTaskRequest(taskKey);
    const gamSeq = beginGamificationUpdate();
    const snapshot = { task: { ...task }, tasks: tasks, user: user ? { ...user } : null, challenges: challenges ? { ...challenges } : null, achievements: achievements ? { ...achievements } : null };
    const optimisticExpDelta = task.exp_awarded ? -(task.exp_awarded_amount || exp) : 0;

    // Optimistically update the task
    const nextTasks = sortTasks(tasks.filter((t) => t.id !== task.id));

    // Compute optimistic challenges and achievements if task was completed
    let optimisticChallenges = challenges;
    let optimisticAchievements = achievements;
    if (task.exp_awarded) {
      optimisticChallenges = computeChallengesOptimistic(nextTasks, challenges);
      optimisticAchievements = computeAchievementsOptimistic(nextTasks, achievements);
    }

    // Single setState for all data to avoid UI flickering
    setTasks(nextTasks);
    if (task.exp_awarded) {
      setAchievements(optimisticAchievements);
      setUser((prev) => {
        if (!prev) return prev;
        const newExp = Math.max(0, (prev.exp || 0) - exp);
        const derived = getGamificationFromExp(newExp, levelsMetaRef.current, levelThresholdsRef.current);
        return {
          ...prev,
          exp: newExp,
          level: derived.level,
          title: derived.title,
          next_level_exp: derived.next_level_exp,
          next_level_title: derived.next_level_title,
        };
      });
      setChallenges(optimisticChallenges);
    }

    enqueueApiJob(async () => {
      try {
        const res = await axios.delete(`${API}/tasks/${task.id}`, { headers });
        if (isStaleRequest(taskKey, requestId)) return;
        if (task.exp_awarded) {
          applyGamificationFromTaskResponse(
            { ...res.data, exp_gained: -(res.data.exp_removed || exp), daily_bonus: 0 },
            { gamSeq, optimisticExpDelta },
          );
        } else {
          applyUserFromApiAbsolute(res.data, setUser, levelThresholdsRef, levelsMetaRef);
        }
        showToast(res.data.exp_removed > 0 ? `🗑️ Usunięto quest (-${res.data.exp_removed} EXP)` : "🗑️ Usunięto quest");
      } catch (err) {
        console.error("[deleteTask] API error:", err);
        if (!isStaleRequest(taskKey, requestId)) {
          setTasks(sortTasks(snapshot.tasks));
          if (snapshot.user) setUser(snapshot.user);
          if (snapshot.challenges) setChallenges(snapshot.challenges);
          if (snapshot.achievements) setAchievements(snapshot.achievements);
          if (err.response?.status === 404) showToast("Zadanie już nie istnieje");
          else showToast(err.response?.data?.detail || "Błąd usuwania");
        }
      } finally {
        finishTaskRequest(taskKey, requestId);
      }
    });
  };
  
  const logout = () => { localStorage.removeItem("token"); setToken(null); setUser(null); };
  const handleLogin = () => { const newToken = localStorage.getItem("token"); setToken(newToken); if (newToken) setTimeout(fetchData, 100); };

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
      <ChallengesBar challenges={challenges} />
      <Calendar tasks={tasks} selectedDate={selectedDate} onDateSelect={(dateStr) => setSelectedDate(new Date(dateStr + "T12:00:00"))} onTaskToggle={toggleTask} onTaskDelete={deleteTask} processingTaskIds={processingTaskIds} />
      <DayTasksPanel selectedDate={selectedDate} tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} onSave={saveTask} onError={showToast} onUncheck={uncheckTask} processingTaskIds={processingTaskIds} />
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
          <div className="row">
            <button onClick={addTask} disabled={processingTaskIds.some((id) => String(id).startsWith("temp-"))}>{processingTaskIds.some((id) => String(id).startsWith("temp-")) ? "Dodawanie…" : "Dodaj Quest"}</button>
            <button onClick={() => setShowAddTask(false)} className="cancel-btn" disabled={processingTaskIds.some((id) => String(id).startsWith("temp-"))}>Anuluj</button>
          </div>
        </div>
      )}
      <LeaderboardPanel currentUser={user.username} />
      {toast && <Toast message={toast} />}
      <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} headers={headers} />
    </div>
  );
}