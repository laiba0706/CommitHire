
import { useState, useEffect } from "react";
import { jobsAPI } from "../api";

export default function Jobs() {
  const [jobs, setJobs]           = useState([]);
  const [matches, setMatches]     = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ title: "", company: "CommitHire", team: "", description: "", required_skills: "", experience_level: "mid", location: "" });
  const [loading, setLoading]     = useState(true);

  const load = () => {
    setLoading(true);
    jobsAPI.list().then(r => setJobs(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectJob = async (job) => {
    setSelectedJob(job);
    try {
      const r = await jobsAPI.matches(job.id);
      setMatches(r.data);
    } catch { setMatches([]); }
  };

  const createJob = async (e) => {
    e.preventDefault();
    try {
      await jobsAPI.create({
        ...form,
        required_skills: form.required_skills.split(",").map(s => s.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm({ title: "", company: "CommitHire", team: "", description: "", required_skills: "", experience_level: "mid", location: "" });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create job");
    }
  };

  const parseSkills = (raw) => {
    try { return JSON.parse(raw || "[]"); } catch { return raw || []; }
  };

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800 }}>Jobs</h1>
        <button onClick={() => setShowForm(true)}
          style={{ background: "#00e5a0", color: "#090b0e", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + New Job
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedJob ? "1fr 1fr" : "1fr", gap: 24 }}>
        {/* Jobs Table */}
        <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2530" }}>
                {["Position", "Team", "Skills", "Location", "Status", "Matches"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "#6b7280", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>Loading...</td></tr>}
              {jobs.map(j => (
                <tr key={j.id} onClick={() => selectJob(j)}
                  style={{ borderBottom: "1px solid #1e2530", cursor: "pointer", background: selectedJob?.id === j.id ? "#181d24" : "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#181d24"}
                  onMouseLeave={e => e.currentTarget.style.background = selectedJob?.id === j.id ? "#181d24" : "transparent"}>
                  <td style={{ padding: "14px 16px", color: "#fff", fontWeight: 600 }}>{j.title}</td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af" }}>{j.team}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {parseSkills(j.required_skills).slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid #00e5a050", color: "#00e5a0" }}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13 }}>📍 {j.location}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: j.status === "active" ? "#00e5a020" : "#1e2530", color: j.status === "active" ? "#00e5a0" : "#6b7280", fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                      {j.status === "active" ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#fff", fontWeight: 700 }}>{j.match_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Matches Panel */}
        {selectedJob && (
          <div style={{ background: "#111418", border: "1px solid #1e2530", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{selectedJob.title}</div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Matched candidates</div>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            {matches.length === 0 && <div style={{ color: "#6b7280", fontSize: 14 }}>No matches yet. Analyze more candidates.</div>}
            {matches.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < matches.length - 1 ? "1px solid #1e2530" : "none" }}>
                <img src={m.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>@{m.github_username}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#00e5a0", fontWeight: 700, fontSize: 16 }}>{Math.round(m.match_score)}%</div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>match</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "flex-end", zIndex: 50 }}
          onClick={() => setShowForm(false)}>
          <div style={{ background: "#111418", border: "1px solid #1e2530", width: 420, height: "100vh", padding: 32, overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>Create Job</div>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={createJob}>
              {[
                { label: "Job Title", key: "title", placeholder: "e.g. Senior Frontend Engineer" },
                { label: "Team", key: "team", placeholder: "e.g. Platform" },
                { label: "Location", key: "location", placeholder: "e.g. Remote" },
                { label: "Required Skills (comma-separated)", key: "required_skills", placeholder: "React, TypeScript, Node.js" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} required={f.key === "title"}
                    style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>Experience Level</label>
                <select value={form.experience_level} onChange={e => setForm({ ...form, experience_level: e.target.value })}
                  style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }}>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Job description..."
                  style={{ width: "100%", background: "#181d24", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", height: 100, resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <button type="submit"
                style={{ width: "100%", background: "#00e5a0", color: "#090b0e", border: "none", borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Create Job
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}