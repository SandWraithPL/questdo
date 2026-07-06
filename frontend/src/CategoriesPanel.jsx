import { useState, useEffect } from "react";
import axios from "axios";
import { SHOPPING_CATEGORIES } from "./ShoppingPanel";

function formatMoney(value) {
  const num = Number(value || 0);
  const formatted = num.toFixed(2).replace(".", ",");
  return `${formatted} zł`;
}

function formatQuantity(value) {
  if (!value) return "";
  return value.replace(".", ",");
}

function parseRateInput(value) {
  if (!value) return "";
  return value.replace(",", ".");
}

function getCategory(cat) {
  return SHOPPING_CATEGORIES.find((c) => c.value === cat) || SHOPPING_CATEGORIES[8];
}

export default function CategoriesPanel({ api, headers, onToast, familyId }) {
  const [articles, setArticles] = useState([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("szt");
  const [category, setCategory] = useState("other");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("szt");
  const [editCat, setEditCat] = useState("other");
  const [editPrice, setEditPrice] = useState("");

  const loadArticles = async () => {
    try {
      const params = familyId ? { family_id: familyId } : {};
      const res = await axios.get(`${api}/default-articles`, { headers, params });
      setArticles(res.data);
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd ładowania artykułów");
    }
  };

  useEffect(() => {
    loadArticles();
  }, [familyId]);

  const addArticle = async () => {
    if (!name.trim()) {
      onToast("Podaj nazwę artykułu");
      return;
    }
    try {
      await axios.post(`${api}/default-articles`, {
        name,
        unit,
        category,
        default_price: parseFloat(parseRateInput(price)) || 0,
        family_id: familyId || null
      }, { headers });
      setName("");
      setUnit("szt");
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
    setEditUnit(article.unit || "szt");
    setEditCat(article.category || "other");
    setEditPrice(article.default_price ? article.default_price.toFixed(2).replace(".", ",") : "");
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await axios.patch(`${api}/default-articles/${editingId}`, {
        name: editName,
        unit: editUnit,
        category: editCat,
        default_price: parseFloat(parseRateInput(editPrice)) || 0
      }, { headers });
      setEditingId(null);
      setEditName("");
      setEditUnit("szt");
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

  return (
    <div className="module-panel settings-panel">
      <div className="add-task">
        <h3>➕ Dodaj artykuł domyślny</h3>
        <div className="form-row-inline">
          <input
            placeholder="Nazwa (wymagane)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addArticle()}
          />
          <select className="input-small" style={{ width: '100px', flex: '0 0 auto' }} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="szt">szt</option>
            <option value="kg">kg</option>
            <option value="l">l</option>
          </select>
          <input className="input-small" placeholder="Cena (zł)" value={price} onChange={(e) => setPrice(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="add-task-btn" onClick={addArticle}>+ Dodaj artykuł</button>
      </div>

      <div className="day-tasks-panel">
        <div className="tasks-header">
          <h3>📦 Artykuły domyślne</h3>
        </div>
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
                  <select className="input-small" style={{ width: '100px', flex: '0 0 auto' }} value={editUnit} onChange={(e) => setEditUnit(e.target.value)}>
                    <option value="szt">szt</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                  </select>
                  <input className="input-small" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Cena (zł)" />
                  <select value={editCat} onChange={(e) => setEditCat(e.target.value)}>
                    {SHOPPING_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <button type="button" className="save-mini" onClick={saveEdit}>✓</button>
                  <button type="button" className="cancel-mini" onClick={() => { setEditingId(null); setEditName(""); setEditUnit("szt"); setEditCat("other"); setEditPrice(""); }}>✗</button>
                </div>
              ) : (
                <>
                  <div className="task-info">
                    <h4>{article.name}</h4>
                    <div className="task-meta">
                      <span className="badge category">{article.unit || "szt"}</span>
                      <span className="badge category">{cat.emoji} {cat.label}</span>
                      {article.default_price > 0 && <span className="badge category">💰 {formatMoney(article.default_price)}</span>}
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