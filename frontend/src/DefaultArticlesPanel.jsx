import { useState, useEffect } from "react";
import axios from "axios";
import { SHOPPING_CATEGORIES } from "./ShoppingPanel";

function getCategory(cat) {
  return SHOPPING_CATEGORIES.find((c) => c.value === cat) || SHOPPING_CATEGORIES[8];
}

export default function DefaultArticlesPanel({ api, headers, onToast }) {
  const [articles, setArticles] = useState([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("other");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editCat, setEditCat] = useState("other");
  const [editPrice, setEditPrice] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("other");

  const loadArticles = async () => {
    try {
      const res = await axios.get(`${api}/default-articles`, { headers });
      setArticles(res.data);
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd ładowania artykułów");
    }
  };

  useEffect(() => {
    loadArticles();
    loadDefaultCategory();
  }, []);

  const loadDefaultCategory = async () => {
    try {
      const res = await axios.get(`${api}/settings/default-category`, { headers });
      setDefaultCategory(res.data.category || "other");
    } catch {
      /* ignore */
    }
  };

  const addArticle = async () => {
    if (!name.trim()) {
      onToast("Podaj nazwę artykułu");
      return;
    }
    try {
      await axios.post(`${api}/default-articles`, {
        name,
        quantity: qty,
        category,
        default_price: parseFloat(price) || 0
      }, { headers });
      setName("");
      setQty("");
      setCategory("other");
      setPrice("");
      onToast("✅ Dodano artykuł domyślny");
      loadArticles();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd dodawania");
    }
  };

  const startEdit = (article) => {
    setEditingId(article.id);
    setEditName(article.name);
    setEditQty(article.quantity || "");
    setEditCat(article.category || "other");
    setEditPrice(article.default_price ? String(article.default_price) : "");
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await axios.patch(`${api}/default-articles/${editingId}`, {
        name: editName,
        quantity: editQty,
        category: editCat,
        default_price: parseFloat(editPrice) || 0
      }, { headers });
      setEditingId(null);
      setEditName("");
      setEditQty("");
      setEditCat("other");
      setEditPrice("");
      onToast("✅ Zaktualizowano artykuł");
      loadArticles();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd aktualizacji");
    }
  };

  const deleteArticle = async (id) => {
    try {
      await axios.delete(`${api}/default-articles/${id}`, { headers });
      onToast("🗑️ Usunięto artykuł");
      loadArticles();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd usuwania");
    }
  };

  const saveDefaultCategory = async () => {
    try {
      await axios.post(`${api}/settings/default-category`, { category }, { headers });
      setDefaultCategory(category);
      onToast("💾 Zapisano domyślną kategorię");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd zapisu domyślnej kategorii");
    }
  };

  return (
    <div className="module-panel">
      <div className="add-task">
        <h3>⚙️ Ustawienia domyślne</h3>
        <div className="form-row-inline">
          <label style={{color: '#aaa', fontSize: '0.9rem', minWidth: '120px'}}>Domyślna kategoria:</label>
          <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} style={{flex: 1}}>
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <button type="button" className="icon-btn" onClick={saveDefaultCategory} title="Zapisz domyślną kategorię" style={{padding: '4px 8px', fontSize: '0.9rem'}}>💾</button>
        </div>
      </div>
      <div className="add-task">
        <h3>➕ Dodaj artykuł domyślny</h3>
        <div className="form-row-inline">
          <input 
            placeholder="Nazwa (wymagane)" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && addArticle()} 
          />
          <input className="input-small" placeholder="Ilość" value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className="input-small" placeholder="Cena (zł)" value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" min="0" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={addArticle}>+ Dodaj artykuł</button>
      </div>

      <div className="product-list">
        {articles.length === 0 && (
          <p className="empty">Brak artykułów domyślnych. Dodaj pierwszy, aby móc go szybko wybierać przy dodawaniu do listy zakupów!</p>
        )}
        {articles.map((article) => {
          const cat = getCategory(article.category);
          const editing = editingId === article.id;
          return (
            <div key={article.id} className="task-card shopping-card easy">
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
                  <button type="button" className="save-mini" onClick={saveEdit}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => { setEditingId(null); setEditName(""); setEditQty(""); setEditCat("other"); setEditPrice(""); }}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4>{article.name}</h4>
                    <div className="task-meta">
                      {article.quantity && <span className="badge category">{article.quantity}</span>}
                      <span className="badge category">{cat.emoji} {cat.label}</span>
                      {article.default_price > 0 && <span className="badge category">💰 {article.default_price.toFixed(2)} zł</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button type="button" className="icon-btn" onClick={() => startEdit(article)} title="Edytuj">✏️</button>
                    <button type="button" className="icon-btn delete" onClick={() => deleteArticle(article.id)} title="Usuń">🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
