"""services/scorer.py — 4 scoring engines + career tier detection"""
import re, json, httpx
from typing import Optional
from datetime import datetime
from services.github import fetch_file_contents


def detect_career_tier(user: dict, repos: list, events: list) -> dict:
    account_age_days = 0
    if user.get("created_at"):
        try:
            created = datetime.fromisoformat(user["created_at"].replace("Z", "+00:00"))
            account_age_days = (datetime.now(created.tzinfo) - created).days
        except Exception:
            pass

    public_repos   = user.get("public_repos", 0)
    push_events    = [e for e in events if e.get("type") == "PushEvent"]
    original_repos = [r for r in repos if not r.get("fork", False)]

    if account_age_days < 180 and public_repos < 3:
        return {"tier":"new_account","is_early_career":True,"label":"New Account","score_multiplier":0.7,
                "note":f"Account is less than 6 months old with very few public repos. Score based on limited data.",
                "recruiter_tip":"Consider a short code review call. Limited GitHub history does not mean limited ability."}

    if account_age_days > 365 and public_repos < 4 and len(push_events) < 5:
        return {"tier":"private_heavy","is_early_career":False,"label":"Likely Private Repos","score_multiplier":1.0,
                "note":"Account is over a year old but has very little public activity. Likely works in private repositories.",
                "recruiter_tip":"Ask the candidate to provide a read-only GitHub Personal Access Token to unlock private repo analysis."}

    if len(original_repos) < 5 or len(push_events) < 10:
        return {"tier":"early_career","is_early_career":True,"label":"Early Career","score_multiplier":0.85,
                "note":f"Developer has {len(original_repos)} original repo(s) and {len(push_events)} recent push events. Scoring adjusted for early career.",
                "recruiter_tip":"Focus on the Code Quality score rather than overall score. Quality matters more than volume."}

    return {"tier":"standard","is_early_career":False,"label":"Standard","score_multiplier":1.0,
            "note":"Sufficient GitHub activity for full analysis.","recruiter_tip":None}


def score_originality(repos: list, career: dict) -> tuple:
    if not repos:
        return 50.0, []
    total      = len(repos)
    forked     = sum(1 for r in repos if r.get("fork", False))
    original   = [r for r in repos if not r.get("fork", False)]
    fork_ratio = forked / max(1, total)
    total_stars = sum(r.get("stargazers_count", 0) for r in original)
    avg_size    = sum(r.get("size", 0) for r in original) / max(1, len(original))
    base        = (1 - fork_ratio) * 60
    score       = base + min(25, total_stars * 2) + min(15, avg_size / 100)
    if career["tier"] == "early_career" and len(original) >= 1:
        score = max(score, 45.0)
    signals = []
    if fork_ratio < 0.2:
        signals.append(f"{len(original)}/{total} repos are original (non-forked)")
    elif fork_ratio > 0.6:
        signals.append(f"Warning: {forked}/{total} repos are forks — originality penalized")
    if total_stars > 5:
        signals.append(f"{total_stars} GitHub stars earned on original work")
    if not original:
        signals.append("Warning: All repositories are forks — no original work found")
    return round(min(98, max(10, score)) * career["score_multiplier"], 1), signals


def score_commits(events: list, career: dict) -> tuple:
    if not events:
        return 40.0 if career["is_early_career"] else 35.0, ["No recent public commit activity found"]
    push_events = [e for e in events if e.get("type") == "PushEvent"]
    if not push_events:
        return 35.0, ["No push events in recent GitHub activity"]
    total_commits, days_active, messages = 0, set(), []
    for e in push_events:
        commits = e.get("payload", {}).get("commits", [])
        total_commits += len(commits)
        try:
            dt = datetime.fromisoformat(e.get("created_at","").replace("Z","+00:00"))
            days_active.add(dt.date())
        except Exception:
            pass
        for c in commits:
            if c.get("message"):
                messages.append(c["message"])
    consistency  = min(100, len(days_active) * 3.5)
    good_msgs    = sum(1 for m in messages if len(m) > 15 and not m.lower().startswith(("update","fix","wip","test",".","init","add","merge")))
    msg_quality  = (good_msgs / max(1, len(messages))) * 100
    unique_repos = len(set(e.get("repo",{}).get("name","") for e in push_events))
    diversity    = min(100, unique_repos * 12)
    final = consistency * 0.35 + msg_quality * 0.35 + diversity * 0.30
    signals = []
    if len(days_active) > 10:
        signals.append(f"Active on {len(days_active)} distinct days — consistent contributor")
    if msg_quality > 50:
        signals.append("Descriptive commit messages (not just 'update' or 'fix')")
    if unique_repos > 4:
        signals.append(f"Contributes across {unique_repos} repositories")
    if total_commits > 20:
        signals.append(f"{total_commits} commits in recent activity window")
    return round(min(98, max(20, final)) * career["score_multiplier"], 1), signals


