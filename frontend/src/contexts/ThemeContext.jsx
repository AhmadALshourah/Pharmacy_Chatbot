import { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('pc-theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-pc-theme', dark ? 'dark' : '');
    localStorage.setItem('pc-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
