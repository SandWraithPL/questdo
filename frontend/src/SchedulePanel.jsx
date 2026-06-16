import { useMemo, useState } from "react";
import axios from "axios";
import SharedCalendar, { weekdayIndex, WEEKDAYS_LONG } from "./SharedCalendar";
import TimePicker from "./TimePicker";
import DatePicker from "./DatePicker";

function matchScheduleToDate(entry, dateStr, freeDays = []) {
  const isFreeDay = freeDays.some(fd => fd.date === dateStr);
  
  if (entry.is_recurring) {
    // Skip recurring entries on free days
    if (isFreeDay) {
      return false;
    }
    return entry.day_of_week === weekdayIndex(dateStr);
  }
  // Allow manual override for non-recurring entries
  return entry.entry_date === dateStr;
}

export default function SchedulePanel({ api, headers, entries, setEntries, selectedDate, onDateSelect, onToast, enqueueRequest, freeDays = [], setFreeDays }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [isRecurring, setIsRecurring] = useState(true);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [entryDate, setEntryDate] = useState(() => {
    const d = selectedDate instanceof Date ? selectedDate : new Date();
    return d.toISOString().slice(0, 10);
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [showFreeDayManager, setShowFreeDayManager] = useState(false);
  const [freeDayType, setFreeDayType] = useState("holiday");
  const [freeDayName, setFreeDayName] = useState("");

  const dayEntries = useMemo(
    () => entries.filter((e) => matchScheduleToDate(e, selectedDate instanceof Date ? selectedDate.toISOString().slice(0, 10) : String(selectedDate).slice(0, 10), freeDays)),
    [entries, selectedDate, freeDays],
  );

  const sortedDayEntries = [...dayEntries].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const addEntry = () => {
    if (!title.trim()) {
      onToast("Podaj nazwę zajęć");
      return;
    }
    enqueueRequest(async () => {
      try {
        const payload = {
          title,
          location,
          lecturer,
          start_time: startTime,
          end_time: endTime,
          is_recurring: isRecurring,
          day_of_week: isRecurring ? dayOfWeek : null,
          entry_date: isRecurring ? null : entryDate,
        };
        const res = await axios.post(`${api}/schedule`, payload, { headers });
        setEntries((prev) => [...prev, res.data]);
        setTitle("");
        setLocation("");
        setLecturer("");
        setShowAdd(false);
        onToast("✅ Dodano zajęcia do planu");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd dodawania");
      }
    });
  };

  const deleteEntry = (entry) => {
    enqueueRequest(async () => {
      try {
        await axios.delete(`${api}/schedule/${entry.id}`, { headers });
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        onToast("🗑️ Usunięto z planu");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd usuwania");
      }
    });
  };

  const handleExport = async () => {
    try {
      const res = await axios.post(`${api}/schedule/export`, {}, { headers });
      const blob = new Blob([res.data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      onToast("📥 Wyeksportowano plan zajęć");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd eksportu");
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      onToast("Wklej zawartość pliku");
      return;
    }

    const entries = [];
    const lines = importText.split("\n");
    let currentEntry = null;

    for (const line of lines) {
      if (line === "[ENTRY]") {
        currentEntry = {};
      } else if (currentEntry && line.includes(":")) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();
        currentEntry[key] = value;
      } else if (line === "" && currentEntry) {
        entries.push(currentEntry);
        currentEntry = null;
      }
    }

    if (currentEntry) entries.push(currentEntry);

    if (entries.length === 0) {
      onToast("Nie znaleziono żadnych wpisów w pliku");
      return;
    }

    const invalidEntries = entries.filter(e => !e.title || !e.title.trim());
    if (invalidEntries.length > 0) {
      onToast(`${invalidEntries.length} wpisów nie ma tytułu i zostanie pominiętych`);
    }

    const validEntries = entries.filter(e => e.title && e.title.trim());

    try {
      const res = await axios.post(`${api}/schedule/import`, { entries: validEntries }, { headers });
      setEntries((prev) => [...prev, ...Array(res.data.imported).fill({})]); // Reload needed
      setShowImport(false);
      setImportText("");
      onToast(`📤 Zaimportowano ${res.data.imported} wpisów`);
      if (res.data.errors.length > 0) {
        onToast(`Błędy: ${res.data.errors.slice(0, 3).join(", ")}`);
      }
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd importu");
    }
  };

  const handleDeleteAll = () => {
    if (entries.length === 0) {
      onToast("Plan zajęć jest pusty");
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz usunąć cały plan zajęć (${entries.length} wpisów)?`)) {
      return;
    }
    enqueueRequest(async () => {
      try {
        const res = await axios.delete(`${api}/schedule/all`, { headers });
        console.log("Delete response:", res.data);
        setEntries([]);
        onToast("🗑️ Usunięto cały plan zajęć");
      } catch (err) {
        console.error("Delete error:", err);
        onToast(err.response?.data?.detail || "Błąd usuwania planu");
      }
    });
  };

  const handleCreateFreeDay = () => {
    enqueueRequest(async () => {
      try {
        const selectedStr = selectedDate instanceof Date ? selectedDate.toISOString().slice(0, 10) : String(selectedDate).slice(0, 10);
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
  };

  const handleDeleteFreeDay = () => {
    const selectedStr = selectedDate instanceof Date ? selectedDate.toISOString().slice(0, 10) : String(selectedDate).slice(0, 10);
    const existingFreeDay = freeDays.find(fd => fd.date === selectedStr);
    if (!existingFreeDay) return;

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
  };

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  return (
    <div className="module-panel schedule-panel">
      <SharedCalendar
        items={entries}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        matchItemToDate={(item, dateStr) => matchScheduleToDate(item, dateStr, freeDays)}
        getItemLabel={(item) => item.title}
        isItemCompleted={() => false}
        renderItemMeta={(item) => (
          <div className="task-meta">
            <span className="badge category">🕐 {item.start_time}–{item.end_time}</span>
            {item.location && <span className="badge category">📍 {item.location}</span>}
            {item.lecturer && <span className="badge category">👤 {item.lecturer}</span>}
          </div>
        )}
        onItemDelete={deleteEntry}
        sectionTitle="📚 Plan zajęć"
        emptyLabel="Brak zajęć"
        itemNoun="zajęć"
        collapsedStorageKey="questdo-schedule-calendar-collapsed"
        defaultCollapsed={false}
        freeDays={freeDays}
      />

      <div className="day-tasks-panel">
        <div className="tasks-header">
          <h3>Zajęcia — {new Date(`${selectedStr}T12:00:00`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</h3>
          <div className="import-export-buttons">
            <button type="button" className="icon-btn" onClick={() => setShowFreeDayManager(!showFreeDayManager)} title="Zarządzaj dniami wolnymi">🎉</button>
            <button type="button" className="icon-btn" onClick={handleExport} title="Eksportuj plan">📥</button>
            <button type="button" className="icon-btn" onClick={() => setShowImport(!showImport)} title="Importuj plan">📤</button>
            <button type="button" className="danger-btn danger-btn--inline" onClick={handleDeleteAll} title="Usuń cały plan">🗑️ Usuń cały plan</button>
          </div>
        </div>
        {sortedDayEntries.length === 0 && <p className="empty">Brak zajęć w tym dniu.</p>}
        {sortedDayEntries.map((entry) => (
          <div key={entry.id} className="task-card medium schedule-card">
            <div className="task-info">
              <h4>{entry.title}</h4>
              <div className="task-meta">
                <span className="badge category">🕐 {entry.start_time}–{entry.end_time}</span>
                {entry.is_recurring && <span className="badge category">🔁 {WEEKDAYS_LONG[entry.day_of_week]}</span>}
                {entry.location && <span className="badge category">📍 {entry.location}</span>}
                {entry.lecturer && <span className="badge category">👤 {entry.lecturer}</span>}
              </div>
            </div>
            <button type="button" className="icon-btn delete" onClick={() => deleteEntry(entry)}>🗑️</button>
          </div>
        ))}
      </div>

      {showImport && (
        <div className="add-task">
          <h3>📤 Importuj plan zajęć</h3>
          <textarea
            placeholder="Wklej zawartość pliku eksportu tutaj..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
          />
          <div className="row">
            <button type="button" className="add-task-btn" onClick={handleImport}>Importuj</button>
            <button type="button" className="cancel-btn" onClick={() => setShowImport(false)}>Anuluj</button>
          </div>
        </div>
      )}

      {showFreeDayManager && (
        <div className="add-task">
          <h3>🎉 Zarządzaj dniami wolnymi</h3>
          {(() => {
            const selectedStr = selectedDate instanceof Date ? selectedDate.toISOString().slice(0, 10) : String(selectedDate).slice(0, 10);
            const existingFreeDay = freeDays.find(fd => fd.date === selectedStr);
            if (existingFreeDay) {
              return (
                <div>
                  <p>Ten dzień jest oznaczony jako: <strong>{existingFreeDay.day_type === "holiday" ? "Święto" : existingFreeDay.day_type === "deans_day" ? "Dzień dziekański" : "Dzień rektorski"}</strong>
                  {existingFreeDay.notes && <span> — {existingFreeDay.notes}</span>}</p>
                  <div className="row" style={{ marginTop: 12, gap: "8px" }}>
                    <button type="button" className="danger-btn" onClick={handleDeleteFreeDay}>🗑️ Usuń oznaczenie</button>
                    <button type="button" className="cancel-btn" onClick={() => setShowFreeDayManager(false)}>Anuluj</button>
                  </div>
                </div>
              );
            }
            return (
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
            );
          })()}
        </div>
      )}

      {!showAdd ? (
        <button type="button" className="add-task-btn" onClick={() => setShowAdd(true)}>+ Dodaj zajęcia</button>
      ) : (
        <div className="add-task">
          <h3>+ Nowe zajęcia</h3>
          <input placeholder="Nazwa przedmiotu / zajęć" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Sala / budynek (opcjonalnie)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <input placeholder="Prowadzący (opcjonalnie)" value={lecturer} onChange={(e) => setLecturer(e.target.value)} />
          <div className="add-task-meta">
            <TimePicker value={startTime} onChange={setStartTime} label="Od:" />
            <TimePicker value={endTime} onChange={setEndTime} label="Do:" />
          </div>
          <label className="important-toggle">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            <span>Cykliczne (co tydzień)</span>
          </label>
          {isRecurring ? (
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {WEEKDAYS_LONG.map((day, idx) => (
                <option key={day} value={idx}>{day}</option>
              ))}
            </select>
          ) : (
            <DatePicker value={entryDate} onChange={setEntryDate} label="Data" />
          )}
          <div className="row">
            <button type="button" className="add-task-btn" onClick={addEntry}>Dodaj do planu</button>
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}
