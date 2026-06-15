import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import SharedCalendar, { weekdayIndex, WEEKDAYS_LONG } from "./SharedCalendar";
import TimePicker from "./TimePicker";
import DatePicker from "./DatePicker";
import { applyUserFromResponse } from "./helpers";

// Funkcja formatująca pieniądze z przecinkiem i 2 miejscami po przecinku
function formatMoney(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł`;
}

// Funkcja formatująca stawkę z przecinkiem i 2 miejscami po przecinku
function formatRate(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł/h`;
}

function matchWorkToDate(entry, dateStr) {
  const targetDate = new Date(dateStr);
  if (entry.is_recurring) {
    if (entry.end_date) {
      const endDate = new Date(entry.end_date);
      if (targetDate > endDate) {
        return false;
      }
    }
    return entry.day_of_week === weekdayIndex(dateStr);
  }
  return entry.work_date === dateStr;
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
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState("12");
  const [savedRates, setSavedRates] = useState([]);
  const [showRateDropdown, setShowRateDropdown] = useState(false);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [endDate, setEndDate] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editDayOfWeek, setEditDayOfWeek] = useState(0);
  const [editEndDate, setEditEndDate] = useState("");
  const [isSavingRate, setIsSavingRate] = useState(false);

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  const dayEntries = useMemo(
    () => entries.filter((e) => matchWorkToDate(e, selectedStr)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, selectedStr],
  );

  useEffect(() => {
    loadSavedRates();
    loadDefaultHourlyRate();
  }, []);

  const loadDefaultHourlyRate = async () => {
    try {
      const res = await axios.get(`${api}/settings/default-hourly-rate`, { headers });
      setDefaultHourlyRate(res.data.rate ? String(res.data.rate) : "");
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

  const loadSavedRates = async () => {
    try {
      const res = await axios.get(`${api}/hourly-rates`, { headers });
      setSavedRates(res.data);
    } catch {
      /* ignore */
    }
  };

  const saveCurrentRate = async () => {
    const rate = parseFloat(String(hourlyRate).replace(",", "."));
    if (!rate || rate <= 0) {
      onToast("Podaj stawkę godzinową");
      return;
    }
    if (isSavingRate) return;
    setIsSavingRate(true);
    try {
      await axios.post(`${api}/hourly-rates`, { rate, label: "" }, { headers });
      await loadSavedRates();
      onToast("💾 Zapisano stawkę");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu stawki");
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleRateChange = (value) => {
    setHourlyRate(value);
  };

  const saveAsDefaultRate = async () => {
    const rate = parseFloat(String(hourlyRate).replace(",", "."));
    if (!rate || rate <= 0) {
      onToast("Podaj stawkę godzinową");
      return;
    }
    try {
      await axios.post(`${api}/settings/default-hourly-rate`, { rate }, { headers });
      setDefaultHourlyRate(String(rate));
      onToast("💾 Zapisano jako domyślną stawkę");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu domyślnej stawki");
    }
  };

  const selectSavedRate = (rate) => {
    setHourlyRate(String(rate));
    setShowRateDropdown(false);
  };

  const deleteSavedRate = async (rateId) => {
    try {
      await axios.delete(`${api}/hourly-rates/${rateId}`, { headers });
      await loadSavedRates();
      onToast("🗑️ Usunięto stawkę");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd usuwania stawki");
    }
  };

  const addEntry = () => {
    const rate = parseFloat(String(hourlyRate).replace(",", "."));
    if (!rate || rate <= 0) {
      onToast("Podaj stawkę godzinową");
      return;
    }
    enqueueRequest(async () => {
      try {
        const res = await axios.post(`${api}/work`, {
          work_date: selectedStr,
          start_time: startTime,
          end_time: endTime,
          hourly_rate: rate,
          notes,
          tax_enabled: taxEnabled,
          tax_percent: parseFloat(taxPercent) || 0,
          is_recurring: isRecurring,
          day_of_week: isRecurring ? dayOfWeek : null,
          end_date: isRecurring && endDate ? endDate : null,
        }, { headers });
        setEntries((prev) => [res.data, ...prev]);
        await refreshSummary();
        setShowAdd(false);
        setHourlyRate(defaultHourlyRate || "");
        setNotes("");
        setIsRecurring(false);
        setDayOfWeek(0);
        setEndDate("");
        onToast("✅ Dodano wpis pracy");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd dodawania");
      }
    });
  };

  const toggleCompleted = (entry) => {
    enqueueRequest(async () => {
      try {
        const res = await axios.patch(`${api}/work/${entry.id}`, { completed: !entry.completed }, { headers });
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.data.entry : e)));
        applyUserFromResponse(res.data, onUserUpdate);
        await refreshSummary();
        if (res.data.exp_gained > 0) onToast(`💰 Praca potwierdzona! +${res.data.exp_gained} EXP`);
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd aktualizacji");
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

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditDate(entry.work_date);
    setEditStartTime(entry.start_time);
    setEditEndTime(entry.end_time);
    setEditRate(entry.hourly_rate);
    setEditNotes(entry.notes || "");
    setEditIsRecurring(entry.is_recurring || false);
    setEditDayOfWeek(entry.day_of_week || 0);
    setEditEndDate(entry.end_date ? entry.end_date.slice(0, 10) : "");
  };

  const saveEdit = (entry) => {
    enqueueRequest(async () => {
      try {
        const rate = parseFloat(String(editRate).replace(",", "."));
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

  // Format display value for default hourly rate (z przecinkiem)
  const displayDefaultRate = defaultHourlyRate ? parseFloat(defaultHourlyRate).toFixed(2).replace(".", ",") : "";

  return (
    <div className="module-panel earnings-panel">
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

      <SharedCalendar
        items={entries}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        matchItemToDate={matchWorkToDate}
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
        onItemToggle={toggleCompleted}
        onItemDelete={deleteEntry}
        sectionTitle="💰 Kalendarz zarobków"
        emptyLabel="Brak pracy"
        itemNoun="wpisów"
        collapsedStorageKey="questdo-earnings-calendar-collapsed"
        defaultCollapsed={false}
      />

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
              <button type="button" className={`task-check ${entry.completed ? "checked" : ""}`} onClick={() => toggleCompleted(entry)}>
                {entry.completed ? "✓" : ""}
              </button>
              {editing ? (
                <div className="edit-mode">
                  <DatePicker value={editDate} onChange={setEditDate} />
                  <TimePicker value={editStartTime} onChange={setEditStartTime} />
                  <TimePicker value={editEndTime} onChange={setEditEndTime} />
                  <input type="number" min="0" step="0.01" placeholder="Stawka (zł)" value={editRate} onChange={(e) => setEditRate(e.target.value)} />
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
                      <input type="date" placeholder="Data zakończenia" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
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
                      <span className="badge exp">+10 EXP</span>
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

      {!showAdd ? (
        <button type="button" className="add-task-btn" onClick={() => {
          setShowAdd(true);
          if (defaultHourlyRate && !hourlyRate) {
            setHourlyRate(defaultHourlyRate);
          }
        }}>+ Dodaj pracę na ten dzień</button>
      ) : (
        <div className="add-task">
          <h3>+ Nowy wpis pracy ({selectedStr})</h3>
          <div className="add-task-meta">
            <TimePicker value={startTime} onChange={setStartTime} label="Od:" />
            <TimePicker value={endTime} onChange={setEndTime} label="Do:" />
          </div>

          {/* Domyślna stawka */}
          <div className="form-row-inline" style={{ alignItems: "center", marginBottom: "12px" }}>
            <label style={{ color: "#aaa", fontSize: "0.9rem", minWidth: "160px" }}>Domyślna stawka godzinowa:</label>
            <span style={{ color: "#ff8906", fontWeight: "bold" }}>{displayDefaultRate ? `${displayDefaultRate} zł/h` : "brak"}</span>
            <button type="button" className="icon-btn" onClick={saveAsDefaultRate} style={{ marginLeft: "auto" }} title="Zapisz bieżącą jako domyślną">
              💾
            </button>
          </div>

          <div className="rate-input-group">
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              placeholder="Stawka za godzinę (zł) *" 
              value={hourlyRate} 
              onChange={(e) => handleRateChange(e.target.value)} 
              style={{ flex: 1, minWidth: "120px" }}
            />
            <select 
              value={hourlyRate} 
              onChange={(e) => setHourlyRate(e.target.value)} 
              className="rate-dropdown"
              style={{ flex: "0 0 auto", width: "auto", minWidth: "140px", maxWidth: "180px" }}
            >
              <option value="">Wybierz zapisaną</option>
              {savedRates.sort((a, b) => b.rate - a.rate).map((rate) => (
                <option key={rate.id} value={rate.rate}>{formatRate(rate.rate)}</option>
              ))}
            </select>
            <button 
              type="button" 
              className="rate-save-btn" 
              onClick={saveCurrentRate} 
              disabled={isSavingRate}
              style={{ flex: "0 0 auto", whiteSpace: "nowrap", minHeight: "44px" }}
            >
              {isSavingRate ? "⏳" : "💾 Zapisz"}
            </button>
          </div>

          {savedRates.length > 0 && (
            <div className="saved-rates-list">
              {savedRates.sort((a, b) => b.rate - a.rate).map((rate) => (
                <div key={rate.id} className="saved-rate-item">
                  <span onClick={() => selectSavedRate(rate.rate)}>{formatRate(rate.rate)}</span>
                  <button type="button" className="icon-btn delete" onClick={() => deleteSavedRate(rate.id)}>🗑️</button>
                </div>
              ))}
            </div>
          )}

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
              <input type="date" placeholder="Data zakończenia (opcjonalnie)" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </>
          ) : null}
          
          <div className="row">
            <button type="button" className="add-task-btn" onClick={addEntry}>Zapisz wpis</button>
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}