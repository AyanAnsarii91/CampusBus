import axios from "axios";
import { auth } from "./firebase";

const LOCAL_BACKEND_URL = "http://localhost:5000";
const PRODUCTION_BACKEND_URL = "https://campusbus-1czm.onrender.com";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const defaultBackendUrl =
  typeof window !== "undefined" && localHosts.has(window.location.hostname)
    ? LOCAL_BACKEND_URL
    : PRODUCTION_BACKEND_URL;
const withoutTrailingSlash = (url) => url.replace(/\/+$/, "");

export const API_URL = withoutTrailingSlash(
  import.meta.env.VITE_API_URL || `${defaultBackendUrl}/api`,
);
export const SOCKET_URL = withoutTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || defaultBackendUrl,
);

const api = axios.create({ baseURL: API_URL, timeout: 10000 });
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("campusbus_token") ||
    sessionStorage.getItem("campusbus_token");
  if (token) {
    if (config.headers && typeof config.headers.set === "function") {
      if (!config.headers.get("Authorization")) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    } else {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/firebase")
    ) {
      originalRequest._retry = true;
      try {
        const fbUser = auth?.currentUser;
        if (fbUser) {
          const freshIdToken = await fbUser.getIdToken(true);
          const refreshRes = await axios.post(`${API_URL}/auth/firebase`, {
            idToken: freshIdToken,
          });
          const newToken = refreshRes.data?.token;
          if (newToken) {
            localStorage.setItem("campusbus_token", newToken);
            if (refreshRes.data?.user) {
              localStorage.setItem(
                "campusbus_user",
                JSON.stringify(refreshRes.data.user),
              );
            }
            if (originalRequest.headers) {
              if (typeof originalRequest.headers.set === "function") {
                originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
            }
            return api(originalRequest);
          }
        }
      } catch {
        // Token refresh failed; proceed to reject error
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  firebaseLogin: (data) => api.post("/auth/firebase", data),
  me: () => api.get("/auth/me"),
  updateProfile: (data) => api.put("/auth/profile", data),
  uploadPhoto: (formData) =>
    api.post("/auth/profile/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deletePhoto: () => api.delete("/auth/profile/photo"),
};
export const busApi = {
  list: () => api.get("/buses"),
  get: (id) => api.get(`/buses/${id}`),
  location: (id) => api.get(`/buses/${id}/location`),
  create: (d) => api.post("/buses", d),
  update: (id, d) => api.put(`/buses/${id}`, d),
  assignDriver: (id, driverId) => api.put(`/buses/${id}/driver`, { driverId }),
  remove: (id) => api.delete(`/buses/${id}`),
};
export const routeApi = {
  list: () => api.get("/routes"),
  get: (id) => api.get(`/routes/${id}`),
  create: (d) => api.post("/routes", d),
  update: (id, d) => api.put(`/routes/${id}`, d),
  remove: (id) => api.delete(`/routes/${id}`),
};
export const stopApi = {
  list: (params) => api.get("/stops", { params }),
  create: (d) => api.post("/stops", d),
  update: (id, d) => api.put(`/stops/${id}`, d),
  reorder: (d) => api.put("/stops/reorder", d),
  remove: (id) => api.delete(`/stops/${id}`),
};
export const tripApi = {
  start: (d, config) => api.post("/trips/start", d, config),
  stop: (d, config) => api.post("/trips/stop", d, config),
  active: () => api.get("/trips/active"),
  get: (id) => api.get(`/trips/${id}`),
};
export const userApi = {
  list: (role) => api.get("/users", { params: role ? { role } : {} }),
  createDriver: (data) => api.post("/users/drivers", data),
  listDrivers: () => api.get("/users/drivers"),
  updateDriver: (id, data) => api.patch(`/users/drivers/${id}`, data),
  updateDriverStatus: (id, isActive) =>
    api.patch(`/users/drivers/${id}/status`, { isActive }),
  resetDriverPassword: (id, password) =>
    api.patch(`/users/drivers/${id}/password`, { password }),
  deleteDriver: (id) => api.delete(`/users/drivers/${id}`),
};
export default api;
