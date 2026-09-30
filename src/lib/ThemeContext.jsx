import { createContext, useContext, useState } from 'react'
import { setTheme, initTheme } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // Read the saved theme on the first render so dark-mode users never see a light flash
  const [theme, setThemeState] = useState(initTheme)

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
