import { createContext, useContext } from 'react'
import type { Language, TranslationKey } from '../i18n'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface AppSettingsValue {
  language: Language
  setLanguage: (language: Language) => void
  locale: string
  themeMode: ThemeMode
  setThemeMode: (theme: ThemeMode) => void
  resolvedTheme: ResolvedTheme
  t: (key: TranslationKey) => string
}

export const AppSettingsContext = createContext<AppSettingsValue | null>(null)

export function useAppSettings(): AppSettingsValue {
  const value = useContext(AppSettingsContext)
  if (!value) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider')
  }
  return value
}
