import { useLanguage } from "./i18n.jsx";

export default function LanguageSwitcher() {
  const { language, changeLanguage, t } = useLanguage();

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
          className={`lang-btn ${language === lang.code ? 'active' : ''}`}
          onClick={() => changeLanguage(lang.code)}
          title={t(lang.code === 'pl' ? 'polish' : lang.code === 'en' ? 'english' : 'spanish')}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
