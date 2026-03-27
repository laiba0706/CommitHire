"""routes/candidates.py"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import json
from database import get_db, dict_cursor
from services.github import fetch_profile
from services.scorer import (
    detect_career_tier, score_originality, score_commits,
    score_authenticity, score_code_quality, compute_overall, match_to_jobs
)
from routes.auth import get_current_user

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


class AnalyzeRequest(BaseModel):
    token: Optional[str] = None


@router.post("/{username}/analyze")
async def analyze(username: str, req: Optional[AnalyzeRequest] = None, current_user: dict = Depends(get_current_user)):
    token = req.token if req else None
    db    = get_db()

    # Return cached if already analyzed (no token needed to re-hit API)
    cur = dict_cursor(db)
    cur.execute("SELECT * FROM candidates WHERE github_username = %s", (username,))
    existing = cur.fetchone()
    cur.close()
    if existing and existing["status"] == "analyzed" and not token:
        db.close()
        return dict(existing)

    profile = await fetch_profile(username, token, db)
    user, repos, events = profile["user"], profile["repos"], profile["events"]

    career = detect_career_tier(user, repos, events)
    orig_score,   orig_signals                           = score_originality(repos, career)
    commit_score, commit_signals                         = score_commits(events, career)
    auth_score,   top_langs, proven_skills, auth_signals = score_authenticity(repos, career)
    cq_score,     cq_signals, cq_fp                     = await score_code_quality(repos, token, db, career)
    overall = compute_overall(orig_score, commit_score, auth_score, cq_score)

    from datetime import datetime
    account_age_days = 0
    if user.get("created_at"):
        try:
            created = datetime.fromisoformat(user["created_at"].replace("Z","+00:00"))
            account_age_days = (datetime.now(created.tzinfo) - created).days
        except Exception:
            pass

    forked_count = sum(1 for r in repos if r.get("fork", False))
    analysis = {
        "commit_signals": commit_signals, "originality_signals": orig_signals,
        "auth_signals": auth_signals, "code_quality_signals": cq_signals,
        "code_quality_fingerprint": cq_fp, "career": career,
        "total_repos": len(repos), "original_repos": len(repos)-forked_count,
        "forked_repos": forked_count, "account_age_days": account_age_days,
        "total_stars": sum(r.get("stargazers_count",0) for r in repos if not r.get("fork")),
    }

    cur = db.cursor()
    if existing:
        cur.execute("""UPDATE candidates SET name=%s,avatar_url=%s,bio=%s,location=%s,
            followers=%s,public_repos=%s,overall_score=%s,authenticity_score=%s,
            commit_quality_score=%s,originality_score=%s,code_quality_score=%s,
            top_languages=%s,proven_skills=%s,analysis_data=%s,status=%s,
            has_private_access=%s,is_early_career=%s,career_tier=%s WHERE github_username=%s""",
            (user.get("name") or username, user.get("avatar_url",""), user.get("bio",""),
             user.get("location",""), user.get("followers",0), user.get("public_repos",0),
             overall, auth_score, commit_score, orig_score, cq_score,
             json.dumps(top_langs), json.dumps(proven_skills), json.dumps(analysis),
             "analyzed", bool(token), career["is_early_career"], career["tier"], username))
    else:
        cur.execute("""INSERT INTO candidates (github_username,name,avatar_url,bio,location,
            followers,public_repos,overall_score,authenticity_score,commit_quality_score,
            originality_score,code_quality_score,top_languages,proven_skills,analysis_data,
            status,has_private_access,is_early_career,career_tier) VALUES
            (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (username, user.get("name") or username, user.get("avatar_url",""),
             user.get("bio",""), user.get("location",""),
             user.get("followers",0), user.get("public_repos",0),
             overall, auth_score, commit_score, orig_score, cq_score,
             json.dumps(top_langs), json.dumps(proven_skills), json.dumps(analysis),
             "analyzed", bool(token), career["is_early_career"], career["tier"]))

    cur.execute("INSERT INTO activity_log (action,details,status) VALUES (%s,%s,%s)",
                ("Analyzed profile", f"@{username} — score: {overall}{' [+private]' if token else ''}", "success"))
    db.commit()

    cur2 = dict_cursor(db)
    cur2.execute("SELECT * FROM candidates WHERE github_username = %s", (username,))
    saved = dict(cur2.fetchone())
    cur2.execute("SELECT * FROM jobs WHERE status = 'active'")
    jobs = [dict(j) for j in cur2.fetchall()]
    cur2.close()

    for m in match_to_jobs(saved, jobs):
        cur.execute("""INSERT INTO job_matches (job_id,candidate_id,match_score,match_reasons)
            VALUES (%s,%s,%s,%s) ON CONFLICT (job_id,candidate_id)
            DO UPDATE SET match_score=EXCLUDED.match_score,match_reasons=EXCLUDED.match_reasons""",
            (m["job_id"], saved["id"], m["match_score"], m["match_reasons"]))
    db.commit()
    cur.close(); db.close()
    return saved


