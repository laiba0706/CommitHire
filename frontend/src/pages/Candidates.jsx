import { useState, useEffect } from "react";
import { candidatesAPI } from "../api";

const ScoreBar = ({ value, color }) => {
  const c = color || (value >= 65 ? "#00e5a0" : value >= 40 ? "#f5b731" : "#ef4444");
  return (
    <div style={{ width: 80, height: 4, background: "#1e2530", borderRadius: 2 }}>
      <div style={{ width: `${Math.min(value || 0, 100)}%`, height: "100%", background: c, borderRadius: 2 }} />
    </div>
  );
};

const Badge = ({ label, color }) => (
  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, border: `1px solid ${color}`, color, fontWeight: 600, marginRight: 4 }}>{label}</span>
);

const ScoreBadge = ({ score }) => {
  const bg = score >= 65 ? "#00e5a020" : score >= 40 ? "#f5b73120" : "#ef444420";
  const c  = score >= 65 ? "#00e5a0"   : score >= 40 ? "#f5b731"   : "#ef4444";
  return <span style={{ background: bg, color: c, fontWeight: 700, fontSize: 14, padding: "4px 10px", borderRadius: 6 }}>{Math.round(score)}</span>;
};

const FILTERS = ["All", "High Score", "Fork Risk", "Security Risk", "Early Career", "Shortlisted"];

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [filter, setFilter]         = useState("All");
  const [username, setUsername]     = useState("");
  const [token, setToken]           = useState("");
  const [showToken, setShowToken]   = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [explainData, setExplainData] = useState(null);

  const load = () => {
    setLoading(true);
    candidatesAPI.list().then(r => setCandidates(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const analyze = async () => {
    if (!username.trim()) return;
    setAnalyzing(true);
    try {
      await candidatesAPI.analyze(username.trim(), token || "");
      setUsername(""); setToken("");
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Analysis failed");
    } finally { setAnalyzing(false); }
  };

  const toggleShortlist = async (username) => {
    await candidatesAPI.shortlist(username);
    load();
  };

  const deleteCand = async (username) => {
    if (!confirm(`Remove ${username}?`)) return;
    await candidatesAPI.delete(username);
    load();
  };

  const openExplain = async (username) => {
    try {
      const r = await candidatesAPI.explain(username);
      setExplainData(r.data);
    } catch {}
  };

  const filtered = candidates.filter(c => {
    if (filter === "High Score")    return c.overall_score >= 65;
    if (filter === "Fork Risk")     return c.originality_score < 40;
    if (filter === "Security Risk") return (c.code_quality_score || 0) < 40;
    if (filter === "Early Career")  return c.is_early_career;
    if (filter === "Shortlisted")   return c.shortlisted;
    return true;
  });

  const parseLangs = (raw) => {
    try { return JSON.parse(raw || "[]"); } catch { return []; }
  };

  return (
    <div style={{ padding: "32px 40px" }}>
      <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginBottom: 24 }}>Candidates</h1>

      {/* Analyze Bar */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="GitHub username to analyze..."
            style={{ flex: 1, background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }} />
          {showToken && (
            <input value={token} onChange={e => setToken(e.target.value)}
              placeholder="GitHub token (optional)"
              type="password"
              style={{ width: 220, background: "#181d24", border: "1px solid #3d7fff", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }} />
          )}
          <button onClick={() => setShowToken(!showToken)}
            style={{ background: showToken ? "#3d7fff20" : "transparent", border: "1px solid #3d7fff", borderRadius: 8, padding: "10px 14px", color: "#3d7fff", fontSize: 13, cursor: "pointer" }}>
            🔒 {showToken ? "Hide Token" : "Add Token"}
          </button>
          <button onClick={analyze} disabled={analyzing}
            style={{ background: "#00e5a0", color: "#090b0e", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? "#00e5a0" : "#111418", color: filter === f ? "#090b0e" : "#9ca3af", border: "1px solid " + (filter === f ? "#00e5a0" : "#1e2530"), borderRadius: 20, padding: "6px 16px", fontSize: 13, cursor: "pointer", fontWeight: filter === f ? 700 : 400 }}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2530" }}>
              {["Developer", "Score", "Originality", "Commits", "Skills", "Code Quality", "Languages", "Actions"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "#6b7280", fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>No candidates yet. Analyze a GitHub username above.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.github_username} onClick={() => setSelected(c)}
                style={{ borderBottom: "1px solid #1e2530", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#181d24"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={c.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{c.name || c.github_username}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>@{c.github_username}</div>
                      {c.is_early_career && <Badge label="Early Career" color="#f5b731" />}
                      {c.career_tier === "new_account" && <Badge label="New Account" color="#ef4444" />}
                      {c.has_private_access && <Badge label="+Private" color="#3d7fff" />}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}><ScoreBadge score={c.overall_score} /></td>
                <td style={{ padding: "14px 16px" }}><ScoreBar value={c.originality_score} /></td>
                <td style={{ padding: "14px 16px" }}><ScoreBar value={c.commit_quality_score} /></td>
                <td style={{ padding: "14px 16px" }}><ScoreBar value={c.authenticity_score} /></td>
                <td style={{ padding: "14px 16px" }}><ScoreBar value={c.code_quality_score} /></td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {parseLangs(c.top_languages).slice(0, 3).map(l => (
                      <span key={l} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid #1e2530", color: "#9ca3af" }}>{l}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleShortlist(c.github_username)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: c.shortlisted ? "#f5b731" : "#4b5563" }}>★</button>
                    <button onClick={() => deleteCand(c.github_username)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#ef4444" }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => { setSelected(null); setExplainData(null); }}>
          <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 16, width: 680, maxHeight: "85vh", overflowY: "auto", padding: 32 }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <img src={selected.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{selected.name}</div>
                <div style={{ color: "#6b7280", fontSize: 14 }}>@{selected.github_username}</div>
                <div style={{ color: "#9ca3af", fontSize: 13 }}>{selected.location} · {selected.followers?.toLocaleString()} followers</div>
              </div>
              <button onClick={() => { setSelected(null); setExplainData(null); }}
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            {/* 4 Score Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Overall", value: selected.overall_score, color: "#00e5a0" },
                { label: "Originality", value: selected.originality_score, color: "#3d7fff" },
                { label: "Commits", value: selected.commit_quality_score, color: "#f5b731" },
                { label: "Code Quality", value: selected.code_quality_score, color: "#a78bfa" },
              ].map(s => (
                <div key={s.label} style={{ background: "#181d24", borderRadius: 10, padding: 16, textAlign: "center" }}>
                  <div style={{ color: s.color, fontSize: 28, fontWeight: 800 }}>{Math.round(s.value)}</div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Analysis Signals */}
            {(() => {
              try {
                const data = JSON.parse(selected.analysis_data || "{}");
                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Analysis Signals</div>
                    {[
                      { title: "Originality", signals: data.originality_signals, color: "#3d7fff" },
                      { title: "Commit Quality", signals: data.commit_signals, color: "#f5b731" },
                      { title: "Skill Authenticity", signals: data.auth_signals, color: "#00e5a0" },
                      { title: "Code Quality", signals: data.code_quality_signals, color: "#a78bfa" },
                    ].map(sec => sec.signals?.length > 0 && (
                      <div key={sec.title} style={{ marginBottom: 12 }}>
                        <div style={{ color: sec.color, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{sec.title}</div>
                        {sec.signals.map((s, i) => (
                          <div key={i} style={{ color: "#9ca3af", fontSize: 13, padding: "3px 0 3px 12px", borderLeft: `2px solid ${sec.color}30`, marginBottom: 3 }}>{s}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}

            {/* Explain Button */}
            <button onClick={() => openExplain(selected.github_username)}
              style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: 12, color: "#00e5a0", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: explainData ? 16 : 0 }}>
              ⚖ View EU AI Act Explainability Report
            </button>

            {/* Explain Report */}
            {explainData && (
              <div style={{ background: "#181d24", border: "1px solid #1e2530", borderRadius: 10, padding: 20, marginTop: 16 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Explainability Report</div>
                {Object.entries(explainData.score_breakdown || {}).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#9ca3af", fontSize: 13, textTransform: "capitalize" }}>{key.replace("_", " ")} ({val.weight})</span>
                      <span style={{ color: "#fff", fontWeight: 700 }}>{Math.round(val.score)}</span>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>{val.verdict}</div>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #1e2530", paddingTop: 12, marginTop: 12 }}>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>{explainData.compliance_note}</div>
                  <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>{explainData.candidate_rights}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}