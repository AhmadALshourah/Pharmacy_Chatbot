import { createContext, useContext, useState, useCallback } from 'react';

const LayoutCtx = createContext(null);

export function LayoutProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <LayoutCtx.Provider value={{ sidebarOpen, openSidebar, closeSidebar }}>
      {children}
    </LayoutCtx.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutCtx);
}
