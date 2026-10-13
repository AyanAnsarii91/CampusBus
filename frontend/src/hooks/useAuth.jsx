import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";
import { auth, persistencePromise } from "../services/firebase";
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
    let initialRestorationDone = false;
    let unsubscribe = null;

    // Helper to finish initial startup loading safely
    const finishInitialLoad = () => {
      if (isMounted && !initialRestorationDone) {
        initialRestorationDone = true;
        setLoading(false);
      }
    };

    // Safety timeout: Never allow loading to hang indefinitely if Firebase or network is blocked
    const safetyTimer = setTimeout(() => {
      if (isMounted && !initialRestorationDone) {
        console.warn("[CampusBus Auth] Initial restoration timeout reached; completing load.");
        finishInitialLoad();
      }
    }, 6000);

    const initAuth = async () => {
      // 1. Wait for Firebase browserLocalPersistence to be ready
      try {
        await persistencePromise;
      } catch (err) {
        console.warn("[CampusBus Auth] Firebase persistence readiness notice:", err);
      }

      if (!isMounted) return;

      // 2. Restore auth state with onAuthStateChanged before deciding whether user is logged in
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!isMounted) return;

        if (fbUser) {
          // If the locally stored session belongs to an active driver (who uses MongoDB credentials),
          // do not let background Firebase state overwrite it!
          const storedUser = (() => {
            try {
              return JSON.parse(localStorage.getItem("campusbus_user") || "null");
            } catch {
              return null;
            }
          })();

          if (storedUser && storedUser.role === "driver" && !storedUser.firebaseUid) {
            console.info("[CampusBus Auth] Preserving active driver session over background Firebase state.");
            finishInitialLoad();
            return;
          }

          // Firebase authenticated user restored from browserLocalPersistence
          try {
            let idToken = await fbUser.getIdToken();
            let r;
            try {
              r = await authApi.firebaseLogin({ idToken });
            } catch (exchangeErr) {
              if (exchangeErr.response?.status === 401) {
                // ID token expired; force refresh from Firebase servers
                const freshIdToken = await fbUser.getIdToken(true);
                r = await authApi.firebaseLogin({ idToken: freshIdToken });
              } else {
                throw exchangeErr;
              }
            }

            if (isMounted && r?.data) {
              saveSession(r.data.token, r.data.user);
            }
          } catch (err) {
            console.warn("[CampusBus Auth] Firebase auth restoration notice:", err);
            if (err.response?.status === 401 || err.response?.status === 403) {
              if (isMounted) clearSession();
            } else {
              // Network error / server offline: Do not log out! Retain cached session for offline PWA
              const existingToken =
                localStorage.getItem("campusbus_token") ||
                sessionStorage.getItem("campusbus_token");
              if (existingToken) {
                try {
                  const meRes = await authApi.me();
                  if (isMounted && meRes.data?.user) {
                    saveSession(existingToken, meRes.data.user);
                  }
                } catch (meErr) {
                  if (meErr.response?.status === 401 || meErr.response?.status === 403) {
                    if (isMounted) clearSession();
                  } else {
                    console.info("[CampusBus Auth] Network unavailable. Retaining cached user session for offline PWA.");
                    const cachedUser = localStorage.getItem("campusbus_user");
                    if (cachedUser && isMounted) {
                      try {
                        setUser(JSON.parse(cachedUser));
                      } catch {}
                    }
                  }
                }
              }
            }
          } finally {
            finishInitialLoad();
          }
        } else {
          // No active Firebase user in persistence. Check if traditional backend JWT exists
          const existingToken =
            localStorage.getItem("campusbus_token") ||
            sessionStorage.getItem("campusbus_token");

          if (existingToken) {
            try {
              const r = await authApi.me();
              if (isMounted && r.data?.user) {
                saveSession(existingToken, r.data.user);
              }
            } catch (err) {
              if (err.response?.status === 401 || err.response?.status === 403) {
                // Invalid or expired backend JWT with no Firebase user to reissue it
                if (isMounted) clearSession();
              } else {
                // Server offline or network error: Retain cached session for offline PWA
                console.info("[CampusBus Auth] Server offline or network unavailable. Retaining cached user session.");
                const cachedUser = localStorage.getItem("campusbus_user");
                if (cachedUser && isMounted) {
                  try {
                    setUser(JSON.parse(cachedUser));
                  } catch {}
                }
              }
            } finally {
              finishInitialLoad();
            }
          } else {
            // No stored credentials at all
            if (isMounted) clearSession();
            finishInitialLoad();
          }
        }
      });
    };

    initAuth();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loginWithFirebase = async (idToken, extra = {}) => {
    const r = await authApi.firebaseLogin({ idToken, ...extra });
    saveSession(r.data.token, r.data.user);
    return r.data;
  };

  const login = async (data) => {
    try {
      if (auth?.currentUser) {
        await fbSignOut(auth);
      }
    } catch (e) {
      console.warn("[useAuth] Firebase signout before login notice:", e);
    }
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
