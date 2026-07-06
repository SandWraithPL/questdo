// Panel zarobków - śledzenie czasu pracy, stawki, podatki
import { useMemo, useState, useEffect, useRef } from "react";
import axios from "axios";
import SharedCalendar, { WEEKDAYS_LONG } from "./SharedCalendar";
import TimePicker from "./TimePicker";
import DatePicker from "./DatePicker";
import FreeDayManager from "./FreeDayManager";
import { applyUserFromResponse } from "./helpers";
import { toVirtualRecurringTasks } from "./recurringHelpers";

// Kategorie eventów
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

// Formatuje kwotę na polski format (np. 10,50 zł)
function formatMoney(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł`;
}

function formatRate(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł/h`;
}

// Konwertuje wejście stawki (przecinki) na punkt dla API
function parseRateInput(value) {
  if (!value) return "";
  return value.replace(",", ".");
}

// Pobiera bieżącą datę w strefie czasowej Warszawy
function getWarsawDateStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

// Pobiera bieżące minuty (od północy) w strefie Warszawy
function getWarsawMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function parseTimeMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export default function EarningsPanel({
  api,
  headers,
  entries,
  setEntries,
  summary,
  setSummary,
  selectedDate,
  onDateSelect,
  onUserUpdate,
  onToast,
  enqueueRequest,
  freeDays = [],
  setFreeDays,
  recurringEvents = [],
}) {
  // Stany formularza
  const [showAdd, setShowAdd] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState("12");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editDayOfWeek, setEditDayOfWeek] = useState(0);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [copyModal, setCopyModal] = useState(null);
  const autoCompletedIds = useRef(new Set());

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  // Pobiera wpisy dla wybranego dnia + wirtualne
  const dayEntries = useMemo(() => {
    const dayEntries = entries.filter((e) => e.work_date === selectedStr);
    const virtual = toVirtualRecurringTasks(recurringEvents, selectedStr, dayEntries);
    return [...dayEntries, ...virtual].sort((a, b) => {
      if (a.isRecurringVirtual && !b.isRecurringVirtual) return -1;
      if (!a.isRecurringVirtual && b.isRecurringVirtual) return 1;
      if (a.isRecurringVirtual && b.isRecurringVirtual) return 0;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [entries, selectedStr, recurringEvents]);

  // Ładuje domyślną stawkę i odświeża podsumowanie
  useEffect(() => {
    loadDefaultHourlyRate();
    setWorkDate(selectedStr);
    refreshSummary();
  }, [selectedStr]);

  // Automatycznie kończy wpisy pracy gdy czas minął
  useEffect(() => {
    const checkAutoComplete = () => {
      const todayStr = getWarsawDateStr();
      const nowMinutes = getWarsawMinutesNow();
      const dueEntries = entries.filter((entry) => {
        if (entry.completed || autoCompletedIds.current.has(entry.id)) return false;
        if (entry.work_date !== todayStr) return false;
        return nowMinutes >= parseTimeMinutes(entry.end_time);
      });

      dueEntries.forEach((entry) => {
        autoCompletedIds.current.add(entry.id);
        enqueueRequest(async () => {
          try {
            const res = await axios.patch(`${api}/work/${entry.id}`, { completed: true }, { headers });
            setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.data.entry : e)));
            applyUserFromResponse(res.data, onUserUpdate);
            await refreshSummary();
            onToast("✅ Praca automatycznie zakończona");
          } catch {
            autoCompletedIds.current.delete(entry.id);
          }
        });
      });
    };

    checkAutoComplete();
    const interval = window.setInterval(checkAutoComplete, 60000);
    return () => window.clearInterval(interval);
  }, [entries, api, headers, onToast, onUserUpdate]);

  // Ładuje domyślną stawkę użytkownika
  const loadDefaultHourlyRate = async () => {
    try {
      const res = await axios.get(`${api}/settings/default-hourly-rate`, { headers });
      const rate = res.data.rate ? parseFloat(res.data.rate).toFixed(2).replace(".", ",") : "";
      setDefaultHourlyRate(rate);
    } catch {}
  };

  // Oblicza sumy dla dnia, miesiąca, roku
  const dayTotal = dayEntries.filter((e) => e.completed).reduce((sum, e) => sum + (e.net || 0), 0);
  const monthKey = selectedStr.slice(0, 7);
  const yearKey = selectedStr.slice(0, 4);
  const monthTotal = summary?.by_month?.[monthKey] || 0;
  const yearTotal = summary?.by_year?.[yearKey] || 0;

  // Odświeża podsumowanie finansowe
  const refreshSummary = async () => {
    try {
      const res = await axios.get(`${api}/work/summary`, { headers });
      setSummary(res.data);
    } catch {}
  };

  // Zapisuje stawkę jako domyślną
  const saveAsDefaultRate = async () => {
    const rateValue = parseRateInput(hourlyRate);
    const rate = parseFloat(rateValue);
    if (!rate || rate <= 0) {
      onToast("Podaj stawkę godzinową");
      return;
    }
    if (isSavingDefault) return;
    setIsSavingDefault(true);
    try {
      await axios.post(`${api}/settings/default-hourly-rate`, { rate }, { headers });
      const formattedRate = rate.toFixed(2).replace(".", ",");
      setDefaultHourlyRate(formattedRate);
      onToast("💾 Zapisano jako domyślną stawkę");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu domyślnej stawki");
    } finally {
      setIsSavingDefault(false);
    }
  };

  // Dodaje nowy wpis pracy
  const addEntry = () => {
    const rateValue = parseRateInput(hourlyRate);
    const rate = parseFloat(rateValue);
    if (!rate || rate <= 0) {
      onToast("Podaj stawkę godzinową");
      return;
    }
    if (isRecurring && !startDate) {
      onToast("Podaj datę rozpoczęcia dla pracy cyklicznej");
      return;
    }
    if (!isRecurring && !workDate) {
      onToast("Podaj datę pracy");
      return;
    }

    // Optymistyczny wpis
    const tempId = `temp-${Date.now()}`;
    const tempEntry = {
      id: tempId,
      work_date: isRecurring ? selectedStr : workDate,
      start_time: startTime,
      end_time: endTime,
      hourly_rate: rate,
      notes,
      tax_enabled: taxEnabled,
      tax_percent: parseFloat(taxPercent) || 0,
      is_recurring: isRecurring,
      day_of_week: isRecurring ? dayOfWeek : null,
      start_date: isRecurring ? startDate : null,
      end_date: isRecurring && endDate ? endDate : null,
      completed: false,
      isOptimistic: true,
    };
    setEntries(prev => [tempEntry, ...prev]);

    setShowAdd(false);
    setHourlyRate(defaultHourlyRate || "");
    setNotes("");
    setIsRecurring(false);
    setDayOfWeek(0);
    setStartDate("");
    setEndDate("");
    setWorkDate(selectedStr);

    enqueueRequest(async () => {
      try {
        const payload = {
          work_date: isRecurring ? selectedStr : workDate,
          start_time: startTime,
          end_time: endTime,
          hourly_rate: rate,
          notes,
          tax_enabled: taxEnabled,
          tax_percent: parseFloat(taxPercent) || 0,
          is_recurring: isRecurring,
          day_of_week: isRecurring ? dayOfWeek : null,
          start_date: isRecurring ? startDate : null,
          end_date: isRecurring && endDate ? endDate : null,
        };

        const res = await axios.post(`${api}/work`, payload, { headers });
        const newEntry = res.data.entries?.[0] || res.data.entry || res.data;
        setEntries(prev => prev.map(e => e.id === tempId ? newEntry : e));
        await refreshSummary();
        onToast("✅ Dodano wpis pracy");
      } catch (err) {
        setEntries(prev => prev.filter(e => e.id !== tempId));
        onToast(`❌ ${err.response?.data?.detail || "Błąd dodawania"}`);
      }
    }, true);
  };

  // Usuwa wpis pracy
  const deleteEntry = (entry) => {
    enqueueRequest(async () => {
      try {
        const res = await axios.delete(`${api}/work/${entry.id}`, { headers });
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        applyUserFromResponse(res.data, onUserUpdate);
        await refreshSummary();
        onToast("🗑️ Usunięto wpis");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd usuwania");
      }
    });
  };

  // Usuwa wszystkie nieukończone wpisy
  const deleteUnfinishedEntries = () => {
    const unfinished = entries.filter((e) => !e.completed);
    if (unfinished.length === 0) {
      onToast("Brak nieukończonych wpisów");
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz usunąć ${unfinished.length} nieukończonych wpisów pracy?`)) {
      return;
    }
    enqueueRequest(async () => {
      try {
        const deletePromises = unfinished.map((entry) => axios.delete(`${api}/work/${entry.id}`, { headers }));
        await Promise.all(deletePromises);
        setEntries((prev) => prev.filter((e) => e.completed));
        await refreshSummary();
        onToast(`🗑️ Usunięto ${unfinished.length} nieukończonych wpisów`);
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd usuwania");
      }
    });
  };

  // Kopiuje wpis pracy
  const copyWork = async (entryId, targetDate) => {
    const original = entries.find(e => e.id === entryId);
    if (!original) return;

    enqueueRequest(async () => {
      try {
        const payload = {
          work_date: targetDate,
          start_time: original.start_time,
          end_time: original.end_time,
          hourly_rate: original.hourly_rate,
          notes: original.notes || "",
          tax_enabled: original.tax_enabled || false,
          tax_percent: original.tax_percent || 0,
          is_recurring: false,
        };

        await axios.post(`${api}/work`, payload, { headers });
        await refreshSummary();

        const res = await axios.get(`${api}/work`, { headers });
        setEntries(res.data);
        setCopyModal(null);
        onToast("📋 Skopiowano pracę");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd kopiowania");
      }
    });
  };

  // Rozpoczyna edycję
  const startEdit = (entry) => {
    if (entry.completed) {
      onToast("Nie można edytować ukończonej pracy");
      return;
    }
    setEditingId(entry.id);
    setEditDate(entry.work_date);
    setEditStartTime(entry.start_time);
    setEditEndTime(entry.end_time);
    setEditRate(entry.hourly_rate.toFixed(2).replace(".", ","));
    setEditNotes(entry.notes || "");
    setEditIsRecurring(entry.is_recurring || false);
    setEditDayOfWeek(entry.day_of_week || 0);
    setEditStartDate(entry.start_date ? entry.start_date.slice(0, 10) : "");
    setEditEndDate(entry.end_date ? entry.end_date.slice(0, 10) : "");
  };

  // Zapisuje edytowany wpis
  const saveEdit = (entry) => {
    enqueueRequest(async () => {
      try {
        const rateValue = parseRateInput(editRate);
        const rate = parseFloat(rateValue);
        if (!rate || rate <= 0) {
          onToast("Podaj stawkę godzinową");
          return;
        }

        const original = entries.find(e => e.id === entry.id);
        if (!original) return;

        const timeChanged = (editStartTime !== original.start_time) || (editEndTime !== original.end_time) || (editDate !== original.work_date);

        // Automatyczne ukończenie jeśli czas minął
        let newCompleted = original.completed;
        if (timeChanged) {
          const today = new Date().toISOString().slice(0, 10);
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const [h, m] = editEndTime.split(":").map(Number);
          const endMinutes = h * 60 + m;

          if (editDate < today) {
            newCompleted = true;
          } else if (editDate === today && endMinutes <= nowMinutes) {
            newCompleted = true;
          } else if (editDate === today && endMinutes > nowMinutes) {
            newCompleted = false;
          } else if (editDate > today) {
            newCompleted = false;
          }
        }

        const res = await axios.patch(`${api}/work/${entry.id}`, {
          work_date: editDate,
          start_time: editStartTime,
          end_time: editEndTime,
          hourly_rate: rate,
          notes: editNotes,
          is_recurring: editIsRecurring,
          day_of_week: editIsRecurring ? editDayOfWeek : null,
          start_date: editIsRecurring ? editStartDate : null,
          end_date: editIsRecurring && editEndDate ? editEndDate : null,
          completed: newCompleted
        }, { headers });
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.data.entry : e)));
        await refreshSummary();
        setEditingId(null);
        onToast("✅ Zapisano zmiany");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd zapisu");
      }
    });
  };

  return (
    <div className="module-panel earnings-panel">
      {/* Podsumowanie finansowe */}
      <div className="earnings-summary">
        <div className="earnings-stat">
          <span className="earnings-stat-label">Dzień</span>
          <strong>{formatMoney(dayTotal)}</strong>
        </div>
        <div className="earnings-stat">
          <span className="earnings-stat-label">Miesiąc</span>
          <strong>{formatMoney(monthTotal)}</strong>
        </div>
        <div className="earnings-stat">
          <span className="earnings-stat-label">Rok</span>
          <strong>{formatMoney(yearTotal)}</strong>
        </div>
        <div className="earnings-stat muted">
          <span className="earnings-stat-label">Łącznie</span>
          <strong>{formatMoney(summary?.all_time?.net || 0)}</strong>
        </div>
      </div>

      {/* Kalendarz zarobków */}
      <SharedCalendar
        items={entries}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        matchItemToDate={(item, dateStr) => item.work_date === dateStr}
        getItemLabel={(item) => `${item.start_time}–${item.end_time} · ${formatMoney(item.net)}`}
        isItemCompleted={(item) => item.completed}
        renderItemMeta={(item) => (
          <div className="task-meta">
            <span className="badge category">{item.hours}h × {formatRate(item.hourly_rate)}</span>
            {item.tax_enabled && <span className="badge timing-late">Podatek {item.tax_percent}%</span>}
            {item.is_recurring && <span className="badge category">🔁 {WEEKDAYS_LONG[item.day_of_week]}</span>}
            {item.end_date && <span className="badge timing-late">Do {item.end_date}</span>}
            {item.completed && <span className="badge exp">Potwierdzone</span>}
          </div>
        )}
        onItemDelete={deleteEntry}
        sectionTitle="💰 Kalendarz zarobków"
        emptyLabel="Brak pracy"
        itemNoun="wpisów"
        collapsedStorageKey="questdo-earnings-calendar-collapsed"
        defaultCollapsed={false}
        freeDays={freeDays}
        recurringEvents={recurringEvents}
        freeDayManager={setFreeDays && (
          <FreeDayManager
            freeDays={freeDays}
            setFreeDays={setFreeDays}
            selectedDate={selectedDate}
            api={api}
            headers={headers}
            onToast={onToast}
            enqueueRequest={enqueueRequest}
          />
        )}
      />

      {/* Lista wpisów dla wybranego dnia */}
      <div className="day-tasks-panel">
        <div className="tasks-header">
          <h3>
            Praca - {new Date(`${selectedStr}T12:00:00`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
            {(() => {
              const freeDay = freeDays.find(fd => fd.date === selectedStr);
              const holidayName = freeDay?.notes || null;
              return holidayName && (
                <span style={{ fontWeight: 'normal', color: '#aaa' }}>
                  {' '}- <strong style={{ color: '#ff8906' }}>{holidayName}</strong>
                </span>
              );
            })()}
          </h3>
          <span className="earnings-day-total">{formatMoney(dayTotal)}</span>
        </div>

        {dayEntries.length === 0 && <p className="empty">Brak wpisów pracy na ten dzień.</p>}

        {/* Modal kopiowania */}
        {copyModal && (
          <div className="add-task">
            <h3>📋 Kopiuj pracę</h3>
            <DatePicker value={copyModal.targetDate} onChange={(date) => setCopyModal({ ...copyModal, targetDate: date })} label="Data docelowa" />
            <div className="row">
              <button type="button" className="add-task-btn" onClick={() => copyWork(copyModal.entryId, copyModal.targetDate)}>Kopiuj</button>
              <button type="button" className="cancel-btn" onClick={() => setCopyModal(null)}>Anuluj</button>
            </div>
          </div>
        )}

        {dayEntries.map((entry) => {
          const editing = editingId === entry.id;
          const isVirtual = entry.isRecurringVirtual;

          // Wirtualne wydarzenia
          if (isVirtual) {
            return (
              <div key={entry.id} className="task-card event virtual-event">
                <div className="task-check event-indicator">{getEventCategoryEmoji(entry.event_category || 'reminder')}</div>
                <div className="task-info">
                  <h4><span className="event-mark">{getEventCategoryEmoji(entry.event_category || 'reminder')} </span>{entry.title}</h4>
                  <div className="task-meta">
                    <span className="badge event-type">{getEventCategoryLabel(entry.event_category || 'reminder')}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={entry.id} className={`task-card ${entry.completed ? "done" : "medium"}`}>
              {editing ? (
                // Tryb edycji
                <div className="edit-mode">
                  <DatePicker value={editDate} onChange={setEditDate} />
                  <TimePicker value={editStartTime} onChange={setEditStartTime} />
                  <TimePicker value={editEndTime} onChange={setEditEndTime} />
                  <input type="text" placeholder="Stawka (zł)" value={editRate} onChange={(e) => setEditRate(e.target.value)} />
                  <input placeholder="Notatka" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                  <label className="important-toggle">
                    <input type="checkbox" checked={editIsRecurring} onChange={(e) => setEditIsRecurring(e.target.checked)} />
                    <span>Cykliczne</span>
                  </label>
                  {editIsRecurring ? (
                    <>
                      <select value={editDayOfWeek} onChange={(e) => setEditDayOfWeek(Number(e.target.value))}>
                        {WEEKDAYS_LONG.map((day, idx) => (
                          <option key={day} value={idx}>{day}</option>
                        ))}
                      </select>
                      <DatePicker value={editStartDate} onChange={setEditStartDate} label="Data rozpoczęcia" />
                      <DatePicker value={editEndDate} onChange={setEditEndDate} label="Data zakończenia (opcjonalnie)" />
                    </>
                  ) : null}
                  <button type="button" className="save-mini" onClick={() => saveEdit(entry)}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => setEditingId(null)}>✗</button>
                </div>
              ) : (
                // Widok normalny
                <>
                  <div className="task-info">
                    <h4 className={entry.completed ? "done" : ""}>{entry.start_time} – {entry.end_time}</h4>
                    {entry.notes && <p className={entry.completed ? "done-desc" : ""}>{entry.notes}</p>}
                    <div className="task-meta">
                      <span className="badge category">{entry.hours}h × {formatRate(entry.hourly_rate)}</span>
                      <span className="badge exp">Brutto {formatMoney(entry.gross)}</span>
                      {entry.tax_enabled && <span className="badge timing-late">Podatek {entry.tax_percent}% (−{formatMoney(entry.tax)})</span>}
                      <span className="badge category">Netto {formatMoney(entry.net)}</span>
                      {entry.is_recurring && <span className="badge category">🔁 {WEEKDAYS_LONG[entry.day_of_week]}</span>}
                      {entry.end_date && <span className="badge timing-late">Do {entry.end_date}</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    {!entry.completed && (
                      <button type="button" className="icon-btn" onClick={() => startEdit(entry)} title="Edytuj">✏️</button>
                    )}
                    <button type="button" className="icon-btn" onClick={() => setCopyModal({ entryId: entry.id, targetDate: getWarsawDateStr() })} title="Kopiuj">📋</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteEntry(entry)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Przycisk dodawania i usuwania */}
      {!showAdd ? (
        <div className="row panel-actions-row">
          <button type="button" className="add-task-btn" onClick={() => {
            setShowAdd(true);
            if (defaultHourlyRate && !hourlyRate) {
              setHourlyRate(defaultHourlyRate);
            }
          }}>+ Dodaj pracę na ten dzień</button>
          <button type="button" className="danger-btn danger-btn--inline" onClick={deleteUnfinishedEntries}>🗑️ Usuń nieukończoną pracę</button>
        </div>
      ) : (
        // Formularz dodawania
        <div className="add-task">
          <h3>+ Nowy wpis pracy ({selectedStr})</h3>
          <div className="add-task-meta">
            <TimePicker value={startTime} onChange={setStartTime} label="Od:" />
            <TimePicker value={endTime} onChange={setEndTime} label="Do:" />
          </div>

          <div className="rate-input-group">
            <input
              type="text"
              placeholder="Stawka za godzinę (zł) *"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
            <button
              type="button"
              className="save-default-btn"
              onClick={saveAsDefaultRate}
              disabled={isSavingDefault}
              title="Zapisz jako domyślną stawkę"
            >
              {isSavingDefault ? "⏳" : "⭐ Domyślna"}
            </button>
          </div>

          <input placeholder="Notatka / miejsce pracy (opcjonalnie)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <label className="important-toggle">
            <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
            <span>Odlicz podatek</span>
          </label>
          {taxEnabled && (
            <input type="number" min="0" max="100" step="0.1" placeholder="Procent podatku" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          )}

          <label className="important-toggle">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            <span>Cykliczne (co tydzień)</span>
          </label>
          {isRecurring ? (
            <>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {WEEKDAYS_LONG.map((day, idx) => (
                  <option key={day} value={idx}>{day}</option>
                ))}
              </select>
              <DatePicker value={startDate} onChange={setStartDate} label="Data rozpoczęcia" />
              <DatePicker value={endDate} onChange={setEndDate} label="Data zakończenia (opcjonalnie)" />
            </>
          ) : (
            <DatePicker value={workDate} onChange={setWorkDate} label="Data" />
          )}

          <div className="row">
            <button type="button" className="add-task-btn" onClick={addEntry}>Zapisz wpis</button>
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}