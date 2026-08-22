import { createContext, useContext, useState, useEffect } from 'react';
import { en } from './en';
import { zh } from './zh';

export type Locale = 'zh' | 'en';
export type Translations = typeof zh;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: any }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('oxygenclaw:locale');
    return (saved as Locale) || 'zh';
  });

  useEffect(() => {
    localStorage.setItem('oxygenclaw:locale', locale);
  }, [locale]);

  const t = locale === 'zh' ? zh : en;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}