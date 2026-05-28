import { createContext, useContext, useState, useCallback, useRef } from 'react';

export const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => push(msg, 'success', dur),
    error:   (msg, dur) => push(msg, 'error',   dur ?? 6000),
    warn:    (msg, dur) => push(msg, 'warn',     dur),
    info:    (msg, dur) => push(msg, 'info',     dur),
  };

  return (
    <ToastCtx.Provider value={{ toast, toasts, dismiss }}>
      {children}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx).toast;
}
