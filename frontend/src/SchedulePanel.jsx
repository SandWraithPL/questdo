import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import SharedCalendar, { weekdayIndex, WEEKDAYS_LONG } from "./SharedCalendar";
import TimePicker from "./TimePicker";
import DatePicker from "./DatePicker";

function toDateStr(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === "string") return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

export default function SchedulePanel({ 
  api, 
  headers, 
  entries, 
  setEntries, 
  selectedDate, 
  onDateSelect, 
  onToast, 
  enqueueRequest, 
  freeDays = [], 
  setFreeDays,
  recurringEvents = [],
}) {
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [manualEntryDate, setManualEntryDate] = useState("");
  const [copyModal, setCopyModal] = useState(null); // { entryId, targetDate }
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editLecturer, setEditLecturer] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  useEffect(() => {
    setManualEntryDate(selectedStr);
  }, [selectedStr]);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.entry_date === (selectedDate instanceof Date ? selectedDate.toISOString().slice(0, 10) : String(selectedDate).slice(0, 10))),
    [entries, selectedDate],
  );

  const sortedDayEntries = [...dayEntries].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const addEntry = () => {
    if (!title.trim()) {
      onToast("Podaj nazwę zajęć");
      return;
    }
    if (isRecurring && !startDate) {
      onToast("Podaj datę rozpoczęcia dla zajęć cyklicznych");
      return;
    }
    if (!isRecurring && !manualEntryDate) {
      onToast("Podaj datę zajęć");
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
          entry_date: isRecurring ? null : manualEntryDate,
          start_date: isRecurring ? startDate : null,
          end_date: isRecurring && endDate ? endDate : null,
        };
        const res = await axios.post(`${api}/schedule`, payload, { headers });
        const newEntries = Array.isArray(res.data) ? res.data : [res.data];
        setEntries((prev) => [...prev, ...newEntries]);
        setTitle("");
        setLocation("");
        setLecturer("");
        setStartDate("");
        setEndDate("");
        setManualEntryDate(selectedStr);
        setShowAdd(false);
        onToast(`✅ Dodano ${newEntries.length} ${newEntries.length === 1 ? 'zajęcia' : 'zajęć'} do planu`);
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

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditLocation(entry.location || "");
    setEditLecturer(entry.lecturer || "");
    setEditStartTime(entry.start_time);
    setEditEndTime(entry.end_time);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      onToast("Podaj nazwę zajęć");
      return;
    }
    
    // Check if time changed
    const original = entries.find(e => e.id === editingId);
    const timeChanged = original && (editStartTime !== original.start_time || editEndTime !== original.end_time);
    
    // If time changed, reset completed if new end time is in the future
    let newCompleted = original?.completed || false;
    if (timeChanged) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const [h, m] = editEndTime.split(":").map(Number);
      const endMinutes = h * 60 + m;
      
      // If date is in the future OR today and time hasn't passed yet → not completed
      if (original.entry_date > today || (original.entry_date === today && endMinutes > nowMinutes)) {
        newCompleted = false;
      }
    }
    
    enqueueRequest(async () => {
      try {
        await axios.patch(`${api}/schedule/${editingId}`, {
          title: editTitle,
          location: editLocation,
          lecturer: editLecturer,
          start_time: editStartTime,
          end_time: editEndTime,
          completed: newCompleted
        }, { headers });
        
        // Odśwież listę
        const res = await axios.get(`${api}/schedule`, { headers });
        setEntries(res.data);
        setEditingId(null);
        onToast("✅ Zaktualizowano zajęcia");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd aktualizacji");
      }
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditLocation("");
    setEditLecturer("");
    setEditStartTime("");
    setEditEndTime("");
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
    const unfinished = entries.filter(e => !e.completed);
    if (unfinished.length === 0) {
      onToast("Brak nieukończonych zajęć do usunięcia");
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz usunąć ${unfinished.length} nieukończonych zajęć?`)) {
      return;
    }
    enqueueRequest(async () => {
      try {
        const deletePromises = unfinished.map((entry) => 
          axios.delete(`${api}/schedule/${entry.id}`, { headers })
        );
        await Promise.all(deletePromises);
        setEntries((prev) => prev.filter((e) => e.completed));
        onToast(`🗑️ Usunięto ${unfinished.length} nieukończonych zajęć`);
      } catch (err) {
        console.error("Delete error:", err);
        onToast(err.response?.data?.detail || "Błąd usuwania planu");
      }
    });
  };

  const copySchedule = async (entryId, targetDate) => {
    const original = entries.find(e => e.id === entryId);
    if (!original) return;
    
    enqueueRequest(async () => {
      try {
        await axios.post(`${api}/schedule`, {
          title: original.title,
          location: original.location || "",
          lecturer: original.lecturer || "",
          start_time: original.start_time,
          end_time: original.end_time,
          entry_date: targetDate,
          is_recurring: false,
        }, { headers });
        
        const res = await axios.get(`${api}/schedule`, { headers });
        setEntries(res.data);
        setCopyModal(null);
        onToast("📋 Skopiowano zajęcia");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd kopiowania");
      }
    });
  };

  return (
    <div className="module-panel schedule-panel">
      <SharedCalendar
        items={entries}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        matchItemToDate={(item, dateStr) => item.entry_date === dateStr}
        getItemLabel={(item) => item.title}
        isItemCompleted={(item) => item.completed === true}
        renderItemMeta={(item) => (
          <div className="task-meta">
            <span className="badge category">🕐 {item.start_time}–{item.end_time}</span>
            {item.is_recurring && <span className="badge category">🔁 {WEEKDAYS_LONG[item.day_of_week]}</span>}
            {item.location && <span className="badge category">📍 {item.location}</span>}
            {item.lecturer && <span className="badge category">👤 {item.lecturer}</span>}
            {item.completed && <span className="badge exp">✅ Ukończone</span>}
          </div>
        )}
        onItemDelete={deleteEntry}
        sectionTitle="📚 Plan zajęć"
        emptyLabel="Brak zajęć"
        itemNoun="zajęć"
        collapsedStorageKey="questdo-schedule-calendar-collapsed"
        defaultCollapsed={false}
        freeDays={freeDays}
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

      <div className="day-tasks-panel">
        <div className="tasks-header">
          <h3>Zajęcia — {new Date(`${selectedStr}T12:00:00`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</h3>
          <div className="import-export-buttons">
            <button type="button" className="icon-btn" onClick={handleExport} title="Eksportuj plan">📥</button>
            <button type="button" className="icon-btn" onClick={() => setShowImport(!showImport)} title="Importuj plan">📤</button>
            <button type="button" className="danger-btn danger-btn--inline" onClick={handleDeleteAll} title="Usuń nieukończone zajęcia">🗑️ Usuń nieukończone</button>
          </div>
        </div>
        {sortedDayEntries.length === 0 && <p className="empty">Brak zajęć w tym dniu.</p>}
        {sortedDayEntries.map((entry) => {
          const editing = editingId === entry.id;
          
          return (
            <div key={entry.id} className="task-card medium schedule-card">
              {editing ? (
                <div className="edit-mode">
                  <input 
                    value={editTitle} 
                    onChange={(e) => setEditTitle(e.target.value)} 
                    placeholder="Nazwa zajęć" 
                  />
                  <input 
                    value={editLocation} 
                    onChange={(e) => setEditLocation(e.target.value)} 
                    placeholder="Sala / budynek" 
                  />
                  <input 
                    value={editLecturer} 
                    onChange={(e) => setEditLecturer(e.target.value)} 
                    placeholder="Prowadzący" 
                  />
                  <div className="add-task-meta">
                    <TimePicker value={editStartTime} onChange={setEditStartTime} label="Od:" />
                    <TimePicker value={editEndTime} onChange={setEditEndTime} label="Do:" />
                  </div>
                  <button type="button" className="save-mini" onClick={saveEdit}>✓</button>
                  <button type="button" className="cancel-mini" onClick={cancelEdit}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4 className={entry.completed ? "done" : ""}>{entry.title}</h4>
                    <div className="task-meta">
                      <span className="badge category">🕐 {entry.start_time}–{entry.end_time}</span>
                      {entry.is_recurring && <span className="badge category">🔁 {WEEKDAYS_LONG[entry.day_of_week]}</span>}
                      {entry.location && <span className="badge category">📍 {entry.location}</span>}
                      {entry.lecturer && <span className="badge category">👤 {entry.lecturer}</span>}
                      {entry.completed && <span className="badge exp">✅ Ukończone</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button 
                      type="button" 
                      className="icon-btn" 
                      onClick={() => startEdit(entry)}
                      title="Edytuj"
                    >
                      ✏️
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setCopyModal({ entryId: entry.id, targetDate: toDateStr(new Date()) })} title="Kopiuj">📋</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteEntry(entry)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
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
      {copyModal && (
        <div className="add-task">
          <h3>📋 Kopiuj zajęcia</h3>
          <DatePicker value={copyModal.targetDate} onChange={(date) => setCopyModal({ ...copyModal, targetDate: date })} label="Data docelowa" />
          <div className="row">
            <button type="button" className="add-task-btn" onClick={() => copySchedule(copyModal.entryId, copyModal.targetDate)}>Kopiuj</button>
            <button type="button" className="cancel-btn" onClick={() => setCopyModal(null)}>Anuluj</button>
          </div>
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
            <DatePicker value={manualEntryDate} onChange={setManualEntryDate} label="Data" />
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