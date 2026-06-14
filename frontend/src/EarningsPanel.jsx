import { useMemo, useState } from "react";
import axios from "axios";
import SharedCalendar from "./SharedCalendar";

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} zł`;
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

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.work_date === selectedStr).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, selectedStr],
  );

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
            <span className="badge category">{item.hours}h × {item.hourly_rate} zł/h</span>
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
        {dayEntries.map((entry) => (
          <div key={entry.id} className={`task-card ${entry.completed ? "done" : "medium"}`}>
            <button type="button" className={`task-check ${entry.completed ? "checked" : ""}`} onClick={() => toggleCompleted(entry)}>
              {entry.completed ? "✓" : ""}
            </button>
            <div className="task-info">
              <h4 className={entry.completed ? "done" : ""}>{entry.start_time} – {entry.end_time}</h4>
              {entry.notes && <p className={entry.completed ? "done-desc" : ""}>{entry.notes}</p>}
              <div className="task-meta">
                <span className="badge category">{entry.hours}h × {entry.hourly_rate} zł/h</span>
                <span className="badge exp">Brutto {formatMoney(entry.gross)}</span>
                {entry.tax_enabled && <span className="badge timing-late">Podatek {entry.tax_percent}% (−{formatMoney(entry.tax)})</span>}
                <span className="badge category">Netto {formatMoney(entry.net)}</span>
                {entry.completed && <span className="badge exp">+8 EXP</span>}
              </div>
            </div>
            <button type="button" className="icon-btn delete" onClick={() => deleteEntry(entry)}>🗑️</button>
          </div>
        ))}
      </div>

      {!showAdd ? (
        <button type="button" className="add-task-btn" onClick={() => setShowAdd(true)}>+ Dodaj pracę na ten dzień</button>
      ) : (
        <div className="add-task">
          <h3>+ Nowy wpis pracy ({selectedStr})</h3>
          <div className="add-task-meta">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <input type="number" min="0" step="0.01" placeholder="Stawka za godzinę (zł)" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
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
