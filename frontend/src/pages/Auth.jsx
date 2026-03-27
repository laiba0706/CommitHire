import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../api";

export default function Auth() {
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ name: "", email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = mode === "login"
        ? await authAPI.login({ email: form.email, password: form.password })
        : await authAPI.signup(form);
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#090b0e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 400, background: "#111418", border: "1px solid #1e2530", borderRadius: 16, padding: 40 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: "#00e5a0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#090b0e", fontWeight: 800, fontSize: 16 }}>C</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>CommitHire</span>
        </div>

        <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
          {mode === "login" ? "Sign in to your recruiter dashboard" : "Start analyzing GitHub profiles"}
        </p>

        <form onSubmit={handle}>
          {mode === "signup" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>Full Name</label>
              <input
                type="text" placeholder="Your name" required
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email" placeholder="you@company.com" required
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>Password</label>
            <input
              type="password" placeholder="••••••••" required
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {error && <div style={{ background: "#2d1b1b", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button type="submit" disabled={loading}
            style={{ width: "100%", background: "#00e5a0", color: "#090b0e", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", marginTop: 20 }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            style={{ color: "#00e5a0", cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </p>
      </div>
    </div>
  );
}