@router.get("")
def list_candidates(status: Optional[str]=None, shortlisted: Optional[bool]=None, current_user: dict=Depends(get_current_user)):
    db, cur = get_db(), None
    cur = dict_cursor(db)
    q, params = "SELECT * FROM candidates WHERE 1=1", []
    if status:
        q += " AND status=%s"; params.append(status)
    if shortlisted is not None:
        q += " AND shortlisted=%s"; params.append(shortlisted)
    cur.execute(q + " ORDER BY overall_score DESC", params)
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); db.close()
    return rows


@router.get("/{username}")
def get_candidate(username: str, current_user: dict=Depends(get_current_user)):
    db = get_db(); cur = dict_cursor(db)
    cur.execute("SELECT * FROM candidates WHERE github_username=%s", (username,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate = dict(row)
    cur.execute("""SELECT jm.*,j.title,j.company FROM job_matches jm
        JOIN jobs j ON jm.job_id=j.id WHERE jm.candidate_id=%s ORDER BY jm.match_score DESC""",
        (candidate["id"],))
    candidate["job_matches"] = [dict(m) for m in cur.fetchall()]
    cur.close(); db.close()
    return candidate


@router.patch("/{username}/shortlist")
def toggle_shortlist(username: str, current_user: dict=Depends(get_current_user)):
    db = get_db(); cur = db.cursor()
    cur.execute("SELECT shortlisted FROM candidates WHERE github_username=%s", (username,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    new_val = not row[0]
    cur.execute("UPDATE candidates SET shortlisted=%s WHERE github_username=%s", (new_val, username))
    cur.execute("INSERT INTO activity_log (action,details,status) VALUES (%s,%s,%s)",
                ("Shortlisted" if new_val else "Removed from shortlist", username, "success"))
    db.commit(); cur.close(); db.close()
    return {"shortlisted": new_val}


@router.delete("/{username}")
def delete_candidate(username: str, current_user: dict=Depends(get_current_user)):
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM job_matches WHERE candidate_id=(SELECT id FROM candidates WHERE github_username=%s)", (username,))
    cur.execute("DELETE FROM candidates WHERE github_username=%s", (username,))
    db.commit(); cur.close(); db.close()
    return {"deleted": True}


@router.get("/{username}/explain")
def explain(username: str, current_user: dict=Depends(get_current_user)):
    db = get_db(); cur = dict_cursor(db)
    cur.execute("SELECT * FROM candidates WHERE github_username=%s", (username,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    c = dict(row)
    analysis = json.loads(c.get("analysis_data") or "{}")
    skills = json.loads(c.get("proven_skills") or "[]")
    langs  = json.loads(c.get("top_languages") or "[]")
    cq_fp  = analysis.get("code_quality_fingerprint", {})
    career = analysis.get("career", {})

    def verdict(s, label):
        if s >= 70: return f"{label}: Strong ({s})"
        if s >= 45: return f"{label}: Moderate ({s})"
        return f"{label}: Weak ({s})"

    cur.close(); db.close()
    return {
        "candidate": username, "generated_at": str(__import__("datetime").datetime.now().isoformat()),
        "overall_score": c["overall_score"], "career_tier": c.get("career_tier","standard"),
        "is_early_career": c.get("is_early_career",False),
        "career_note": career.get("note",""), "recruiter_tip": career.get("recruiter_tip",""),
        "decision_basis": "Score derived from GitHub activity. No resume or self-reported data used.",
        "private_repos_included": bool(c.get("has_private_access")),
        "score_breakdown": {
            "originality":        {"score":c["originality_score"],     "weight":"28%","verdict":verdict(c["originality_score"],"Originality"),        "signals":analysis.get("originality_signals",[])},
            "commit_quality":     {"score":c["commit_quality_score"],  "weight":"22%","verdict":verdict(c["commit_quality_score"],"Commit Quality"),   "signals":analysis.get("commit_signals",[])},
            "skill_authenticity": {"score":c["authenticity_score"],    "weight":"25%","verdict":verdict(c["authenticity_score"],"Skill Authenticity"), "signals":analysis.get("auth_signals",[])},
            "code_quality":       {"score":c["code_quality_score"],    "weight":"25%","verdict":verdict(c["code_quality_score"],"Code Quality"),       "signals":analysis.get("code_quality_signals",[]), "fingerprint":cq_fp},
        },
        "proven_skills": skills, "proven_languages": langs,
        "what_was_not_used": ["Resume or CV","Self-reported skills","Follower count","University degree"],
        "limitations": ["Public GitHub only unless PAT provided","New devs may score lower — limited data","Code scan samples files (max 5 per repo, 4 repos)","Score is advisory — human review required"],
        "candidate_rights": "Candidate may request this report. Score is advisory only. May be disputed.",
        "compliance_note": "Generated per EU AI Act Article 86."
    }