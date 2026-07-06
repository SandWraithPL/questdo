// Importy React
import { useState } from "react";

// Godziny dostępne (0-23)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

// Minuty dostępne (co 5 minut)
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// Komponent do wyboru czasu (HH:MM)
export default function TimePicker({ value, onChange, label }) {
  // Wyciągamy godzinę z value lub domyślnie 08
  const [hour, setHour] = useState(() => value?.split(":")[0] || "08");
  // Wyciągamy minuty z value lub domyślnie 00
  const [minute, setMinute] = useState(() => value?.split(":")[1] || "00");

  // Obsługuje zmianę godziny
  const handleHourChange = (newHour) => {
    setHour(newHour);
    // Wysyłamy zmianę (HH:MM)
    onChange(`${newHour}:${minute}`);
  };

  // Obsługuje zmianę minut
  const handleMinuteChange = (newMinute) => {
    setMinute(newMinute);
    // Wysyłamy zmianę (HH:MM)
    onChange(`${hour}:${newMinute}`);
  };

  return (
    <div className="time-picker">
      {label && <span className="time-picker-label">{label}</span>}
      <div className="time-picker-selects">
        <div className="time-picker-group">
          {/* Select do wyboru godziny */}
          <select
            value={hour}
            onChange={(e) => handleHourChange(e.target.value)}
            className="time-picker-select"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="time-picker-separator">:</span>
          {/* Select do wyboru minut */}
          <select
            value={minute}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className="time-picker-select"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
