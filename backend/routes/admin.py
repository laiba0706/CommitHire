"""routes/admin.py"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import get_db, dict_cursor
from services.github import get_rate_limit_status
from routes.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/stats")
def stats(current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = db.cursor()
    def q(sql): cur.execute(sql); return cur.fetchone()[0]
    result = {
        "total_candidates":    q("SELECT COUNT(*) FROM candidates"),
        "total_jobs":          q("SELECT COUNT(*) FROM jobs"),
        "analyzed":            q("SELECT COUNT(*) FROM candidates WHERE status='analyzed'"),
        "shortlisted":         q("SELECT COUNT(*) FROM candidates WHERE shortlisted=TRUE"),
        "avg_score":           round(q("SELECT COALESCE(AVG(overall_score),0) FROM candidates WHERE status='analyzed'"), 1),
        "fork_risks_detected": q("SELECT COUNT(*) FROM candidates WHERE originality_score < 40"),
        "with_private_access": q("SELECT COUNT(*) FROM candidates WHERE has_private_access=TRUE"),
        "early_career_count":  q("SELECT COUNT(*) FROM candidates WHERE is_early_career=TRUE"),
        "security_risk_count": q("SELECT COUNT(*) FROM candidates WHERE code_quality_score > 0 AND code_quality_score < 45"),
    }
    cur.close(); db.close()
    return result

@router.get("/activity")
def activity(current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = dict_cursor(db)
    cur.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); db.close()
    return rows

@router.get("/rate-limit")
def rate_limit(token: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    return get_rate_limit_status(token)

class BatchRequest(BaseModel):
    usernames: List[str]
    token: Optional[str] = None

@router.post("/batch-analyze")
async def batch_analyze(req: BatchRequest, current_user: dict = Depends(get_current_user)):
    from routes.candidates import analyze, AnalyzeRequest
    results = {"success": [], "failed": []}
    for username in req.usernames[:20]:
        try:
            ar = AnalyzeRequest(token=req.token)
            await analyze(username, ar, current_user)
            results["success"].append(username)
        except Exception as e:
            results["failed"].append({"username": username, "error": str(e)})
    return results

@router.delete("/cache")
def clear_cache(current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM api_cache")
    db.commit()
    count = cur.rowcount
    cur.close(); db.close()
    return {"cleared": count}