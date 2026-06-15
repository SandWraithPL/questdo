import { useState } from "react";

export function useEditItem(saveItem) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const startEdit = (item, initialForm) => {
    setEditingId(item.id);
    setEditForm(initialForm);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (item) => {
    await saveItem(item.id, editForm);
    cancelEdit();
  };

  return { editingId, editForm, setEditForm, startEdit, cancelEdit, saveEdit };
}