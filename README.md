# CommitHire 🔍

> AI-powered GitHub profile analyzer built for modern recruiters.

CommitHire helps technical recruiters go beyond resumes by analyzing candidates' actual GitHub activity — detecting forked repos, verifying claimed skills, scoring commit quality, and flagging code vulnerabilities.

---

## ✨ Features

- **Fork Detection** — Identify forked repos vs. original work
- **Commit Quality Analysis** — Analyze commit patterns & authenticity
- **Skill Authenticity** — Verify claimed skills against actual code
- **Code Quality & Security** — Detect vulnerabilities & best practices
- **Batch Analysis** — Analyze multiple GitHub profiles at once
- **Shortlisting** — Save and manage top candidates
- **Job Matching** — Match candidates against open roles
- **Recruiter Dashboard** — Real-time stats and activity feed

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL (via psycopg2) |
| Auth | JWT |
| API | GitHub REST API |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL

### 1. Clone the repo
```bash
git clone https://github.com/laiba0706/CommitHire.git
cd CommitHire
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:
```env
DATABASE_URL=postgresql://user:password@localhost/commithire
SECRET_KEY=your_secret_key
GITHUB_TOKEN=your_github_token
```

Start the backend:
```bash
uvicorn main:app --reload
```
Backend runs on `http://localhost:8000`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

---

## 📸 Screenshots

> Dashboard with real-time GitHub analysis and recruiter stats.

---

## 📁 Project Structure
```
CommitHire/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── ...
│   └── vite.config.js
└── README.md
```

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `GITHUB_TOKEN` | GitHub Personal Access Token |

---

## 👩‍💻 Author

**Laiba** — [@laiba0706](https://github.com/laiba0706)

---

## 📄 License

This project is for educational purposes.