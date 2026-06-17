import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import FamilyPanel from "./FamilyPanel";
import { applyUserFromResponse } from "./helpers";
import { useEditItem } from "./hooks/useEditItem";

const SHOPPING_MODE_KEY = "questdo-shopping-mode";
const SHOW_FAMILY_TOGGLE_KEY = "questdo-show-family-toggle";

function readShoppingMode() {
  try {
    const saved = localStorage.getItem(SHOPPING_MODE_KEY);
    if (saved === "individual" || saved === "family") return saved;
  } catch { /* ignore */ }
  return "individual";
}

function writeShoppingMode(mode) {
  try {
    localStorage.setItem(SHOPPING_MODE_KEY, mode);
  } catch { /* ignore */ }
}

function readShowFamilyToggle() {
  try {
    return localStorage.getItem(SHOW_FAMILY_TOGGLE_KEY) === "true";
  } catch { return false; }
}

function writeShowFamilyToggle(value) {
  try {
    localStorage.setItem(SHOW_FAMILY_TOGGLE_KEY, String(value));
  } catch { /* ignore */ }
}

// Funkcja formatująca pieniądze z przecinkiem i 2 miejscami po przecinku
function formatMoney(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł`;
}

const SHOPPING_CATEGORIES = [
  { value: "veggies", emoji: "🥦", label: "Warzywa" },
  { value: "fruits", emoji: "🍎", label: "Owoce" },
  { value: "dairy", emoji: "🥛", label: "Nabiał" },
  { value: "bread", emoji: "🍞", label: "Pieczywo" },
  { value: "meat", emoji: "🥩", label: "Mięso" },
  { value: "drinks", emoji: "🧃", label: "Napoje" },
  { value: "chemicals", emoji: "🧴", label: "Chemia" },
  { value: "sweets", emoji: "🍫", label: "Słodycze" },
  { value: "other", emoji: "📦", label: "Inne" },
];

function getCategory(cat) {
  return SHOPPING_CATEGORIES.find((c) => c.value === cat) || SHOPPING_CATEGORIES[8];
}

// Funkcja formatująca datę z uwzględnieniem lokalnej strefy czasowej
function formatLocalDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ShoppingPanel({ 
  api, 
  headers, 
  items, 
  setItems, 
  onUserUpdate, 
  onToast, 
  enqueueRequest, 
  familyId, 
  onFamilyChange,
  currentUserId
}) {
  console.log("[SHOPPING] familyId prop received:", familyId);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("szt");
  const [category, setCategory] = useState("other");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [editPrice, setEditPrice] = useState("");
  const [summary, setSummary] = useState(null);
  const [showFamilyToggle, setShowFamilyToggle] = useState(readShowFamilyToggle);
  const [selectedMode, setSelectedMode] = useState(readShoppingMode);
  const [defaultCategory, setDefaultCategory] = useState("other");

  const saveItem = async (id, form) => {
    if (!form.name?.trim()) return;
    enqueueRequest(async () => {
      try {
        const res = await axios.patch(`${api}/shopping/${id}`, {
          name: form.name,
          quantity: form.qty,
          unit: form.unit,
          category: form.cat,
          price: parseFloat(form.price) || 0,
        }, { headers });
        setItems((prev) => prev.map((i) => (i.id === id ? res.data.item : i)));
        await loadSummary();
        onToast("✅ Zapisano");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd zapisu");
      }
    });
  };

  const { editingId, editForm, setEditForm, startEdit, cancelEdit, saveEdit } = useEditItem(saveItem);

  const boughtCount = items.filter((i) => i.bought).length;
  const leftCount = items.length - boughtCount;
  const percent = items.length ? Math.round((boughtCount / items.length) * 100) : 0;

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "bought") list = list.filter((i) => i.bought);
    if (filter === "unbought") list = list.filter((i) => !i.bought);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(s) || getCategory(i.category).label.toLowerCase().includes(s));
    }
    return list;
  }, [items, filter, search]);

  const loadSummary = async () => {
    try {
      const params = familyId ? { family_id: familyId } : {};
      const res = await axios.get(`${api}/shopping/summary`, { headers, params });
      setSummary(res.data);
    } catch {
      /* ignore */
    }
  };

  const loadShoppingItems = async () => {
    try {
      const params = familyId ? { family_id: familyId } : {};
      console.log("[SHOPPING] Loading items with familyId:", familyId, "params:", params);
      const res = await axios.get(`${api}/shopping`, { headers, params });
      setItems(res.data);
      await loadSummary();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd ładowania listy");
    }
  };

  // Initial load when component mounts
  useEffect(() => {
    if (selectedMode === "family" && familyId) {
      loadShoppingItems();
    } else if (selectedMode === "individual") {
      loadShoppingItems();
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [familyId]);

  useEffect(() => {
    // Load shopping items when familyId or selectedMode changes
    if (selectedMode === "family" && familyId) {
      loadShoppingItems();
    } else if (selectedMode === "individual") {
      loadShoppingItems();
    }
  }, [familyId, selectedMode]);

  useEffect(() => {
    writeShoppingMode(selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    if (selectedMode === "family") {
      setShowFamilyToggle(true);
    }
  }, []);

  useEffect(() => {
    loadDefaultCategory();
  }, []);

  const loadDefaultCategory = async () => {
    try {
      const res = await axios.get(`${api}/settings/default-category`, { headers });
      setDefaultCategory(res.data.category || "other");
      setCategory(res.data.category || "other");
    } catch {
      /* ignore */
    }
  };

  // Poll for real-time synchronization when family mode is active
  useEffect(() => {
    if (!familyId) return;
    
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadShoppingItems();
        loadSummary();
      }
    }, 30000); // Changed from 10000ms to 30000ms for better performance

    return () => clearInterval(interval);
  }, [familyId]);

  const addItem = () => {
    if (!name.trim()) {
      onToast("Podaj nazwę produktu");
      return;
    }
    enqueueRequest(async () => {
      try {
        const payload = { 
          name, 
          quantity: qty, 
          unit,
          category, 
          price: parseFloat(editPrice) || 0,
          family_id: familyId || undefined
        };
        console.log("[SHOPPING] Adding item with payload:", payload);
        const res = await axios.post(`${api}/shopping`, payload, { headers });
        console.log("[SHOPPING] Response:", res.data);
        setItems((prev) => [res.data, ...prev]);
        setName("");
        setQty("");
        setUnit("szt");
        setCategory(defaultCategory);
        setEditPrice("");
        setShowSuggestions(false);
        setSuggestions([]);
        await loadSummary();
        onToast("✅ Dodano do listy zakupów");
      } catch (err) {
        console.error("[SHOPPING] Error:", err.response?.data);
        onToast(err.response?.data?.detail || "Błąd dodawania");
      }
    });
  };

  const toggleBought = (item) => {
    enqueueRequest(async () => {
      try {
        const res = await axios.patch(`${api}/shopping/${item.id}`, { bought: !item.bought }, { headers });
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data.item : i)));
        applyUserFromResponse(res.data, onUserUpdate);
        await loadSummary();
        onToast("🛒 Kupione!");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd aktualizacji");
      }
    });
  };

  const deleteItem = (item) => {
    enqueueRequest(async () => {
      try {
        const res = await axios.delete(`${api}/shopping/${item.id}`, { headers });
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        applyUserFromResponse(res.data, onUserUpdate);
        await loadSummary();
        onToast("🗑️ Usunięto produkt");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd usuwania");
      }
    });
  };

  const startEditItem = (item) => {
    startEdit(item, {
      name: item.name,
      qty: item.quantity || "",
      unit: item.unit || "szt",
      cat: item.category || "other",
      price: item.price ? String(item.price) : "",
    });
  };

  const clearBought = () => {
    enqueueRequest(async () => {
      try {
        const params = familyId ? { family_id: familyId } : {};
        await axios.delete(`${api}/shopping/bought/clear`, { headers, params });
        setItems((prev) => prev.filter((i) => !i.bought));
        await loadSummary();
        onToast("🗑️ Usunięto kupione produkty");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd czyszczenia");
      }
    });
  };

  const loadHistory = async () => {
    try {
      const params = familyId ? { family_id: familyId } : {};
      const res = await axios.get(`${api}/shopping/history`, { headers, params });
      setHistory(res.data);
      setShowHistory(true);
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd ładowania historii");
    }
  };

  const viewHistoryDetail = async (historyId) => {
    try {
      const res = await axios.get(`${api}/shopping/history/${historyId}`, { headers });
      setHistoryDetail(res.data);
      setSelectedHistory(historyId);
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd ładowania szczegółów");
    }
  };

  const deleteHistory = async (historyId, canEdit) => {
    if (!canEdit) {
      onToast("Nie można usunąć tej listy (minęło więcej niż 24h)");
      return;
    }
    try {
      await axios.delete(`${api}/shopping/history/${historyId}`, { headers });
      setHistory((prev) => prev.filter((h) => h.id !== historyId));
      if (selectedHistory === historyId) {
        setSelectedHistory(null);
        setHistoryDetail(null);
      }
      onToast("🗑️ Usunięto z historii");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd usuwania");
    }
  };

  const loadFromHistory = async (historyId) => {
    try {
      const res = await axios.post(`${api}/shopping/history/${historyId}/load`, {}, { headers });
      setItems((prev) => [...res.data.items, ...prev]);
      if (res.data.deleted_history) {
        setHistory((prev) => prev.filter((h) => h.id !== historyId));
        onToast("📋 Wczytano listę z historii (edycja możliwa)");
      } else {
        onToast("📋 Wczytano listę jako szablon");
      }
      setShowHistory(false);
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd wczytywania");
    }
  };

  const searchDefaultArticles = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await axios.get(`${api}/default-articles/search?q=${encodeURIComponent(query)}`, { headers });
      setSuggestions(res.data);
      setShowSuggestions(res.data.length > 0);
    } catch (err) {
      console.error("Błąd wyszukiwania:", err);
    }
  };

  const selectSuggestion = (suggestion) => {
    setName(suggestion.name);
    setQty(suggestion.quantity || "");
    setCategory(suggestion.category || "other");
    setEditPrice(suggestion.default_price ? String(suggestion.default_price) : "");
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const selectAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, bought: true })));
    enqueueRequest(async () => {
      try {
        for (const item of items) {
          if (!item.bought) {
            await axios.patch(`${api}/shopping/${item.id}`, { bought: true }, { headers });
          }
        }
        const params = familyId ? { family_id: familyId } : {};
        const res = await axios.get(`${api}/shopping`, { headers, params });
        setItems(res.data);
        onToast("✅ Zaznaczono wszystkie produkty");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd zaznaczania");
      }
    });
  };

  const completeShoppingList = async () => {
    const boughtItems = items.filter((i) => i.bought);
    if (boughtItems.length === 0) {
      onToast("Brak kupionych produktów do zapisania");
      return;
    }
    try {
      const itemsJson = JSON.stringify(boughtItems);
      const payload = {
        items_json: itemsJson,
        total_items: boughtItems.length,
        total_spent: boughtItems.reduce((sum, i) => sum + ((parseFloat(i.quantity) || 0) * (i.price || 0)), 0),
        notes: "",
        is_template: false
      };
      const params = familyId ? { family_id: familyId } : {};
      await axios.post(`${api}/shopping/history`, payload, { headers, params });
      await axios.delete(`${api}/shopping/bought/clear`, { headers, params });
      setItems((prev) => prev.filter((i) => !i.bought));
      await loadSummary();
      onToast("💾 Lista zapisana w historii");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu historii");
    }
  };

  // Gdy użytkownik wybiera rodzinę z FamilyPanel, ustawiamy tryb na "family"
  const handleFamilySelected = (fid) => {
    console.log("[SHOPPING] Family selected, fid:", fid);
    console.log("[SHOPPING] Current familyId before:", familyId);
    onFamilyChange?.(fid);
    setShowFamilyToggle(true);
    writeShowFamilyToggle(true);
    setSelectedMode("family");
    writeShoppingMode("family");
    console.log("[SHOPPING] Called onFamilyChange with:", fid);
  };

  return (
    <div className="module-panel shopping-panel">
      <div className="shopping-header">
        <h3>🛒 Lista zakupów</h3>
        <div className="family-toggle">
          <button 
            type="button" 
            className={`family-toggle-btn ${selectedMode === "individual" ? "active" : ""}`}
            onClick={() => {
              setSelectedMode("individual");
              writeShoppingMode("individual");
              onFamilyChange?.(null);
              setShowFamilyToggle(false);
              writeShowFamilyToggle(false);
            }}
          >
            👤 Indywidualna
          </button>
          <button 
            type="button" 
            className={`family-toggle-btn ${selectedMode === "family" ? "active" : ""}`}
            onClick={() => {
              setSelectedMode("family");
              writeShoppingMode("family");
              setShowFamilyToggle(true);
              writeShowFamilyToggle(true);
            }}
          >
            👨‍👩‍👧‍👦 Rodzinna
          </button>
        </div>
      </div>

      {showFamilyToggle && (
        <FamilyPanel 
          api={api} 
          headers={headers} 
          onToast={onToast} 
          onFamilyChange={handleFamilySelected}
          initialMode={selectedMode}
          currentUserId={currentUserId}
        />
      )}

      {summary && (
        <div className="earnings-summary">
          <div className="earnings-stat">
            <span className="earnings-stat-label">Lista</span>
            <strong>{formatMoney(summary.current_list)}</strong>
          </div>
          <div className="earnings-stat">
            <span className="earnings-stat-label">Dzień</span>
            <strong>{formatMoney(Object.values(summary.by_day).slice(-1)[0] || 0)}</strong>
          </div>
          <div className="earnings-stat">
            <span className="earnings-stat-label">Tydzień</span>
            <strong>{formatMoney(Object.values(summary.by_week).slice(-1)[0] || 0)}</strong>
          </div>
          <div className="earnings-stat">
            <span className="earnings-stat-label">Miesiąc</span>
            <strong>{formatMoney(Object.values(summary.by_month).slice(-1)[0] || 0)}</strong>
          </div>
          <div className="earnings-stat muted">
            <span className="earnings-stat-label">Łącznie</span>
            <strong>{formatMoney(summary.all_time)}</strong>
          </div>
        </div>
      )}
      <div className="add-task">
        <h3>🛒 Dodaj produkt</h3>
        <div className="form-row-inline">
          <div style={{ position: "relative", flex: 1 }}>
            <input 
              placeholder="Nazwa (wymagane)" 
              value={name} 
              onChange={(e) => {
                setName(e.target.value);
                searchDefaultArticles(e.target.value);
              }} 
              onKeyDown={(e) => e.key === "Enter" && addItem()} 
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s) => (
                  <div key={s.id} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                    <span>{s.name}</span>
                    <span className="suggestion-price">{s.default_price > 0 ? formatMoney(s.default_price) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input className="input-small" placeholder="Ilość" value={qty} onChange={(e) => setQty(e.target.value)} />
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="szt">szt.</option>
            <option value="kg">kg</option>
            <option value="l">l</option>
          </select>
          <input className="input-small" placeholder="Cena jedn. (zł)" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" step="0.01" min="0" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="add-task-btn" onClick={addItem}>+ Dodaj do listy</button>
      </div>

      <input className="search-input" placeholder="🔍 Szukaj produktu..." value={search} onChange={(e) => setSearch(e.target.value)} />
      
      <div className="import-export-row">
        <button type="button" className="icon-btn history-btn" onClick={selectAll} title="Zaznacz wszystkie">✅ Zaznacz wszystkie</button>
        <button type="button" className="icon-btn history-btn" onClick={loadHistory} title="Historia list">📜 Historia</button>
        <button type="button" className="icon-btn save-history-btn" onClick={completeShoppingList} title="Zakończ i zapisz do historii">💾 Zakończ listę</button>
      </div>

      <div className="stats-bar">
        <div className="filter-group">
          {[
            { id: "all", label: "Wszystkie" },
            { id: "unbought", label: "Niekupione" },
            { id: "bought", label: "Kupione" },
          ].map((f) => (
            <button key={f.id} type="button" className={`filter-btn ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="stats-counter">
          <span>Wszystkich: <strong>{items.length}</strong></span>
          <span>Kupionych: <strong>{boughtCount}</strong></span>
          <span>Pozostało: <strong>{leftCount}</strong></span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="progress-wrap">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
          <span>{percent}% ukończone</span>
        </div>
      )}

      <div className="product-list">
        {filtered.length === 0 && (
          <p className="empty">{items.length ? "Brak produktów pasujących do filtrów." : "Lista jest pusta. Dodaj pierwszy produkt! 🛒"}</p>
        )}
        {filtered.map((item) => {
          const cat = getCategory(item.category);
          const editing = editingId === item.id;
          return (
            <div key={item.id} className={`task-card shopping-card ${item.bought ? "done" : "easy"}`}>
              <button type="button" className={`task-check ${item.bought ? "checked" : ""}`} onClick={() => toggleBought(item)}>
                {item.bought ? "✓" : ""}
              </button>
              {editing ? (
                <div className="edit-mode">
                  <input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nazwa" />
                  <input className="input-small" value={editForm.qty || ""} onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })} placeholder="Ilość" />
                  <select value={editForm.unit || "szt"} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                    <option value="szt">szt.</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                  </select>
                  <input className="input-small" value={editForm.price || ""} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="Cena jedn. (zł)" type="number" step="0.01" min="0" />
                  <select value={editForm.cat || "other"} onChange={(e) => setEditForm({ ...editForm, cat: e.target.value })}>
                    {SHOPPING_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <button type="button" className="save-mini" onClick={() => saveEdit(item)}>✓</button>
                  <button type="button" className="cancel-mini" onClick={cancelEdit}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4 className={item.bought ? "done" : ""}>{item.name}</h4>
                    <div className="task-meta">
                      {item.quantity && <span className="badge category">{item.quantity} {item.unit || "szt"}</span>}
                      <span className="badge category">{cat.emoji} {cat.label}</span>
                      {item.price > 0 && (
                        <span className="badge category">
                          💰 {item.quantity ? `${item.quantity} ${item.unit || "szt"} × ${formatMoney(item.price)} = ${formatMoney((parseFloat(item.quantity) || 0) * item.price)}` : formatMoney(item.price)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button type="button" className="icon-btn" onClick={() => startEditItem(item)} title="Edytuj">✏️</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteItem(item)} title="Usuń">🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {boughtCount > 0 && (
        <button type="button" className="danger-btn" onClick={clearBought}>🗑️ Usuń kupione ({boughtCount})</button>
      )}

      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <h3>📜 Historia list zakupów</h3>
            <button type="button" className="icon-btn" onClick={() => setShowHistory(false)}>✕</button>
          </div>
          {history.length === 0 ? (
            <p className="empty">Brak zapisanych list w historii.</p>
          ) : (
            <div className="history-list">
              {history.map((h) => {
                // Oblicz czy można edytować/usunąć (mniej niż 24h)
                const completedAt = new Date(h.completed_at);
                const now = new Date();
                const hoursSinceCompletion = (now - completedAt) / (1000 * 60 * 60);
                const canEdit = hoursSinceCompletion < 24;
                
                return (
                  <div key={h.id} className="history-card" style={{ cursor: "pointer" }} onClick={() => viewHistoryDetail(h.id)}>
                    <div className="history-info">
                      <span className="history-date">{formatLocalDateTime(h.completed_at)}</span>
                      <span className="history-count">{h.total_items} produktów</span>
                      <span className="history-total" style={{ color: "#ff8906", fontSize: "0.85rem" }}>
                        💰 {formatMoney(h.total_spent)}
                      </span>
                      {!canEdit && (
                        <span className="badge locked-badge" style={{ marginTop: "4px" }}>🔒 Zablokowane (24h)</span>
                      )}
                    </div>
                    <div className="history-actions" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button" 
                        className="icon-btn" 
                        onClick={() => loadFromHistory(h.id)} 
                        title="Wczytaj listę"
                      >
                        📋
                      </button>
                      <button 
                        type="button" 
                        className="icon-btn delete" 
                        onClick={() => deleteHistory(h.id, canEdit)} 
                        title={canEdit ? "Usuń" : "Nie można usunąć (minęło 24h)"}
                        disabled={!canEdit}
                        style={{ opacity: canEdit ? 1 : 0.5 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedHistory && historyDetail && (
        <div className="history-detail-panel">
          <div className="history-header">
            <h3>📋 Szczegóły listy z {formatLocalDateTime(historyDetail.completed_at)}</h3>
            <button type="button" className="icon-btn" onClick={() => { setSelectedHistory(null); setHistoryDetail(null); }}>✕</button>
          </div>
          <div className="history-items">
            <div className="history-summary" style={{ marginBottom: "12px", padding: "8px", background: "#2a2a3e", borderRadius: "8px" }}>
              <span>📦 {historyDetail.total_items} produktów</span>
              <span style={{ marginLeft: "16px", color: "#ff8906" }}>💰 {formatMoney(historyDetail.total_spent)}</span>
              {!historyDetail.can_edit && (
                <span className="badge locked-badge" style={{ marginLeft: "16px" }}>🔒 Tylko podgląd (minęło 24h)</span>
              )}
            </div>
            {JSON.parse(historyDetail.items_json).map((item, idx) => {
              const cat = getCategory(item.category);
              return (
                <div key={idx} className="task-card shopping-card done">
                  <div className="task-info">
                    <h4 className="done">{item.name}</h4>
                    <div className="task-meta">
                      {item.quantity && <span className="badge category">{item.quantity} {item.unit || "szt"}</span>}
                      <span className="badge category">{cat.emoji} {cat.label}</span>
                      {item.price > 0 && (
                        <span className="badge category">
                          💰 {item.quantity ? `${item.quantity} ${item.unit || "szt"} × ${formatMoney(item.price)} = ${formatMoney((parseFloat(item.quantity) || 0) * item.price)}` : formatMoney(item.price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="history-footer">
            <p>{historyDetail.can_edit ? "✅ Możesz edytować tę listę (mniej niż 24h)" : "🔒 Tylko podgląd (minęło więcej niż 24h)"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export { SHOPPING_CATEGORIES };