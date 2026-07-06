import { useState } from "react";
import axios from "axios";

const DAY_TYPE_LABELS = { holiday: "Święto", deans_day: "Dzień dziekański", rector_day: "Dzień rektorski" };

function toDateStr(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export default function FreeDayManager({ freeDays, setFreeDays, selectedDate, api, headers, onToast, enqueueRequest }) {
  const [open, setOpen] = useState(false);
  const [freeDayType, setFreeDayType] = useState("holiday");
  const [freeDayName, setFreeDayName] = useState("");
  const selectedStr = toDateStr(selectedDate);
  const existing = freeDays.find((fd) => fd.date === selectedStr);

  const run = (fn) => (enqueueRequest ? enqueueRequest(fn) : fn());

  const handleCreate = () => run(async () => {
    try {
      const res = await axios.post(`${api}/free-days`, { date: selectedStr, day_type: freeDayType, notes: freeDayName }, { headers });
      setFreeDays?.((prev) => [...prev, res.data]);
      setFreeDayName("");
      setOpen(false);
      onToast("✅ Oznaczono dzień jako wolny");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd oznaczania dnia");
    }
  });

  const handleDelete = () => {
    if (!existing) return;
    run(async () => {
      try {
        await axios.delete(`${api}/free-days/${existing.id}`, { headers });
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
