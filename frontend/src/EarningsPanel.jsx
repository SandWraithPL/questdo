import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import SharedCalendar from "./SharedCalendar";
import TimePicker from "./TimePicker";
import DatePicker from "./DatePicker";

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} zł`;
}

function formatRate(value) {
  return `${Number(value || 0).toFixed(2)} zł/h`;
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
  const [showRateSelector, setShowRateSelector] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.work_date === selectedStr).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, selectedStr],
  );

  useEffect(() => {
    loadSavedRates();
  }, []);

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
    try {
      await axios.post(`${api}/hourly-rates`, { rate, label: "" }, { headers });
      await loadSavedRates();
      onToast("💾 Zapisano stawkę");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu stawki");
    }
  };

  const selectSavedRate = (rate) => {
    setHourlyRate(String(rate));
    setShowRateSelector(false);
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

  const applyUserFromResponse = (data) => {
    if (data?.exp !== undefined) {
      onUserUpdate({
        exp: data.exp,
        level: data.level,
        title: data.title,
        next_level_exp: data.next_level_exp,
        next_level_title: data.next_level_title,
      });
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
        }, { headers });
        setEntries((prev) => [res.data, ...prev]);
        await refreshSummary();
        setShowAdd(false);
        setHourlyRate("");
        setNotes("");
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
        applyUserFromResponse(res.data);
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
        applyUserFromResponse(res.data);
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
        matchItemToDate={(item, dateStr) => item.work_date === dateStr}
        getItemLabel={(item) => `${item.start_time}–${item.end_time} · ${formatMoney(item.net)}`}
        isItemCompleted={(item) => item.completed}
        renderItemMeta={(item) => (
          <div className="task-meta">
            <span className="badge category">{item.hours}h × {formatRate(item.hourly_rate)}</span>
            {item.tax_enabled && <span className="badge timing-late">Podatek {item.tax_percent}%</span>}
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
        <button type="button" className="add-task-btn" onClick={() => setShowAdd(true)}>+ Dodaj pracę na ten dzień</button>
      ) : (
        <div className="add-task">
          <h3>+ Nowy wpis pracy ({selectedStr})</h3>
          <div className="add-task-meta">
            <TimePicker value={startTime} onChange={setStartTime} label="Od:" />
            <TimePicker value={endTime} onChange={setEndTime} label="Do:" />
          </div>
          <div className="rate-input-group">
            <input type="number" min="0" step="0.01" placeholder="Stawka za godzinę (zł)" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            <button type="button" className="icon-btn rate-save-btn" onClick={saveCurrentRate} title="Zapisz stawkę">💾</button>
            <button type="button" className="icon-btn rate-select-btn" onClick={() => setShowRateSelector(!showRateSelector)} title="Wybierz zapisaną stawkę">📋</button>
          </div>
          {showRateSelector && savedRates.length > 0 && (
            <div className="saved-rates-list">
              {savedRates.map((rate) => (
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
          <div className="row">
            <button type="button" onClick={addEntry}>Zapisz wpis</button>
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}
