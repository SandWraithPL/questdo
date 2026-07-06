// Funkcja aktualizuje dane użytkownika na podstawie odpowiedzi z API
export function applyUserFromResponse(data, onUserUpdate) {
  // Jeśli API zwróciło dane o doświadczeniu, aktualizujemy level gracza
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

// Sprawdza czy wpisana ilość ma prawidłowy format (zależy od jednostki)
export function isValidQtyInput(value, unit) {
  if (value === "") return true; // Puste to ok
  if (unit === "szt") return /^\d+$/.test(value); // Sztuki muszą być liczby całkowite
  if (unit === "kg" || unit === "l") {
    // kg i litry mogą mieć przecinek
    if (!/^[\d,.]*$/.test(value)) return false;
    // Ale tylko jeden przecinek
    return (value.match(/[.,]/g) || []).length <= 1;
  }
  return true;
}

// Waliduje ilość - sprawdza czy jest prawidłowa dla danej jednostki
export function validateQuantity(qty, unit, onToast) {
  if (!qty) return true; // Pusta ilość to ok
  const qtyValue = parseFloat(qty.replace(",", "."));
  if (isNaN(qtyValue)) { 
    onToast("Nieprawidłowa ilość"); 
    return false; 
  }
  // Sztuki muszą być liczbą całkowitą
  if (unit === "szt" && !Number.isInteger(qtyValue)) { 
    onToast("Dla sztuk podaj liczbę całkowitą"); 
    return false; 
  }
  // kg i litry mogą mieć max 3 miejsca po przecinku
  if ((unit === "kg" || unit === "l") && (qty.replace(",", ".").split(".")[1] || "").length > 3) {
    onToast("Dla kg/l podaj max 3 miejsca po przecinku");
    return false;
  }
  return true;
}
