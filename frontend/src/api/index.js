import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  signup: (data) => api.post("/auth/signup", data),
  login:  (data) => api.post("/auth/login", data),
  me:     ()     => api.get("/auth/me"),
};

export const candidatesAPI = {
  list:      (params) => api.get("/candidates", { params }),
  analyze:   (username, token) => api.post(`/candidates/${username}/analyze`, { token: token || "" }),
  get:       (username) => api.get(`/candidates/${username}`),
  shortlist: (username) => api.patch(`/candidates/${username}/shortlist`),
  delete:    (username) => api.delete(`/candidates/${username}`),
  explain:   (username) => api.get(`/candidates/${username}/explain`),
};

export const jobsAPI = {
  list:    ()     => api.get("/jobs"),
  create:  (data) => api.post("/jobs", data),
  delete:  (id)   => api.delete(`/jobs/${id}`),
  matches: (id)   => api.get(`/jobs/${id}/matches`),
};

export const adminAPI = {
  stats:    () => api.get("/admin/stats"),
  activity: () => api.get("/admin/activity"),
  rateLimit:() => api.get("/admin/rate-limit"),
  batch:    (usernames) => api.post("/admin/batch-analyze", { usernames, token: "" }),
  clearCache:() => api.delete("/admin/cache"),
};