def score_authenticity(repos: list, career: dict) -> tuple:
    proven = {}
    for r in repos:
        if not r.get("fork") and r.get("language"):
            proven[r["language"]] = proven.get(r["language"], 0) + r.get("size", 1)
    if not proven:
        return (30.0 if career["is_early_career"] else 20.0), [], [], ["No language data found in original repositories"]
    total_size    = sum(proven.values()) or 1
    pct           = {k: round(v/total_size*100,1) for k,v in proven.items()}
    sorted_langs  = sorted(pct.items(), key=lambda x: x[1], reverse=True)
    top_langs     = [l[0] for l in sorted_langs[:5]]
    proven_skills = [l[0] for l in sorted_langs if l[1] > 5]
    diversity     = len(proven_skills)
    depth         = min(100, sum(v for _,v in sorted_langs[:3]))
    auth          = min(100, diversity * 18) * 0.4 + depth * 0.6
    if career["tier"] == "early_career" and diversity >= 1:
        auth = max(auth, 40.0)
    signals = [f"{lang}: {p}% of codebase (proven from actual code)" for lang,p in sorted_langs[:4]]
    if diversity > 3:
        signals.append(f"Polyglot developer — {diversity} languages with meaningful usage")
    return round(min(98, max(15, auth)) * career["score_multiplier"], 1), top_langs, proven_skills, signals


SECURITY_PATTERNS = [
    (r'(password|passwd|secret|api_key|apikey|token)\s*=\s*["\'][^"\']{4,}["\']', "Hardcoded credentials/secrets", 15),
    (r'\beval\s*\(',                                                                "Dangerous eval() usage",         12),
    (r'(?i)SELECT.+FROM.+\+|"SELECT.+"\s*\+',                                      "Potential SQL injection",         12),
    (r'subprocess\.call\(.+shell\s*=\s*True',                                      "Shell injection risk",            10),
    (r'except\s*:\s*\n\s*pass|except\s+Exception\s*:\s*\n\s*pass',                "Silent exception swallowing",      8),
    (r'^from\s+\S+\s+import\s+\*',                                                 "Wildcard imports",                 4),
    (r'#\s*(TODO|FIXME|HACK|XXX|BUG)\b',                                           "Unresolved TODO/FIXME markers",    3),
]
QUALITY_PATTERNS = [
    (r'def test_|class Test|@pytest|import unittest', "Test code present",                   15),
    (r'"""[\s\S]{10,}"""|\'\'\'[\s\S]{10,}\'\'\'',   "Docstrings / documentation written",   10),
    (r'#\s.{10,}',                                    "Meaningful inline comments",            8),
    (r'logging\.|logger\.',                           "Uses logging",                          8),
    (r'raise\s+\w+Error|raise\s+\w+Exception',        "Explicit error raising",                6),
    (r'with\s+open\(',                                "Context managers for file handling",     5),
    (r'from typing import|:\s*(int|str|bool|List)',   "Type hints used",                       8),
]

