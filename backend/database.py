"""
database.py — PostgreSQL connection + all table creation including auth
"""

import os
from dotenv import load_dotenv
load_dotenv()
import psycopg2
import psycopg2.extras

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     os.getenv("DB_PORT",     "5433"),
    "dbname":   os.getenv("DB_NAME",     "commithire"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", "12345"),
}

def get_db():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    return conn

def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def init_db():
    db = get_db()
    cur = db.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'recruiter',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS candidates (
            id SERIAL PRIMARY KEY,
            github_username TEXT UNIQUE NOT NULL,
            name TEXT, avatar_url TEXT, bio TEXT, location TEXT,
            followers INTEGER DEFAULT 0,
            public_repos INTEGER DEFAULT 0,
            overall_score REAL DEFAULT 0,
            authenticity_score REAL DEFAULT 0,
            commit_quality_score REAL DEFAULT 0,
            originality_score REAL DEFAULT 0,
            code_quality_score REAL DEFAULT 0,
            top_languages TEXT DEFAULT '[]',
            proven_skills TEXT DEFAULT '[]',
            analysis_data TEXT DEFAULT '{}',
            status TEXT DEFAULT 'pending',
            shortlisted BOOLEAN DEFAULT FALSE,
            has_private_access BOOLEAN DEFAULT FALSE,
            is_early_career BOOLEAN DEFAULT FALSE,
            career_tier TEXT DEFAULT 'standard',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            description TEXT,
            required_skills TEXT DEFAULT '[]',
            experience_level TEXT DEFAULT 'mid',
            location TEXT DEFAULT 'Remote',
            team TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS job_matches (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
            candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
            match_score REAL DEFAULT 0,
            match_reasons TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(job_id, candidate_id)
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id SERIAL PRIMARY KEY,
            action TEXT,
            details TEXT,
            status TEXT DEFAULT 'success',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS api_cache (
            cache_key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TIMESTAMP DEFAULT NOW()
        );
    """)
    db.commit()

    # Seed demo jobs if empty
    cur.execute("SELECT COUNT(*) FROM jobs")
    if cur.fetchone()[0] == 0:
        jobs = [
            ("Senior Frontend Engineer", "CommitHire", "Platform", "React, TypeScript, Node.js expert needed.", '["React","TypeScript","Node.js"]', "senior", "Remote"),
            ("Backend Engineer",         "CommitHire", "Infrastructure", "Go/Python backend with PostgreSQL.", '["Go","PostgreSQL","Docker"]', "senior", "NYC"),
            ("Full Stack Developer",     "CommitHire", "Growth", "Python + React full stack.", '["Python","React","AWS"]', "mid", "Remote"),
            ("Systems Engineer",         "CommitHire", "Core", "Low-level systems programming.", '["Rust","C++","WebAssembly"]', "senior", "SF"),
        ]
        for j in jobs:
            cur.execute(
                "INSERT INTO jobs (title, company, team, description, required_skills, experience_level, location) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                j
            )
        db.commit()

    cur.close()
    db.close()
    print("[CommitHire] Database initialized.")