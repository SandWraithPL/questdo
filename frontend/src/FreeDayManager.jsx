// Importy React i bibliotek
import { useState } from "react";
import axios from "axios";

// Etykiety dla typów dni wolnych
const DAY_TYPE_LABELS = { holiday: "Święto", deans_day: "Dzień dziekański", rector_day: "Dzień rektorski" };

// Konwertuje Date lub string na format YYYY-MM-DD
function toDateStr(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

// Komponent do zarządzania dniami wolnymi (święta, dni wolne, dzień dziekański)
export default function FreeDayManager({ freeDays, setFreeDays, selectedDate, api, headers, onToast, enqueueRequest }) {
  // Czy pokazać formularz dodania dnia wolnego
  const [open, setOpen] = useState(false);
  // Typ dnia wolnego (holiday, deans_day, rector_day)
  const [freeDayType, setFreeDayType] = useState("holiday");
  // Nazwa lub notatka dnia wolnego
  const [freeDayName, setFreeDayName] = useState("");
  // Aktualnie wybrany dzień w formacie string
  const selectedStr = toDateStr(selectedDate);
  // Sprawdzamy czy dla tego dnia już istnieje oznaczenie dnia wolnego
  const existing = freeDays.find((fd) => fd.date === selectedStr);

  // Pomocnik do uruchamiania requesta (z kolejkowaniem jeśli dostępne)
  const run = (fn) => (enqueueRequest ? enqueueRequest(fn) : fn());

  // Obsługuje dodanie nowego dnia wolnego
  const handleCreate = () => run(async () => {
    try {
      // Wysyłamy POST do backendu z datą i typem
      const res = await axios.post(`${api}/free-days`, { date: selectedStr, day_type: freeDayType, notes: freeDayName }, { headers });
      // Dodajemy nowy dzień do listy
      setFreeDays?.((prev) => [...prev, res.data]);
      setFreeDayName("");
      setOpen(false);
      onToast("✅ Oznaczono dzień jako wolny");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd oznaczania dnia");
    }
  });

  // Obsługuje usuwanie dnia wolnego
  const handleDelete = () => {
    if (!existing) return;
    run(async () => {
      try {
        // Wysyłamy DELETE do backendu
        await axios.delete(`${api}/free-days/${existing.id}`, { headers });
        // Usuwamy dzień z listy
        setFreeDays?.((prev) => prev.filter((fd) => fd.id !== existing.id));
        onToast("🗑️ Usunięto oznaczenie dnia wolnego");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd usuwania oznaczenia");
      }
    });
  };

  return (
    <>
      <button type="button" className="icon-btn free-day-btn" onClick={() => setOpen(!open)} title="Zarządzaj dniami wolnymi" aria-label="Zarządzaj dniami wolnymi">🎓</button>
      {open && (
        <div className="add-task free-day-manager">
          <h3>🎓 Zarządzaj dniami wolnymi</h3>
          {existing ? (
            <div>
              <p>Ten dzień jest oznaczony jako: <strong>{DAY_TYPE_LABELS[existing.day_type] || existing.day_type}</strong>{existing.notes && <span> - {existing.notes}</span>}</p>
              <div className="row" style={{ marginTop: 12, gap: "8px" }}>
                <button type="button" className="danger-btn" onClick={handleDelete}>🗑️ Usuń oznaczenie</button>
                <button type="button" className="cancel-btn" onClick={() => setOpen(false)}>Anuluj</button>
              </div>
            </div>
          ) : (
            <>
              <select value={freeDayType} onChange={(e) => setFreeDayType(e.target.value)}>
                <option value="holiday">🎉 Święto</option>
                <option value="deans_day">🎓 Dzień dziekański</option>
                <option value="rector_day">🏛️ Dzień rektorski</option>
              </select>
              <input placeholder="Nazwa święta (opcjonalne)" value={freeDayName} onChange={(e) => setFreeDayName(e.target.value)} />
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="add-task-btn" onClick={handleCreate}>Oznacz dzień</button>
                <button type="button" className="cancel-btn" onClick={() => setOpen(false)}>Anuluj</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
