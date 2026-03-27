import { useState, useEffect } from "react";
import { candidatesAPI, adminAPI } from "../api";

const ScoreBar = ({ value, label }) => {
  const c = value >= 65 ? "#00e5a0" : value >= 40 ? "#f5b731" : "#ef4444";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{label}</span>
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 4, background: "#1e2530", borderRadius: 2 }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: c, borderRadius: 2 }} />
      </div>
    </div>
  );
};

export function Shortlist() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    candidatesAPI.list().then(r => {
      setCandidates(r.data.filter(c => c.shortlisted));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const parseLangs = (raw) => {
    try { return JSON.parse(raw || "[]"); } catch { return []; }
  };

  return (
    <div style={{ padding: "32px 40px" }}>
      <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Shortlist</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>{candidates.length} candidates shortlisted</p>

      {loading && <div style={{ color: "#6b7280" }}>Loading...</div>}
      {!loading && candidates.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: 14 }}>No candidates shortlisted yet. Star candidates from the Candidates page.</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {candidates.map(c => (
          <div key={c.github_username} style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <img src={c.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>@{c.github_username}</div>
              </div>
              <div style={{ background: "#00e5a020", color: "#00e5a0", fontWeight: 800, fontSize: 18, padding: "6px 12px", borderRadius: 8 }}>
                {Math.round(c.overall_score)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {parseLangs(c.top_languages).slice(0, 4).map(l => (
                <span key={l} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid #1e2530", color: "#9ca3af" }}>{l}</span>
              ))}
            </div>
            <ScoreBar value={c.originality_score} label="Originality" />
            <ScoreBar value={c.commit_quality_score} label="Commits" />
            <ScoreBar value={c.code_quality_score} label="Code Quality" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Admin() {
  const [stats, setStats]       = useState(null);
  const [activity, setActivity] = useState([]);
  const [rateLimit, setRateLimit] = useState(null);
  const [batch, setBatch]       = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult]   = useState("");

  useEffect(() => {
    adminAPI.stats().then(r => setStats(r.data)).catch(() => {});
    adminAPI.activity().then(r => setActivity(r.data)).catch(() => {});
    adminAPI.rateLimit().then(r => setRateLimit(r.data)).catch(() => {});
  }, []);

  const runBatch = async () => {
    const usernames = batch.split("\n").map(u => u.trim()).filter(Boolean);
    if (!usernames.length) return;
    setBatchRunning(true); setBatchResult("");
    try {
      const r = await adminAPI.batch(usernames);
      setBatchResult(`Done! Analyzed ${r.data.analyzed} profiles.`);
      setBatch("");
    } catch (err) {
      setBatchResult(err.response?.data?.detail || "Batch failed");
    } finally { setBatchRunning(false); }
  };

  const pct = rateLimit ? Math.round((rateLimit.used / rateLimit.limit) * 100) : 0;
  const barColor = pct > 80 ? "#ef4444" : pct > 60 ? "#f5b731" : "#00e5a0";

  return (
    <div style={{ padding: "32px 40px" }}>
      <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginBottom: 32 }}>Admin</h1>

      {/* Rate Limit */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ color: "#fff", fontWeight: 700 }}>API Rate Limit</div>
          <span style={{ color: barColor, fontSize: 14, fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
          {rateLimit ? `${rateLimit.used} / ${rateLimit.limit} requests used · Resets at ${rateLimit.reset}` : "Loading..."}
        </div>
        <div style={{ height: 8, background: "#1e2530", borderRadius: 4 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width .3s" }} />
        </div>
      </div>

      {/* Batch Analyze */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Batch Analyze</div>
        <textarea value={batch} onChange={e => setBatch(e.target.value)}
          placeholder={"Enter GitHub usernames, one per line...\ntorvalds\ngvanrossum\ndefunkt"}
          style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none", height: 120, resize: "vertical", boxSizing: "border-box", marginBottom: 12 }} />
        <button onClick={runBatch} disabled={batchRunning}
          style={{ background: "#00e5a0", color: "#090b0e", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {batchRunning ? "Running..." : "Run Batch Analysis"}
        </button>
        {batchResult && <div style={{ color: "#00e5a0", fontSize: 13, marginTop: 10 }}>{batchResult}</div>}
      </div>

      {/* DB Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Candidates", value: stats?.total_candidates },
          { label: "Total Jobs", value: stats?.total_jobs },
          { label: "Shortlisted", value: stats?.shortlisted },
          { label: "Avg Score", value: stats?.avg_score ? Math.round(stats.avg_score) : null },
        ].map(s => (
          <div key={s.label} style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: 20 }}>
            <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>{s.label}</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>{s.value ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Activity Log */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2530", color: "#fff", fontWeight: 700 }}>Activity Log</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2530" }}>
              {["Time", "Action", "Details", "Status"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280", fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activity.map((a, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2530" }}>
                <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: 12 }}>{new Date(a.created_at).toLocaleString()}</td>
                <td style={{ padding: "12px 16px", color: "#fff", fontSize: 13 }}>{a.action}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 13, fontFamily: "monospace" }}>{a.details}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.status === "success" ? "#00e5a0" : "#ef4444", display: "inline-block" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}