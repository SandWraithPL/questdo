// Lista wszystkich dostępnych zakładek w aplikacji
const TABS = [
  { id: "tasks", label: "Questy", icon: "⚔️" },
  { id: "recurring", label: "Cykliczne", icon: "🔄" },
  { id: "schedule", label: "Plan", icon: "📚" },
  { id: "shopping", label: "Zakupy", icon: "🛒" },
  { id: "earnings", label: "Zarobki", icon: "💰" },
  { id: "settings", label: "Ustawienia", icon: "⚙️" },
];

// Klucz do przechowywania aktywnej zakładki w localStorage
const TAB_STORAGE_KEY = "questdo-main-tab";

// Odczytuje ostatnią aktywną zakładkę z localStorage
export function readMainTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    // Sprawdzamy czy zapisana zakładka istnieje
    if (TABS.some((t) => t.id === saved)) return saved;
  } catch {}
  // Domyślna zakładka - Questy
  return "tasks";
}

// Komponent paska nawigacji (zakładki) - pokazuje dostępne sekcje
export default function AppTabs({ activeTab, onTabChange }) {
  return (
    <nav className="app-tabs" aria-label="Sekcje aplikacji">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          // Dodajemy active class do aktualnej zakładki
          className={`app-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => {
            // Zmieniamy aktywną zakładkę
            onTabChange(tab.id);
            // Zapisujemy wybór w localStorage
            try {
              localStorage.setItem(TAB_STORAGE_KEY, tab.id);
            } catch {}
          }}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {/* Ikona zakładki */}
          <span className="app-tab-icon" aria-hidden="true">{tab.icon}</span>
          {/* Etykieta zakładki */}
          <span className="app-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

// Eksportujemy listę zakładek
export { TABS };
