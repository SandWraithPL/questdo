// Prosty system i18n bez zewnętrznych zależności
import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  pl: {
    // Nagłówek
    headerTitle: "Questdo",
    // Zakładki
    tabQuests: "Questy",
    tabRecurring: "Cykliczne",
    tabEarnings: "Zarobki",
    tabSchedule: "Plan",
    tabShopping: "Zakupy",
    tabSettings: "Ustawienia",
    // Ogólne
    add: "Dodaj",
    save: "Zapisz",
    cancel: "Anuluj",
    delete: "Usuń",
    edit: "Edytuj",
    copy: "Kopiuj",
    today: "Dzisiaj",
    loading: "Ładowanie...",
    empty: "Brak wpisów",
    // Questy
    newQuest: "+ Nowy Quest na",
    questName: "Nazwa zadania...",
    questDesc: "Opis...",
    questType: "Typ zadania",
    questTypeQuest: "⚔️ Quest (do wykonania)",
    questTypeEvent: "📅 Wydarzenie (urodziny, notatka)",
    difficulty: "Trudność",
    difficultyEasy: "Łatwy",
    difficultyMedium: "Średni",
    difficultyHard: "Trudny",
    category: "Kategoria",
    date: "Data",
    time: "Czas",
    reminder: "Przypomnienie",
    reminderNone: "Bez przypomnienia",
    reminderSameDay: "W dniu zadania",
    reminderOneDay: "Dzień wcześniej",
    reminderThreeDays: "3 dni wcześniej",
    reminderOneWeek: "Tydzień wcześniej",
    addToList: "+ Dodaj zadanie",
    copyQuest: "📋 Kopiuj quest",
    targetDate: "Data docelowa",
    // Zarobki
    newWorkEntry: "+ Nowy wpis pracy",
    startTime: "Od:",
    endTime: "Do:",
    hourlyRate: "Stawka godzinowa",
    notes: "Notatka",
    unpaidBreak: "Niepłatna przerwa (minuty)",
    saveEntry: "Zapisz wpis",
    copyWork: "📋 Kopiuj pracę",
    recurring: "Cykliczne",
    startDate: "Data rozpoczęcia",
    endDate: "Data zakończenia (opcjonalnie)",
    // Plan
    newClass: "+ Nowe zajęcia",
    className: "Nazwa zajęć",
    location: "Sala / budynek",
    lecturer: "Prowadzący",
    importSchedule: "Importuj plan",
    // Zakupy
    newProduct: "+ Dodaj produkt",
    productName: "Nazwa produktu...",
    quantity: "Ilość",
    price: "Cena jedn. (zł)",
    categoryShopping: "Kategoria",
    addToShoppingList: "+ Dodaj do listy",
    bought: "Kupione",
    history: "Historia zakupów",
    totalSpent: "Suma wydana",
    // Ustawienia
    settings: "Ustawienia",
    profile: "Profil",
    family: "Rodzina",
    categories: "Kategorie",
    recurringEvents: "Wydarzenia cykliczne",
    // Kalendarz
    calendar: "📅 Kalendarz",
    monthView: "Miesiąc",
    weekView: "Tydzień",
    dayView: "Dzień",
    // Dni tygodnia
    monday: "Poniedziałek",
    tuesday: "Wtorek",
    wednesday: "Środa",
    thursday: "Czwartek",
    friday: "Piątek",
    saturday: "Sobota",
    sunday: "Niedziela",
    mon: "Pn",
    tue: "Wt",
    wed: "Śr",
    thu: "Cz",
    fri: "Pt",
    sat: "So",
    sun: "Nd",
    // Komunikaty
    saved: "✅ Zapisano zmiany",
    deleted: "🗑️ Usunięto",
    error: "Błąd",
    required: "Pole wymagane",
    earlyBonus: "Wcześnie +50%",
    onTime: "Na czas",
    latePenalty: "Spóźnione -50%",
    // Języki
    polish: "Polski",
    english: "English",
    spanish: "Español",
    // Rangi/tytuły
    rankCadet: "Kadet",
    rankRecruit: "Rekrut",
    rankScout: "Zwiadowca",
    rankSoldier: "Żołnierz",
    rankAce: "As",
    rankTactician: "Taktyk",
    rankRival: "Rywal",
    rankVeteranOnWay: "Weteran w drodze",
    rankInTraining: "W treningu",
    rankRhythmMaster: "Mistrz rytmu",
    rankApprentice: "Uczeń",
    rankKnight: "Rycerz",
    rankInProgress: "W przebiegu",
    rankGuardian: "Strażnik",
    rankInShadow: "W cieniu",
    rankArchitect: "Architekt",
    rankTheorist: "Teoretyk",
    rankDecider: "Decydent",
    rankWithinReach: "W zasięgu",
    rankLegend: "Legenda",
    // Profil
    level: "Poziom",
    exp: "EXP",
    nextLevel: "Następny poziom",
    totalExp: "Całkowite EXP",
    completedQuests: "Ukończone questy",
    currentStreak: "Aktualna seria",
    longestStreak: "Najdłuższa seria",
    notificationsEnabled: "Powiadomienia włączone",
    notificationsDisabled: "Powiadomienia wyłączone",
    enableNotifications: "Włącz powiadomienia",
    disableNotifications: "Wyłącz powiadomienia",
    // Osiągnięcia
    achievements: "Osiągnięcia",
    noAchievements: "Brak osiągnięć",
    // Opisy
    important: "Ważne",
    recurringWeekly: "Cykliczne (co tydzień)",
    recurring: "Cykliczne",
    completed: "Ukończone",
    confirmed: "Potwierdzone",
    gross: "Brutto",
    net: "Netto",
    tax: "Podatek",
    hourlyRate: "Stawka godzinowa",
    unpaidBreak: "Niepłatna przerwa",
    notes: "Notatka",
    location: "Sala / budynek",
    lecturer: "Prowadzący",
    importSchedule: "Importuj plan",
    // Komunikaty
    saveChanges: "Zapisz zmiany",
    cancelEdit: "Anuluj edycję",
    editTask: "Edytuj zadanie",
    copyTask: "Kopiuj zadanie",
    deleteTask: "Usuń zadanie",
  },
  en: {
    // Header
    headerTitle: "Questdo",
    // Tabs
    tabQuests: "Quests",
    tabRecurring: "Recurring",
    tabEarnings: "Earnings",
    tabSchedule: "Schedule",
    tabShopping: "Shopping",
    tabSettings: "Settings",
    // General
    add: "Add",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    copy: "Copy",
    today: "Today",
    loading: "Loading...",
    empty: "No entries",
    // Quests
    newQuest: "+ New Quest for",
    questName: "Task name...",
    questDesc: "Description...",
    questType: "Task type",
    questTypeQuest: "⚔️ Quest (to complete)",
    questTypeEvent: "📅 Event (birthday, note)",
    difficulty: "Difficulty",
    difficultyEasy: "Easy",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    category: "Category",
    date: "Date",
    time: "Time",
    reminder: "Reminder",
    reminderNone: "No reminder",
    reminderSameDay: "On task day",
    reminderOneDay: "One day before",
    reminderThreeDays: "3 days before",
    reminderOneWeek: "One week before",
    addToList: "+ Add task",
    copyQuest: "📋 Copy quest",
    targetDate: "Target date",
    // Earnings
    newWorkEntry: "+ New work entry",
    startTime: "From:",
    endTime: "To:",
    hourlyRate: "Hourly rate",
    notes: "Notes",
    unpaidBreak: "Unpaid break (minutes)",
    saveEntry: "Save entry",
    copyWork: "📋 Copy work",
    recurring: "Recurring",
    startDate: "Start date",
    endDate: "End date (optional)",
    // Schedule
    newClass: "+ New class",
    className: "Class name",
    location: "Room / building",
    lecturer: "Lecturer",
    importSchedule: "Import schedule",
    // Shopping
    newProduct: "+ Add product",
    productName: "Product name...",
    quantity: "Quantity",
    price: "Unit price (PLN)",
    categoryShopping: "Category",
    addToShoppingList: "+ Add to list",
    bought: "Bought",
    history: "Shopping history",
    totalSpent: "Total spent",
    // Settings
    settings: "Settings",
    profile: "Profile",
    family: "Family",
    categories: "Categories",
    recurringEvents: "Recurring events",
    // Calendar
    calendar: "📅 Calendar",
    monthView: "Month",
    weekView: "Week",
    dayView: "Day",
    // Weekdays
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
    // Messages
    saved: "✅ Changes saved",
    deleted: "🗑️ Deleted",
    error: "Error",
    required: "Required field",
    earlyBonus: "Early +50%",
    onTime: "On time",
    latePenalty: "Late -50%",
    // Languages
    polish: "Polish",
    english: "English",
    spanish: "Spanish",
    // Ranks/titles
    rankCadet: "Cadet",
    rankRecruit: "Recruit",
    rankScout: "Scout",
    rankSoldier: "Soldier",
    rankAce: "Ace",
    rankTactician: "Tactician",
    rankRival: "Rival",
    rankVeteranOnWay: "Veteran on the way",
    rankInTraining: "In training",
    rankRhythmMaster: "Rhythm master",
    rankApprentice: "Apprentice",
    rankKnight: "Knight",
    rankInProgress: "In progress",
    rankGuardian: "Guardian",
    rankInShadow: "In shadow",
    rankArchitect: "Architect",
    rankTheorist: "Theorist",
    rankDecider: "Decider",
    rankWithinReach: "Within reach",
    rankLegend: "Legend",
    // Profile
    level: "Level",
    exp: "EXP",
    nextLevel: "Next level",
    totalExp: "Total EXP",
    completedQuests: "Completed quests",
    currentStreak: "Current streak",
    longestStreak: "Longest streak",
    notificationsEnabled: "Notifications enabled",
    notificationsDisabled: "Notifications disabled",
    enableNotifications: "Enable notifications",
    disableNotifications: "Disable notifications",
    // Achievements
    achievements: "Achievements",
    noAchievements: "No achievements",
    // Descriptions
    important: "Important",
    recurringWeekly: "Recurring (weekly)",
    recurring: "Recurring",
    completed: "Completed",
    confirmed: "Confirmed",
    gross: "Gross",
    net: "Net",
    tax: "Tax",
    hourlyRate: "Hourly rate",
    unpaidBreak: "Unpaid break",
    notes: "Notes",
    location: "Room / building",
    lecturer: "Lecturer",
    importSchedule: "Import schedule",
    // Messages
    saveChanges: "Save changes",
    cancelEdit: "Cancel edit",
    editTask: "Edit task",
    copyTask: "Copy task",
    deleteTask: "Delete task",
  },
  es: {
    // Header
    headerTitle: "Questdo",
    // Tabs
    tabQuests: "Misiones",
    tabRecurring: "Recurrente",
    tabEarnings: "Ganancias",
    tabSchedule: "Horario",
    tabShopping: "Compras",
    tabSettings: "Configuración",
    // General
    add: "Añadir",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    copy: "Copiar",
    today: "Hoy",
    loading: "Cargando...",
    empty: "Sin entradas",
    // Quests
    newQuest: "+ Nueva misión para",
    questName: "Nombre de tarea...",
    questDesc: "Descripción...",
    questType: "Tipo de tarea",
    questTypeQuest: "⚔️ Misión (para completar)",
    questTypeEvent: "📅 Evento (cumpleaños, nota)",
    difficulty: "Dificultad",
    difficultyEasy: "Fácil",
    difficultyMedium: "Media",
    difficultyHard: "Difícil",
    category: "Categoría",
    date: "Fecha",
    time: "Hora",
    reminder: "Recordatorio",
    reminderNone: "Sin recordatorio",
    reminderSameDay: "El día de la tarea",
    reminderOneDay: "Un día antes",
    reminderThreeDays: "3 días antes",
    reminderOneWeek: "Una semana antes",
    addToList: "+ Añadir tarea",
    copyQuest: "📋 Copiar misión",
    targetDate: "Fecha objetivo",
    // Earnings
    newWorkEntry: "+ Nueva entrada de trabajo",
    startTime: "Desde:",
    endTime: "Hasta:",
    hourlyRate: "Tarifa por hora",
    notes: "Notas",
    unpaidBreak: "Pausa no pagada (minutos)",
    saveEntry: "Guardar entrada",
    copyWork: "📋 Copiar trabajo",
    recurring: "Recurrente",
    startDate: "Fecha de inicio",
    endDate: "Fecha de fin (opcional)",
    // Schedule
    newClass: "+ Nueva clase",
    className: "Nombre de clase",
    location: "Aula / edificio",
    lecturer: "Profesor",
    importSchedule: "Importar horario",
    // Shopping
    newProduct: "+ Añadir producto",
    productName: "Nombre del producto...",
    quantity: "Cantidad",
    price: "Precio unitario (PLN)",
    categoryShopping: "Categoría",
    addToShoppingList: "+ Añadir a la lista",
    bought: "Comprado",
    history: "Historial de compras",
    totalSpent: "Total gastado",
    // Settings
    settings: "Configuración",
    profile: "Perfil",
    family: "Familia",
    categories: "Categorías",
    recurringEvents: "Eventos recurrentes",
    // Calendar
    calendar: "📅 Calendario",
    monthView: "Mes",
    weekView: "Semana",
    dayView: "Día",
    // Weekdays
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    sunday: "Domingo",
    mon: "Lun",
    tue: "Mar",
    wed: "Mié",
    thu: "Jue",
    fri: "Vie",
    sat: "Sáb",
    sun: "Dom",
    // Messages
    saved: "✅ Cambios guardados",
    deleted: "🗑️ Eliminado",
    error: "Error",
    required: "Campo requerido",
    earlyBonus: "Temprano +50%",
    onTime: "A tiempo",
    latePenalty: "Tarde -50%",
    // Languages
    polish: "Polaco",
    english: "Inglés",
    spanish: "Español",
    // Rangos/títulos
    rankCadet: "Cadete",
    rankRecruit: "Recluta",
    rankScout: "Explorador",
    rankSoldier: "Soldado",
    rankAce: "As",
    rankTactician: "Táctico",
    rankRival: "Rival",
    rankVeteranOnWay: "Veterano en camino",
    rankInTraining: "En entrenamiento",
    rankRhythmMaster: "Maestro del ritmo",
    rankApprentice: "Aprendiz",
    rankKnight: "Caballero",
    rankInProgress: "En progreso",
    rankGuardian: "Guardián",
    rankInShadow: "En sombra",
    rankArchitect: "Arquitecto",
    rankTheorist: "Teórico",
    rankDecider: "Decisor",
    rankWithinReach: "Al alcance",
    rankLegend: "Leyenda",
    // Perfil
    level: "Nivel",
    exp: "EXP",
    nextLevel: "Siguiente nivel",
    totalExp: "EXP total",
    completedQuests: "Misiones completadas",
    currentStreak: "Racha actual",
    longestStreak: "Racha más larga",
    notificationsEnabled: "Notificaciones activadas",
    notificationsDisabled: "Notificaciones desactivadas",
    enableNotifications: "Activar notificaciones",
    disableNotifications: "Desactivar notificaciones",
    // Logros
    achievements: "Logros",
    noAchievements: "Sin logros",
    // Descripciones
    important: "Importante",
    recurringWeekly: "Recurrente (semanal)",
    recurring: "Recurrente",
    completed: "Completado",
    confirmed: "Confirmado",
    gross: "Bruto",
    net: "Neto",
    tax: "Impuesto",
    hourlyRate: "Tarifa por hora",
    unpaidBreak: "Pausa no pagada",
    notes: "Notas",
    location: "Aula / edificio",
    lecturer: "Profesor",
    importSchedule: "Importar horario",
    // Mensajes
    saveChanges: "Guardar cambios",
    cancelEdit: "Cancelar edición",
    editTask: "Editar tarea",
    copyTask: "Copiar tarea",
    deleteTask: "Eliminar tarea",
  },
};

let currentLanguage = 'pl';

export const setLanguage = (lang) => {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('questdo-language', lang);
    window.dispatchEvent(new Event('languagechange'));
  }
};

export const getLanguage = () => {
  return currentLanguage;
};

export const t = (key) => {
  return translations[currentLanguage][key] || translations['en'][key] || key;
};

export const initLanguage = () => {
  const saved = localStorage.getItem('questdo-language');
  if (saved && translations[saved]) {
    currentLanguage = saved;
  } else {
    const browserLang = navigator.language.split('-')[0];
    if (translations[browserLang]) {
      currentLanguage = browserLang;
    }
  }
  return currentLanguage;
};

export const translationsObj = translations;

// React Context for i18n
const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(initLanguage());

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      currentLanguage = lang; // Sync with global state for helper functions
      localStorage.setItem('questdo-language', lang);
    }
  };

  const translate = (key) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
