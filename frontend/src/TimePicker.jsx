import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export default function TimePicker({ value, onChange, label }) {
  const [hour, setHour] = useState(() => value?.split(":")[0] || "08");
  const [minute, setMinute] = useState(() => value?.split(":")[1] || "00");

  const handleHourChange = (newHour) => {
    setHour(newHour);
    onChange(`${newHour}:${minute}`);
  };

  const handleMinuteChange = (newMinute) => {
    setMinute(newMinute);
    onChange(`${hour}:${newMinute}`);
  };

  return (
    <div className="time-picker">
      {label && <span className="time-picker-label">{label}</span>}
      <div className="time-picker-selects">
        <div className="time-picker-group">
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
