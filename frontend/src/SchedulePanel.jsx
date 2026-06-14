import { useMemo, useState } from "react";
import axios from "axios";
import SharedCalendar, { weekdayIndex, WEEKDAYS_LONG } from "./SharedCalendar";

function matchScheduleToDate(entry, dateStr) {
  if (entry.is_recurring) {
    return entry.day_of_week === weekdayIndex(dateStr);
  }
  return entry.entry_date === dateStr;
}

export default function SchedulePanel({ api, headers, entries, setEntries, selectedDate, onDateSelect, onToast, enqueueRequest }) {
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

  const dayEntries = useMemo(
    () => entries.filter((e) => matchScheduleToDate(e, selectedDate instanceof Date ? selectedDate.toISOString().slice(0, 10) : String(selectedDate).slice(0, 10))),
    [entries, selectedDate],
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

  const selectedStr = selectedDate instanceof Date
    ? selectedDate.toISOString().slice(0, 10)
    : String(selectedDate).slice(0, 10);

  return (
    <div className="module-panel schedule-panel">
      <SharedCalendar
        items={entries}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        matchItemToDate={matchScheduleToDate}
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
      />

      <div className="day-tasks-panel">
        <div className="tasks-header">
          <h3>Zajęcia — {new Date(`${selectedStr}T12:00:00`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</h3>
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

      {!showAdd ? (
        <button type="button" className="add-task-btn" onClick={() => setShowAdd(true)}>+ Dodaj zajęcia</button>
      ) : (
        <div className="add-task">
          <h3>+ Nowe zajęcia</h3>
          <input placeholder="Nazwa przedmiotu / zajęć" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Sala / budynek (opcjonalnie)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <input placeholder="Prowadzący (opcjonalnie)" value={lecturer} onChange={(e) => setLecturer(e.target.value)} />
          <div className="add-task-meta">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          )}
          <div className="row">
            <button type="button" onClick={addEntry}>Dodaj do planu</button>
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}
