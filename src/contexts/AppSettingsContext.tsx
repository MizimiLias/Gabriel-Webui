import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { translations, type Language, type TranslationKey } from '../i18n'
import {
  AppSettingsContext,
  type AppSettingsValue,
  type ResolvedTheme,
  type ThemeMode,
} from './app-settings'
const LANGUAGE_KEY = 'gabriel.language'
const THEME_KEY = 'gabriel.theme'

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    if (stored === 'zh' || stored === 'en') {
      return stored
    }
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Fall through to the system preference.
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readLanguage)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readThemeMode)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(LANGUAGE_KEY, language)
    } catch {
      // The current session still reflects the selection.
    }
  }, [language])

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themeMode)
    } catch {
      // The current session still reflects the selection.
    }
  }, [themeMode])

  const setLanguage = useCallback((value: Language) => setLanguageState(value), [])
  const setThemeMode = useCallback((value: ThemeMode) => setThemeModeState(value), [])
  const t = useCallback(
    (key: TranslationKey) => translations[language][key],
    [language],
  )

  const value = useMemo<AppSettingsValue>(
    () => ({
      language,
      setLanguage,
      locale: language === 'zh' ? 'zh-CN' : 'en',
      themeMode,
      setThemeMode,
      resolvedTheme,
      t,
    }),
    [language, resolvedTheme, setLanguage, setThemeMode, t, themeMode],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
