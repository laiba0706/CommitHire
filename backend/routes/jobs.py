"""routes/jobs.py"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import json
from database import get_db, dict_cursor
from routes.auth import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

class JobCreate(BaseModel):
    title: str
    company: str
    team: Optional[str] = ""
    description: Optional[str] = ""
    required_skills: List[str] = []
    experience_level: str = "mid"
    location: Optional[str] = "Remote"

@router.get("")
def list_jobs(current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = dict_cursor(db)
    cur.execute("SELECT * FROM jobs ORDER BY created_at DESC")
    jobs = []
    for j in cur.fetchall():
        job = dict(j)
        cur.execute("SELECT COUNT(*) FROM job_matches WHERE job_id=%s", (j["id"],))
        job["match_count"] = cur.fetchone()["count"]
        jobs.append(job)
    cur.close(); db.close()
    return jobs

@router.post("")
def create_job(job: JobCreate, current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = db.cursor()
    cur.execute("INSERT INTO jobs (title,company,team,description,required_skills,experience_level,location) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (job.title,job.company,job.team,job.description,json.dumps(job.required_skills),job.experience_level,job.location))
    cur.execute("INSERT INTO activity_log (action,details,status) VALUES (%s,%s,%s)", ("Created job", job.title, "success"))
    db.commit(); cur.close(); db.close()
    return {"created": True}

@router.delete("/{job_id}")
def delete_job(job_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM job_matches WHERE job_id=%s", (job_id,))
    cur.execute("DELETE FROM jobs WHERE id=%s", (job_id,))
    db.commit(); cur.close(); db.close()
    return {"deleted": True}

@router.get("/{job_id}/matches")
def job_matches(job_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db(); cur = dict_cursor(db)
    cur.execute("""SELECT jm.*,c.github_username,c.name,c.avatar_url,c.overall_score,
        c.proven_skills,c.originality_score,c.commit_quality_score,c.code_quality_score,
        c.is_early_career,c.career_tier FROM job_matches jm
        JOIN candidates c ON jm.candidate_id=c.id WHERE jm.job_id=%s ORDER BY jm.match_score DESC""", (job_id,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); db.close()
    return rows