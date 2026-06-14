import { useMemo, useState } from "react";
import axios from "axios";

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

export default function ShoppingPanel({ api, headers, items, setItems, onUserUpdate, onToast, enqueueRequest }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("other");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editCat, setEditCat] = useState("other");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [showReceiptImport, setShowReceiptImport] = useState(false);
  const [receiptText, setReceiptText] = useState("");

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

  const addItem = () => {
    if (!name.trim()) {
      onToast("Podaj nazwę produktu");
      return;
    }
    enqueueRequest(async () => {
      try {
        const res = await axios.post(`${api}/shopping`, { name, quantity: qty, category }, { headers });
        setItems((prev) => [res.data, ...prev]);
        setName("");
        setQty("");
        setCategory("other");
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
  };

  const saveEdit = (item) => {
    if (!editName.trim()) return;
    enqueueRequest(async () => {
      try {
        const res = await axios.patch(`${api}/shopping/${item.id}`, {
          name: editName,
          quantity: editQty,
          category: editCat,
        }, { headers });
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data.item : i)));
        setEditingId(null);
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
        onToast("🗑️ Usunięto kupione produkty");
      } catch (err) {
        onToast(err.response?.data?.detail || "Błąd czyszczenia");
      }
    });
  };

  const handleExport = async () => {
    try {
      const res = await axios.post(`${api}/shopping/export`, {}, { headers });
      const blob = new Blob([res.data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      onToast("📥 Wyeksportowano listę zakupów");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd eksportu");
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      onToast("Wklej zawartość pliku");
      return;
    }
    
    const items = [];
    const lines = importText.split("\n");
    let currentItem = null;
    
    for (const line of lines) {
      if (line === "[ITEM]") {
        currentItem = {};
      } else if (currentItem && line.includes(":")) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();
        currentItem[key] = value;
      } else if (line === "" && currentItem) {
        items.push(currentItem);
        currentItem = null;
      }
    }
    
    if (currentItem) items.push(currentItem);
    
    try {
      const res = await axios.post(`${api}/shopping/import`, { items }, { headers });
      setItems((prev) => [...prev, ...Array(res.data.imported).fill({})]); // Reload needed
      setShowImport(false);
      setImportText("");
      onToast(`📤 Zaimportowano ${res.data.imported} produktów`);
      if (res.data.errors.length > 0) {
        onToast(`Błędy: ${res.data.errors.slice(0, 3).join(", ")}`);
      }
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd importu");
    }
  };

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${api}/shopping/history`, { headers });
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

  const parseReceiptText = (text) => {
    const lines = text.split("\n");
    const products = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Parsowanie formatu: "Nazwa produktu cena" lub "Nazwa produktu x ilość cena"
      const priceMatch = trimmed.match(/(\d+[.,]\d+)\s*zł?$/i);
      if (priceMatch) {
        const price = priceMatch[1].replace(",", ".");
        const namePart = trimmed.substring(0, trimmed.lastIndexOf(priceMatch[1])).trim();
        
        // Sprawdź czy jest ilość (format: "Nazwa x2 cena")
        const qtyMatch = namePart.match(/x(\d+)\s*$/i);
        let name = namePart;
        let quantity = "";
        
        if (qtyMatch) {
          quantity = qtyMatch[1];
          name = namePart.substring(0, namePart.lastIndexOf(qtyMatch[0])).trim();
        }
        
        if (name) {
          products.push({ name, quantity, category: "other" });
        }
      }
    }
    
    return products;
  };

  const importFromReceipt = async () => {
    if (!receiptText.trim()) {
      onToast("Wklej tekst z paragonu");
      return;
    }
    
    const products = parseReceiptText(receiptText);
    
    if (products.length === 0) {
      onToast("Nie znaleziono produktów w tekście. Sprawdź format.");
      return;
    }
    
    let imported = 0;
    for (const product of products) {
      try {
        const res = await axios.post(`${api}/shopping`, {
          name: product.name,
          quantity: product.quantity,
          category: product.category
        }, { headers });
        setItems((prev) => [res.data, ...prev]);
        imported++;
      } catch (err) {
        console.error("Błąd importu produktu:", product.name, err);
      }
    }
    
    setShowReceiptImport(false);
    setReceiptText("");
    onToast(`📥 Zaimportowano ${imported} produktów z paragonu`);
  };

  return (
    <div className="module-panel shopping-panel">
      <div className="add-task">
        <h3>🛒 Dodaj produkt</h3>
        <div className="form-row-inline">
          <input placeholder="Nazwa (wymagane)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
          <input className="input-small" placeholder="Ilość" value={qty} onChange={(e) => setQty(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={addItem}>+ Dodaj do listy</button>
      </div>

      <input className="search-input" placeholder="🔍 Szukaj produktu..." value={search} onChange={(e) => setSearch(e.target.value)} />
      
      <div className="import-export-row">
        <button type="button" className="icon-btn export-btn" onClick={handleExport} title="Eksportuj listę">📥 Eksportuj</button>
        <button type="button" className="icon-btn import-btn" onClick={() => setShowImport(!showImport)} title="Importuj listę">📤 Importuj</button>
        <button type="button" className="icon-btn receipt-btn" onClick={() => setShowReceiptImport(!showReceiptImport)} title="Importuj z paragonu">🧾 Paragon</button>
        <button type="button" className="icon-btn history-btn" onClick={loadHistory} title="Historia list">📜 Historia</button>
        <button type="button" className="icon-btn save-history-btn" onClick={saveToHistory} title="Zapisz do historii">💾 Zapisz</button>
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
                  <select value={editCat} onChange={(e) => setEditCat(e.target.value)}>
                    {SHOPPING_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <button type="button" className="save-mini" onClick={() => saveEdit(item)}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => setEditingId(null)}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4 className={item.bought ? "done" : ""}>{item.name}</h4>
                    <div className="task-meta">
                      {item.quantity && <span className="badge category">{item.quantity}</span>}
                      <span className="badge category">{cat.emoji} {cat.label}</span>
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

      {showImport && (
        <div className="add-task">
          <h3>📤 Importuj listę zakupów</h3>
          <textarea
            placeholder="Wklej zawartość pliku eksportu tutaj..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
          />
          <div className="row">
            <button type="button" onClick={handleImport}>Importuj</button>
            <button type="button" className="cancel-btn" onClick={() => setShowImport(false)}>Anuluj</button>
          </div>
        </div>
      )}

      {showReceiptImport && (
        <div className="add-task">
          <h3>🧾 Importuj z paragonu</h3>
          <textarea
            placeholder="Wklej tekst z paragonu (np. z Lidl, Biedronka)...

Format obsługiwany:
- Mleko 3.50 zł
- Chleb x2 4.00 zł
- Masło 8.99 zł"
            value={receiptText}
            onChange={(e) => setReceiptText(e.target.value)}
            rows={8}
          />
          <div className="row">
            <button type="button" onClick={importFromReceipt}>Importuj produkty</button>
            <button type="button" className="cancel-btn" onClick={() => setShowReceiptImport(false)}>Anuluj</button>
          </div>
        </div>
      )}

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
                    <button type="button" className="icon-btn" onClick={() => viewHistoryDetail(h.id)} title="Szczegóły">👁️</button>
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { SHOPPING_CATEGORIES };
