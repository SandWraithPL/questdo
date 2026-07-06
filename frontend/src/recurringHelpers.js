// Parsuje string daty i zwraca Date object
function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Oblicza liczbę dni między dwoma datami
function daysBetween(start, target) {
  const ms = parseDateStr(target).getTime() - parseDateStr(start).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

// Oblicza liczbę miesięcy między dwoma datami
function monthsBetween(start, target) {
  const s = parseDateStr(start);
  const t = parseDateStr(target);
  return (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth());
}

// Sprawdza czy recurring event powinien się pojawiać w danym dniu
export function recurringEventOccursOn(event, dateStr) {
  // Jeśli event ma ustawiony interwał i datę początkową
  if (event.interval_type && event.start_date) {
    const start = event.start_date.slice(0, 10);
    // Sprawdzamy czy data jest w przedziale
    if (dateStr < start) return false;
    if (event.end_date && dateStr > event.end_date.slice(0, 10)) return false;
    
    const iv = event.interval_value || 1;
    
    // Daily - każdy dzień
    if (event.interval_type === "daily") {
      return daysBetween(start, dateStr) % iv === 0;
    }
    // Weekly - co N tygodni
    if (event.interval_type === "weekly") {
      return daysBetween(start, dateStr) % (iv * 7) === 0;
    }
    // Monthly - co N miesięcy na ten sam dzień
    if (event.interval_type === "monthly") {
      const s = parseDateStr(start);
      const t = parseDateStr(dateStr);
      if (t.getDate() !== s.getDate()) return false;
      const months = monthsBetween(start, dateStr);
      return months >= 0 && months % iv === 0;
    }
    // Yearly - co N lat na tę samą datę
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

// Zwraca wszystkie recurring eventy które powinny być w danym dniu
export function getRecurringEventsForDate(events, dateStr) {
  return (events || []).filter((e) => recurringEventOccursOn(e, dateStr));
}

// Zbiera kategorie z eventów na daną datę (zarówno z rekurencyjnych jak i zwykłych)
export function getRecurringCategoriesForDate(events, dateStr, tasksOnDate = []) {
  // Kategorie z zadań typu event
  const fromTasks = tasksOnDate
    .filter((t) => t.task_type === "event" && t.event_category)
    .map((t) => t.event_category);
  // Kategorie z recurring eventów
  const fromRecurring = getRecurringEventsForDate(events, dateStr).map((e) => e.category);
  // Usuwamy duplikaty
  const seen = new Set();
  return [...fromTasks, ...fromRecurring].filter(cat => cat && !seen.has(cat) && !seen.add(cat));
}

// Tworzy wirtualne zadania z recurring eventów dla danej daty
export function toVirtualRecurringTasks(events, dateStr, tasksOnDate = []) {
  // Bierzemy tylko eventy (nie zwykłe powtarzające się zadania)
  const recurringEvents = events.filter(e => e.source === 'recurring_event' || !e.recurring_pattern);

  // Zbieramy już istniejące tytuły eventów na ten dzień
  const existingTitles = new Set(
    tasksOnDate
      .filter((t) => t.task_type === "event")
      .map((t) => t.title.toLowerCase()),
  );

  // Tworzymy wirtualne zadania z recurring eventów które jeszcze nie istnieją
  return getRecurringEventsForDate(recurringEvents, dateStr)
    .filter((e) => !existingTitles.has(e.title.toLowerCase()))
    .map((e) => ({
      id: `recurring-${e.id}-${dateStr}`,
      title: e.title,
      task_type: "event",
      event_category: e.category,
      isRecurringVirtual: true,
      due_date: dateStr,
      completed: false,
      category: "Inne",
      difficulty: "easy",
      source: "recurring_event",
    }));
}
