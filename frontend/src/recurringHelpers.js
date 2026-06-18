/** Mirrors backend recurring_event_occurs_on for calendar display. */

function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function daysBetween(start, target) {
  const ms = parseDateStr(target).getTime() - parseDateStr(start).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function monthsBetween(start, target) {
  const s = parseDateStr(start);
  const t = parseDateStr(target);
  return (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth());
}

export function recurringEventOccursOn(event, dateStr) {
  if (event.interval_type && event.start_date) {
    const start = event.start_date.slice(0, 10);
    if (dateStr < start) return false;
    if (event.end_date && dateStr > event.end_date.slice(0, 10)) return false;
    const iv = event.interval_value || 1;
    if (event.interval_type === "daily") {
      return daysBetween(start, dateStr) % iv === 0;
    }
    if (event.interval_type === "weekly") {
      return daysBetween(start, dateStr) % (iv * 7) === 0;
    }
    if (event.interval_type === "monthly") {
      const s = parseDateStr(start);
      const t = parseDateStr(dateStr);
      if (t.getDate() !== s.getDate()) return false;
      const months = monthsBetween(start, dateStr);
      return months >= 0 && months % iv === 0;
    }
    if (event.interval_type === "yearly") {
      const s = parseDateStr(start);
      const t = parseDateStr(dateStr);
      if (t.getMonth() !== s.getMonth() || t.getDate() !== s.getDate()) return false;
      const years = t.getFullYear() - s.getFullYear();
      return years >= 0 && years % iv === 0;
    }
    return false;
  }
  return false;
}

export function getRecurringEventsForDate(events, dateStr) {
  return (events || []).filter((e) => recurringEventOccursOn(e, dateStr));
}

export function getRecurringCategoriesForDate(events, dateStr, tasksOnDate = []) {
  const fromTasks = tasksOnDate
    .filter((t) => t.task_type === "event" && t.event_category)
    .map((t) => t.event_category);
  const fromRecurring = getRecurringEventsForDate(events, dateStr).map((e) => e.category);
  const seen = new Set();
  const merged = [];
  for (const cat of [...fromTasks, ...fromRecurring]) {
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      merged.push(cat);
    }
  }
  return merged;
}

export function toVirtualRecurringTasks(events, dateStr, tasksOnDate = []) {
  // Pobierz TYLKO wydarzenia z RecurringEvent (nie z Task)
  const recurringEvents = events.filter(e => e.source === 'recurring_event' || !e.recurring_pattern);
  
  // Sprawdź, czy na dany dzień istnieje już instancja w bazie (z Task)
  const existingTitles = new Set(
    tasksOnDate
      .filter((t) => t.task_type === "event")
      .map((t) => t.title.toLowerCase()),
  );
  
  return getRecurringEventsForDate(recurringEvents, dateStr)
    .filter((e) => !existingTitles.has(e.title.toLowerCase()))
    .map((e) => ({
      id: `recurring-${e.id}-${dateStr}`,
      title: e.title,
      task_type: "event",
      event_category: e.category,
      isRecurringVirtual: true,  // ← KLUCZOWE – oznacza, że to wirtualna instancja
      due_date: dateStr,
      completed: false,
      category: "Inne",
      difficulty: "easy",
      source: "recurring_event",  // ← OZNACZENIE ŹRÓDŁA
    }));
}