async def score_code_quality(repos, token, db, career) -> tuple:
    original_repos = [r for r in repos if not r.get("fork") and r.get("size",0) > 0]
    if not original_repos:
        return 50.0, ["No original repositories to scan"], {}
    async with httpx.AsyncClient() as client:
        all_code, meta = await fetch_file_contents(client, original_repos, token, db)
    if not all_code:
        return 55.0, ["Could not fetch code content — try adding a GitHub token for private repos"], {"files_analyzed": 0}

    combined    = "\n".join(all_code)
    lines       = combined.split("\n")
    total_lines = len(lines)
    non_empty   = [l for l in lines if l.strip()]

    sec_issues, sec_penalty = [], 0
    for pattern, desc, weight in SECURITY_PATTERNS:
        matches = re.findall(pattern, combined, re.IGNORECASE|re.MULTILINE)
        if matches:
            sec_issues.append(f"Security issue: {desc} ({len(matches)} occurrence{'s' if len(matches)>1 else ''})")
            sec_penalty += weight

    quality_found, quality_bonus = [], 0
    for pattern, desc, weight in QUALITY_PATTERNS:
        if re.search(pattern, combined, re.IGNORECASE|re.MULTILINE):
            quality_found.append(f"Good practice: {desc}")
            quality_bonus += weight

    avg_line_len   = sum(len(l) for l in non_empty) / max(1, len(non_empty))
    long_functions = len(re.findall(r'def .+:\n(?:.*\n){30,}', combined))
    comment_ratio  = len(re.findall(r'^\s*#', combined, re.MULTILINE)) / max(1, total_lines)

    style_signals = []
    if avg_line_len < 80:
        style_signals.append(f"Clean line lengths (avg {round(avg_line_len)} chars)")
    elif avg_line_len > 120:
        style_signals.append(f"Warning: Long lines detected (avg {round(avg_line_len)} chars)")
    if long_functions > 3:
        style_signals.append(f"Warning: {long_functions} functions exceed 30 lines — low modularity")
    elif long_functions == 0:
        style_signals.append("Modular code — no oversized functions detected")
    if comment_ratio > 0.1:
        style_signals.append(f"Well-commented ({round(comment_ratio*100)}% comment lines)")
    elif comment_ratio < 0.02:
        style_signals.append("Warning: Very few comments — documentation habit lacking")

    if career["is_early_career"] and any("Test code" in s for s in quality_found):
        quality_bonus += 10

    final = max(10, min(98, 65 + quality_bonus - sec_penalty))
    all_signals = []
    if sec_issues:
        all_signals.extend(sec_issues)
    else:
        all_signals.append(f"No critical security anti-patterns found across {meta['files_analyzed']} files")
    all_signals.extend(quality_found)
    all_signals.extend(style_signals)

    fingerprint = {
        **meta,
        "total_lines_scanned":   total_lines,
        "security_issues_count": len(sec_issues),
        "quality_signals_count": len(quality_found),
        "avg_line_length":       round(avg_line_len, 1),
        "comment_ratio_pct":     round(comment_ratio*100, 1),
        "has_tests":             bool(re.search(r'def test_|class Test|@pytest', combined)),
        "has_type_hints":        bool(re.search(r'from typing import|:\s*(int|str|bool)', combined)),
        "has_logging":           bool(re.search(r'logging\.|logger\.', combined)),
        "long_functions":        long_functions,
        "security_penalty":      sec_penalty,
        "quality_bonus":         quality_bonus,
    }
    return round(final * career["score_multiplier"], 1), all_signals, fingerprint


def compute_overall(orig, commit, auth, cq):
    return round(orig * 0.28 + commit * 0.22 + auth * 0.25 + cq * 0.25, 1)


def match_to_jobs(candidate: dict, jobs: list) -> list:
    proven = [s.lower() for s in json.loads(candidate.get("proven_skills") or "[]")]
    matches = []
    for job in jobs:
        required = [s.lower() for s in json.loads(job.get("required_skills") or "[]")]
        matched  = [s for s in required if any(s in p or p in s for p in proven)]
        pct      = len(matched) / max(1, len(required))
        bonus    = {"junior":10,"mid":15,"senior":20}.get(job.get("experience_level","mid"),10) if candidate.get("overall_score",0) > 40 else 0
        score    = round(min(99, pct*70 + bonus + candidate.get("overall_score",0)*0.2), 1)
        reasons  = [f"Proven skill: {s}" for s in matched[:3]]
        if score > 60:
            reasons.append(f"Overall score: {candidate.get('overall_score')}")
        matches.append({"job_id": job["id"], "match_score": score, "match_reasons": json.dumps(reasons)})
    return sorted(matches, key=lambda x: x["match_score"], reverse=True)