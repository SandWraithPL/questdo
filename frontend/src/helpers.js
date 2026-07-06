export function applyUserFromResponse(data, onUserUpdate) {
  if (data?.exp !== undefined) {
    onUserUpdate({
      exp: data.exp,
      level: data.level,
      title: data.title,
      next_level_exp: data.next_level_exp,
      next_level_title: data.next_level_title,
    });
  }
}

export function isValidQtyInput(value, unit) {
  if (value === "") return true;
  if (unit === "szt") return /^\d+$/.test(value);
  if (unit === "kg" || unit === "l") {
    if (!/^[\d,.]*$/.test(value)) return false;
    return (value.match(/[.,]/g) || []).length <= 1;
  }
  return true;
}

export function validateQuantity(qty, unit, onToast) {
  if (!qty) return true;
  const qtyValue = parseFloat(qty.replace(",", "."));
  if (isNaN(qtyValue)) { onToast("Nieprawidłowa ilość"); return false; }
  if (unit === "szt" && !Number.isInteger(qtyValue)) { onToast("Dla sztuk podaj liczbę całkowitą"); return false; }
  if ((unit === "kg" || unit === "l") && (qty.replace(",", ".").split(".")[1] || "").length > 3) {
    onToast("Dla kg/l podaj max 3 miejsca po przecinku");
    return false;
  }
  return true;
}
