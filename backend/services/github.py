"""services/github.py — GitHub API with caching + rate limit handling"""
import httpx, asyncio, json, os
from datetime import datetime
from typing import Optional
from fastapi import HTTPException

CACHE_TTL_HOURS = int(os.getenv("CACHE_TTL_HOURS", "2"))

async def gh_fetch(client: httpx.AsyncClient, url: str, token: Optional[str] = None, db=None) -> Optional[dict]:
    cache_key = f"{token or 'public'}:{url}"

    if db:
        try:
            from database import dict_cursor
            cur = dict_cursor(db)
            cur.execute("SELECT data, cached_at FROM api_cache WHERE cache_key = %s", (cache_key,))
            row = cur.fetchone()
            cur.close()
            if row:
                age_h = (datetime.now() - row["cached_at"]).total_seconds() / 3600
                if age_h < CACHE_TTL_HOURS:
                    return json.loads(row["data"])
        except Exception:
            pass

    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        r = await client.get(url, headers=headers, timeout=12)
    except Exception as e:
        return None

    remaining = int(r.headers.get("X-RateLimit-Remaining", 999))
    reset_ts  = int(r.headers.get("X-RateLimit-Reset", 0))
    reset_str = datetime.fromtimestamp(reset_ts).strftime("%H:%M") if reset_ts else "soon"

    if r.status_code == 403 and remaining == 0:
        raise HTTPException(
            status_code=429,
            detail=f"GitHub API rate limit reached. Resets at {reset_str}. Add a GitHub token in the analyze form for 5,000 req/hr."
        )

    if r.status_code != 200:
        return None

    data = r.json()

    if db:
        try:
            cur = db.cursor()
            cur.execute(
                "INSERT INTO api_cache (cache_key, data, cached_at) VALUES (%s,%s,NOW()) ON CONFLICT (cache_key) DO UPDATE SET data=EXCLUDED.data, cached_at=NOW()",
                (cache_key, json.dumps(data))
            )
            db.commit()
            cur.close()
        except Exception:
            pass

    return data


async def fetch_profile(username: str, token: Optional[str], db) -> dict:
    base = f"https://api.github.com/users/{username}"
    async with httpx.AsyncClient() as client:
        user, repos, events = await asyncio.gather(
            gh_fetch(client, base, token, db),
            gh_fetch(client, f"{base}/repos?per_page=100&sort=updated", token, db),
            gh_fetch(client, f"{base}/events?per_page=100", token, db),
        )
    if not user:
        raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found.")
    return {"user": user, "repos": repos or [], "events": events or []}


async def fetch_file_contents(client, repos, token, db, max_repos=4, max_files=5):
    CODE_EXTS = {".py",".js",".ts",".java",".go",".rb",".cpp",".c",".cs",".php",".rs",".kt"}
    all_code, files_analyzed, repos_analyzed = [], 0, []

    for repo in repos[:max_repos]:
        full_name = repo.get("full_name","")
        if not full_name or repo.get("fork"):
            continue
        tree = await gh_fetch(client, f"https://api.github.com/repos/{full_name}/git/trees/HEAD?recursive=1", token, db)
        if not tree or "tree" not in tree:
            continue
        code_files = [f for f in tree["tree"] if f.get("type")=="blob"
                      and any(f.get("path","").endswith(e) for e in CODE_EXTS)
                      and f.get("size",0) < 50000][:max_files]
        for fi in code_files:
            content_data = await gh_fetch(client, f"https://api.github.com/repos/{full_name}/contents/{fi['path']}", token, db)
            if not content_data or "content" not in content_data:
                continue
            try:
                import base64 as b64
                raw = b64.b64decode(content_data["content"]).decode("utf-8", errors="ignore")
                all_code.append(raw)
                files_analyzed += 1
            except Exception:
                continue
        if code_files:
            repos_analyzed.append(repo.get("name",""))

    return all_code, {"files_analyzed": files_analyzed, "repos_analyzed": repos_analyzed}


def get_rate_limit_status(token: Optional[str] = None) -> dict:
    import urllib.request
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    try:
        req = urllib.request.Request("https://api.github.com/rate_limit", headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            core = data.get("resources", {}).get("core", {})
            return {
                "limit":     core.get("limit", 60),
                "remaining": core.get("remaining", 0),
                "used":      core.get("used", 0),
                "reset":     datetime.fromtimestamp(core.get("reset", 0)).strftime("%H:%M"),
                "has_token": bool(token),
            }
    except Exception:
        return {"limit": 60, "remaining": "unknown", "reset": "unknown", "has_token": False}