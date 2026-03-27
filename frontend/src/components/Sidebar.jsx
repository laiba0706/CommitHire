import { NavLink, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/dashboard", icon: "⊞", label: "Dashboard" },
  { to: "/candidates", icon: "👤", label: "Candidates" },
  { to: "/jobs",       icon: "💼", label: "Jobs" },
  { to: "/shortlist",  icon: "★",  label: "Shortlist" },
  { to: "/admin",      icon: "⚙",  label: "Admin" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div style={{ width: 220, minHeight: "100vh", background: "#0d1117", borderRight: "1px solid #1e2530", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px", borderBottom: "1px solid #1e2530" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#00e5a0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#090b0e", fontWeight: 800, fontSize: 16 }}>C</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>CommitHire</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              borderRadius: 8, marginBottom: 4, textDecoration: "none", fontSize: 14, fontWeight: 500,
              background: isActive ? "#00e5a015" : "transparent",
              color: isActive ? "#00e5a0" : "#9ca3af",
              transition: "all .15s",
            })}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid #1e2530" }}>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{user.name || "Recruiter"}</div>
        <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 10 }}>{user.email}</div>
        <button onClick={logout}
          style={{ background: "none", border: "1px solid #1e2530", borderRadius: 6, padding: "6px 12px", color: "#6b7280", fontSize: 12, cursor: "pointer", width: "100%" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}