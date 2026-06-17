import { useMemo, useState, useEffect, useRef } from "react";
import axios from "axios";
import SharedCalendar, { weekdayIndex, WEEKDAYS_LONG } from "./SharedCalendar";
import TimePicker from "./TimePicker";
import DatePicker from "./DatePicker";
import { applyUserFromResponse } from "./helpers";

// Komponent FreeDayManager - zarządzanie dniami wolnymi
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

// Funkcja formatująca pieniądze z przecinkiem i 2 miejscami po przecinku
function formatMoney(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł`;
}

// Funkcja formatująca stawkę z przecinkiem i 2 miejscami po przecinku (do wyświetlania)
function formatRate(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł/h`;
}

// Funkcja konwertująca przecinek na kropkę dla API
function parseRateInput(value) {
  if (!value) return "";
  return value.replace(",", ".");
}

function getWarsawDateStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

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
  const autoCompletedIds = useRef(new Set());

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.work_date === selectedStr).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, selectedStr],
  );

  useEffect(() => {
    loadDefaultHourlyRate();
    setWorkDate(selectedStr);
  }, [selectedStr]);

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
    const interval = window.setInterval(checkAutoComplete, 30000);
    return () => window.clearInterval(interval);
  }, [entries, api, headers, onToast, onUserUpdate]);

  const loadDefaultHourlyRate = async () => {
    try {
      const res = await axios.get(`${api}/settings/default-hourly-rate`, { headers });
      const rate = res.data.rate ? parseFloat(res.data.rate).toFixed(2).replace(".", ",") : "";
      setDefaultHourlyRate(rate);
    } catch {
      /* ignore */
    }
  };

  const dayTotal = dayEntries.filter((e) => e.completed).reduce((sum, e) => sum + (e.net || 0), 0);
  const monthKey = selectedStr.slice(0, 7);
  const yearKey = selectedStr.slice(0, 4);
  const monthTotal = summary?.by_month?.[monthKey] || 0;
  const yearTotal = summary?.by_year?.[yearKey] || 0;

  const refreshSummary = async () => {
    try {
      const res = await axios.get(`${api}/work/summary`, { headers });
      setSummary(res.data);
    } catch {
      /* ignore */
    }
  };

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

  const handleRateChange = (value) => {
    setHourlyRate(value);
  };

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
        setEntries((prev) => [res.data, ...prev]);
        await refreshSummary();
        setShowAdd(false);
        setHourlyRate(defaultHourlyRate || "");
        setNotes("");
        setIsRecurring(false);
        setDayOfWeek(0);
        setStartDate("");
        setEndDate("");
        setWorkDate(selectedStr);
        onToast("✅ Dodano wpis pracy");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd dodawania");
      }
    });
  };

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

  const saveEdit = (entry) => {
    enqueueRequest(async () => {
      try {
        const rateValue = parseRateInput(editRate);
        const rate = parseFloat(rateValue);
        if (!rate || rate <= 0) {
          onToast("Podaj stawkę godzinową");
          return;
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
      {/* Summary - bez zmian */}
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

      {/* Kalendarz */}
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
      />
      {setFreeDays && (
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

      {/* Lista wpisów */}
      <div className="day-tasks-panel">
        <div className="tasks-header">
          <h3>Praca — {new Date(`${selectedStr}T12:00:00`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</h3>
          <span className="earnings-day-total">{formatMoney(dayTotal)}</span>
        </div>
        {dayEntries.length === 0 && <p className="empty">Brak wpisów pracy na ten dzień.</p>}
        {dayEntries.map((entry) => {
          const editing = editingId === entry.id;
          return (
            <div key={entry.id} className={`task-card ${entry.completed ? "done" : "medium"}`}>
              {editing ? (
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
                    <button type="button" className="icon-btn" onClick={() => startEdit(entry)} title="Edytuj">✏️</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteEntry(entry)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Przyciski akcji */}
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
              onChange={(e) => handleRateChange(e.target.value)} 
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