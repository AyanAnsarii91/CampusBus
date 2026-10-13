import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";
import { auth } from "../services/firebase";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored =
        localStorage.getItem("campusbus_user") ||
        sessionStorage.getItem("campusbus_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const saveSession = (token, userData) => {
    localStorage.setItem("campusbus_token", token);
    localStorage.setItem("campusbus_user", JSON.stringify(userData));
    sessionStorage.removeItem("campusbus_token");
    sessionStorage.removeItem("campusbus_user");
    setUser(userData);
  };

  const clearSession = () => {
    localStorage.removeItem("campusbus_token");
    localStorage.removeItem("campusbus_user");
    sessionStorage.removeItem("campusbus_token");
    sessionStorage.removeItem("campusbus_user");
    setUser(null);
  };

  useEffect(() => {
    let isMounted = true;

    // Listen to Firebase persistent auth state
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        try {
          // Exchange / refresh Firebase ID token with CampusBus backend
          const idToken = await fbUser.getIdToken();
          const r = await authApi.firebaseLogin({ idToken });
          if (isMounted) {
            saveSession(r.data.token, r.data.user);
          }
        } catch (err) {
          console.warn("Could not exchange Firebase token with backend:", err);
          // Fallback: verify current JWT from localStorage if present
          const existingToken = localStorage.getItem("campusbus_token");
          if (existingToken) {
            try {
              const r = await authApi.me();
              if (isMounted) saveSession(existingToken, r.data.user);
            } catch {
              if (isMounted) clearSession();
            }
          } else {
            if (isMounted) clearSession();
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        // No Firebase user. Check if traditional backend session token exists
        const existingToken =
          localStorage.getItem("campusbus_token") ||
          sessionStorage.getItem("campusbus_token");
        if (existingToken) {
          try {
            const r = await authApi.me();
            if (isMounted) saveSession(existingToken, r.data.user);
          } catch {
            if (isMounted) clearSession();
          } finally {
            if (isMounted) setLoading(false);
          }
        } else {
          if (isMounted) {
            clearSession();
            setLoading(false);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithFirebase = async (idToken, extra = {}) => {
    const r = await authApi.firebaseLogin({ idToken, ...extra });
    saveSession(r.data.token, r.data.user);
    return r.data;
  };

  const login = async (data) => {
    const r = await authApi.login(data);
    saveSession(r.data.token, r.data.user);
    return r.data;
  };

  const register = async (data) => {
    const r = await authApi.register(data);
    saveSession(r.data.token, r.data.user);
    return r.data;
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn("Firebase sign-out error:", e);
    }
    clearSession();
  };

  const updateUser = (userData) => {
    try {
      localStorage.setItem("campusbus_user", JSON.stringify(userData));
    } catch (e) {
      console.warn("Could not save user to localStorage:", e);
    }
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithFirebase,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
