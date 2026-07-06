// Importy React
import { useState } from "react";

// Hook do zarządzania edycją pojedynczego elementu (zadanie, zakupy itp)
export function useEditItem(saveItem) {
  // ID elementu który edytujemy
  const [editingId, setEditingId] = useState(null);
  // Forma edycji - przechowuje zmienione pola
  const [editForm, setEditForm] = useState({});

  // Rozpoczyna edycję - ustawiamy ID i inicjalny stan formy
  const startEdit = (item, initialForm) => {
    setEditingId(item.id);
    setEditForm(initialForm);
  };

  // Anuluje edycję - czyszczą formularz
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Zapisuje edycję - wysyła zmianę i czysty stan
  const saveEdit = async (item) => {
    await saveItem(item.id, editForm);
    cancelEdit();
  };

  // Zwracamy stan i funkcje do edycji
  return { editingId, editForm, setEditForm, startEdit, cancelEdit, saveEdit };
}