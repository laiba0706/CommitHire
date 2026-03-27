import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI, candidatesAPI } from "../api";

const USP = ({ icon, title, desc }) => (
  <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: "20px 24px" }}>
    <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
    <div style={{ color: "#6b7280", fontSize: 13 }}>{desc}</div>
  </div>
);

const StatCard = ({ label, value, color }) => (
  <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: "20px 24px" }}>
    <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>{label}</div>
    <div style={{ color: color || "#fff", fontSize: 28, fontWeight: 700 }}>{value ?? "—"}</div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats]       = useState(null);
  const [activity, setActivity] = useState([]);
  const [username, setUsername] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    adminAPI.stats().then(r => setStats(r.data)).catch(() => {});
    adminAPI.activity().then(r => setActivity(r.data)).catch(() => {});
  }, []);

  const analyze = async () => {
    if (!username.trim()) return;
    setAnalyzing(true);
    try {
      await candidatesAPI.analyze(username.trim(), "");
      navigate("/candidates");
    } catch (err) {
      alert(err.response?.data?.detail || "Analysis failed");
    } finally { setAnalyzing(false); }
  };

  const dotColor = (action) => {
    if (action?.toLowerCase().includes("shortlist")) return "#00e5a0";
    if (action?.toLowerCase().includes("fork") || action?.toLowerCase().includes("error")) return "#ef4444";
    if (action?.toLowerCase().includes("job")) return "#3d7fff";
    return "#6b7280";
  };

  return (
    <div style={{ padding: "32px 40px" }}>
      <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>AI-powered GitHub profile analysis</p>

      {/* USP Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <USP icon="⑂" title="Fork Detection" desc="Identify forked repos vs original work" />
        <USP icon="◆" title="Commit Quality" desc="Analyze commit patterns & authenticity" />
        <USP icon="⊛" title="Skill Authenticity" desc="Verify claimed skills against code" />
        <USP icon="🔐" title="Code Quality & Security" desc="Detect vulnerabilities & best practices" />
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Candidates Analyzed" value={stats?.total_candidates} />
        <StatCard label="Shortlisted" value={stats?.shortlisted} color="#00e5a0" />
        <StatCard label="Fork Risks Detected" value={stats?.fork_risks_detected} color="#f5b731" />
        <StatCard label="Avg. Score" value={stats?.avg_score ? Math.round(stats.avg_score) : null} />
        <StatCard label="Active Jobs" value={stats?.total_jobs} color="#3d7fff" />
      </div>

      {/* Quick Analyze */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: "24px", marginBottom: 28 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Quick Analyze</div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="Enter GitHub username..."
            style={{ flex: 1, background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none" }}
          />
          <button onClick={analyze} disabled={analyzing}
            style={{ background: "#00e5a0", color: "#090b0e", border: "none", borderRadius: 8, padding: "12px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: "24px" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent Activity</div>
        {activity.length === 0 && <div style={{ color: "#6b7280", fontSize: 14 }}>No activity yet. Analyze a profile to get started.</div>}
        {activity.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < activity.length - 1 ? "1px solid #1e2530" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(a.action), flexShrink: 0 }} />
              <span style={{ color: "#9ca3af", fontSize: 14 }}>{a.action}</span>
              <span style={{ color: "#fff", fontSize: 14, fontFamily: "monospace" }}>{a.details}</span>
            </div>
            <span style={{ color: "#4b5563", fontSize: 12 }}>{new Date(a.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}