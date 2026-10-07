import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("campusbus_user"));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authApi
      .me()
      .then((r) => {
        setUser(r.data.user);
        sessionStorage.setItem("campusbus_user", JSON.stringify(r.data.user));
      })
      .catch(() => {
        sessionStorage.removeItem("campusbus_token");
        sessionStorage.removeItem("campusbus_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);
  const login = async (data) => {
    const r = await authApi.login(data);
    sessionStorage.setItem("campusbus_token", r.data.token);
    sessionStorage.setItem("campusbus_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data;
  };
  const register = async (data) => {
    const r = await authApi.register(data);
    sessionStorage.setItem("campusbus_token", r.data.token);
    sessionStorage.setItem("campusbus_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data;
  };
  const logout = () => {
    sessionStorage.removeItem("campusbus_token");
    sessionStorage.removeItem("campusbus_user");
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
