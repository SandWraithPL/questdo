import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import FamilyPanel from "./FamilyPanel";

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

export default function ShoppingPanel({ api, headers, items, setItems, onUserUpdate, onToast, enqueueRequest, familyId, onFamilyChange }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("other");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editCat, setEditCat] = useState("other");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [editPrice, setEditPrice] = useState("");
  const [summary, setSummary] = useState(null);
  const [showFamilyToggle, setShowFamilyToggle] = useState(false);
  const [selectedMode, setSelectedMode] = useState("individual");
  const [defaultCategory, setDefaultCategory] = useState("other");

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

  const applyUserFromResponse = (data) => {
    if (data?.exp !== undefined) {
      onUserUpdate({
        exp: data.exp,
        level: data.level,
        title: data.title,
        next_level_exp: data.next_level_exp,
        next_level_title: data.next_level_title,
      });
    }
  };

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
      const res = await axios.get(`${api}/shopping`, { headers, params });
      setItems(res.data);
      await loadSummary();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd ładowania listy");
    }
  };

  useEffect(() => {
    loadSummary();
  }, [familyId]);

  useEffect(() => {
    loadShoppingItems();
  }, [familyId]);

  useEffect(() => {
    setSelectedMode(familyId ? "family" : "individual");
  }, [familyId]);

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
      loadShoppingItems();
    }, 10000); // Poll every 10 seconds

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
          category, 
          price: parseFloat(editPrice) || 0,
          family_id: familyId || undefined
        };
        const res = await axios.post(`${api}/shopping`, payload, { headers });
        setItems((prev) => [res.data, ...prev]);
        setName("");
        setQty("");
        setCategory(defaultCategory);
        setEditPrice("");
        setShowSuggestions(false);
        setSuggestions([]);
        await loadSummary();
        onToast("✅ Dodano do listy zakupów");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd dodawania");
      }
    });
  };

  const toggleBought = (item) => {
    enqueueRequest(async () => {
      try {
        const res = await axios.patch(`${api}/shopping/${item.id}`, { bought: !item.bought }, { headers });
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data.item : i)));
        applyUserFromResponse(res.data);
        await loadSummary();
        if (res.data.exp_gained > 0) onToast(`🛒 Kupione! +${res.data.exp_gained} EXP`);
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
        applyUserFromResponse(res.data);
        await loadSummary();
        onToast("🗑️ Usunięto produkt");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd usuwania");
      }
    });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.quantity || "");
    setEditCat(item.category || "other");
    setEditPrice(item.price ? String(item.price) : "");
  };

  const saveEdit = (item) => {
    if (!editName.trim()) return;
    enqueueRequest(async () => {
      try {
        const res = await axios.patch(`${api}/shopping/${item.id}`, {
          name: editName,
          quantity: editQty,
          category: editCat,
          price: parseFloat(editPrice) || 0,
        }, { headers });
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data.item : i)));
        setEditingId(null);
        setEditPrice("");
        await loadSummary();
        onToast("✅ Zapisano");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd zapisu");
      }
    });
  };

  const clearBought = () => {
    enqueueRequest(async () => {
      try {
        await axios.delete(`${api}/shopping/bought/clear`, { headers });
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

  const saveToHistory = async () => {
    const boughtItems = items.filter((i) => i.bought);
    if (boughtItems.length === 0) {
      onToast("Brak kupionych produktów do zapisania");
      return;
    }
    
    try {
      const itemsJson = JSON.stringify(boughtItems);
      await axios.post(`${api}/shopping/history`, {
        items_json: itemsJson,
        total_items: boughtItems.length,
        total_spent: 0,
        notes: ""
      }, { headers });
      onToast("💾 Zapisano listę do historii");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu historii");
    }
  };

  const deleteHistory = async (historyId) => {
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
        const res = await axios.get(`${api}/shopping`, { headers });
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
        total_spent: boughtItems.reduce((sum, i) => sum + (i.price || 0), 0),
        notes: "",
        is_template: false
      };
      const params = familyId ? { family_id: familyId } : {};
      await axios.post(`${api}/shopping/history`, payload, { headers, params });
      await axios.delete(`${api}/shopping/bought/clear`, { headers });
      setItems((prev) => prev.filter((i) => !i.bought));
      await loadSummary();
      onToast("💾 Lista zapisana w historii");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu historii");
    }
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
              onFamilyChange?.(null);
              setShowFamilyToggle(false);
            }}
          >
            👤 Indywidualna
          </button>
          <button 
            type="button" 
            className={`family-toggle-btn ${selectedMode === "family" ? "active" : ""}`}
            onClick={() => {
              setSelectedMode("family");
              setShowFamilyToggle(true);
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
          onFamilyChange={(fid) => {
            onFamilyChange?.(fid);
            setShowFamilyToggle(false);
          }}
        />
      )}

      {summary && (
        <div className="earnings-summary">
          <div className="earnings-stat">
            <span className="earnings-stat-label">Lista</span>
            <strong>{summary.current_list.toFixed(2)} zł</strong>
          </div>
          <div className="earnings-stat">
            <span className="earnings-stat-label">Dzień</span>
            <strong>{Object.values(summary.by_day).slice(-1)[0]?.toFixed(2) || "0.00"} zł</strong>
          </div>
          <div className="earnings-stat">
            <span className="earnings-stat-label">Tydzień</span>
            <strong>{Object.values(summary.by_week).slice(-1)[0]?.toFixed(2) || "0.00"} zł</strong>
          </div>
          <div className="earnings-stat">
            <span className="earnings-stat-label">Miesiąc</span>
            <strong>{Object.values(summary.by_month).slice(-1)[0]?.toFixed(2) || "0.00"} zł</strong>
          </div>
          <div className="earnings-stat muted">
            <span className="earnings-stat-label">Łącznie</span>
            <strong>{summary.all_time.toFixed(2)} zł</strong>
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
                    <span className="suggestion-price">{s.default_price > 0 ? `${s.default_price.toFixed(2)} zł` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input className="input-small" placeholder="Ilość" value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className="input-small" placeholder="Cena (zł)" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" step="0.01" min="0" />
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
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nazwa" />
                  <input className="input-small" value={editQty} onChange={(e) => setEditQty(e.target.value)} placeholder="Ilość" />
                  <input className="input-small" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Cena (zł)" type="number" step="0.01" min="0" />
                  <select value={editCat} onChange={(e) => setEditCat(e.target.value)}>
                    {SHOPPING_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <button type="button" className="save-mini" onClick={() => saveEdit(item)}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => { setEditingId(null); setEditPrice(""); }}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4 className={item.bought ? "done" : ""}>{item.name}</h4>
                    <div className="task-meta">
                      {item.quantity && <span className="badge category">{item.quantity}</span>}
                      <span className="badge category">{cat.emoji} {cat.label}</span>
                      {item.price > 0 && <span className="badge category">💰 {item.price.toFixed(2)} zł</span>}
                      {item.bought && <span className="badge exp">+2 EXP</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button type="button" className="icon-btn" onClick={() => startEdit(item)} title="Edytuj">✏️</button>
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
              {history.map((h) => (
                <div key={h.id} className="history-card">
                  <div className="history-info">
                    <span className="history-date">{new Date(h.completed_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="history-count">{h.total_items} produktów</span>
                  </div>
                  <div className="history-actions">
                    <button type="button" className="icon-btn" onClick={() => loadFromHistory(h.id)} title="Wczytaj listę">�</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteHistory(h.id)} title="Usuń">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedHistory && historyDetail && (
        <div className="history-detail-panel">
          <div className="history-header">
            <h3>📋 Szczegóły listy z {new Date(historyDetail.completed_at).toLocaleDateString("pl-PL")}</h3>
            <button type="button" className="icon-btn" onClick={() => { setSelectedHistory(null); setHistoryDetail(null); }}>✕</button>
          </div>
          <div className="history-items">
            {JSON.parse(historyDetail.items_json).map((item, idx) => {
              const cat = getCategory(item.category);
              return (
                <div key={idx} className="task-card shopping-card done">
                  <div className="task-info">
                    <h4 className="done">{item.name}</h4>
                    <div className="task-meta">
                      {item.quantity && <span className="badge category">{item.quantity}</span>}
                      <span className="badge category">{cat.emoji} {cat.label}</span>
                      {item.price > 0 && <span className="badge category">💰 {item.price.toFixed(2)} zł</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="history-footer">
            <p>{historyDetail.can_edit ? "Możesz edytować tę listę (mniej niż 24h)" : "Tylko podgląd (minęło więcej niż 24h)"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export { SHOPPING_CATEGORIES };
