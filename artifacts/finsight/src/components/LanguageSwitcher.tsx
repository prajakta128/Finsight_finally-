import { useLanguage } from "../lib/LanguageContext";
import { LANGUAGES } from "../lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1 text-xs font-semibold">
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            lang === option.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
