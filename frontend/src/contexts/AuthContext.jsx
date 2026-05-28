import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, userLogin as apiUserLogin, getMe, getUserMe, token } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // principal: the logged-in entity (admin or user), with a `principalType` field
  const [principal, setPrincipal] = useState(null);
  const [loading,   setLoading]   = useState(true);

  // On mount: restore session from stored token
  useEffect(() => {
    if (!token.get()) {
      setLoading(false);
      return;
    }
    const type = token.getType();
    const fetchMe = type === 'user' ? getUserMe : getMe;
    fetchMe()
      .then(setPrincipal)
      .catch(() => token.clear())
      .finally(() => setLoading(false));
  }, []);

  // Admin login — remember=true → localStorage (persists); false → sessionStorage (tab-only)
  const login = useCallback(async (username, password, remember = true) => {
    const data = await apiLogin(username, password, remember);
    setPrincipal(data);
    return data;
  }, []);

  // User login
  const loginUser = useCallback(async (username, password, remember = true) => {
    const data = await apiUserLogin(username, password, remember);
    setPrincipal(data);
    return data;
  }, []);

  // Logout
  const logout = useCallback(() => {
    token.clear();
    setPrincipal(null);
  }, []);

  // Derived conveniences
  const isUser  = principal?.principalType === 'user';
  const isAdmin = principal?.principalType === 'admin';
  // Backward-compat: pages that use `admin` still work
  const admin   = isAdmin ? principal : null;

  return (
    <AuthContext.Provider value={{ principal, admin, isUser, isAdmin, loading, login, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
