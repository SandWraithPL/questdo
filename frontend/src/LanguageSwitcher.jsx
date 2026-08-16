import { useState, useEffect } from "react";
import { setLanguage, getLanguage, t } from "./i18n";

export default function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState(getLanguage());

  useEffect(() => {
    const handleLanguageChange = () => {
      setCurrentLang(getLanguage());
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCurrentLang(lang);
  };

  const languages = [
    { code: 'pl', label: 'PL' },
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
  ];

  return (
    <div className="language-switcher">
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={`lang-btn ${currentLang === lang.code ? 'active' : ''}`}
          onClick={() => handleLanguageChange(lang.code)}
          title={t(lang.code === 'pl' ? 'polish' : lang.code === 'en' ? 'english' : 'spanish')}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
