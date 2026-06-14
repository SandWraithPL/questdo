const TABS = [
  { id: "tasks", label: "Questy", icon: "⚔️" },
  { id: "schedule", label: "Plan", icon: "📚" },
  { id: "shopping", label: "Zakupy", icon: "🛒" },
  { id: "earnings", label: "Zarobki", icon: "💰" },
];

const TAB_STORAGE_KEY = "questdo-main-tab";

export function readMainTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (TABS.some((t) => t.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "tasks";
}

export default function AppTabs({ activeTab, onTabChange }) {
  return (
    <nav className="app-tabs" aria-label="Sekcje aplikacji">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`app-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => {
            onTabChange(tab.id);
            try {
              localStorage.setItem(TAB_STORAGE_KEY, tab.id);
            } catch {
              /* ignore */
            }
          }}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          <span className="app-tab-icon" aria-hidden="true">{tab.icon}</span>
          <span className="app-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export { TABS };
