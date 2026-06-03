"""SQLite persistence for published courses. POC-grade — single table, JSON blobs."""
import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Optional

DB_DIR  = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS courses (
    id                    TEXT PRIMARY KEY,
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    total_duration_hours  REAL NOT NULL DEFAULT 0,
    plan_json             TEXT NOT NULL,
    sections_json         TEXT NOT NULL,
    quizzes_json          TEXT NOT NULL,
    final_assignment_json TEXT NOT NULL,
    created_at            TEXT NOT NULL
);
"""


def _connect() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(SCHEMA)


def save_course(
    title: str,
    description: str,
    total_duration_hours: float,
    plan: dict,
    sections: dict,
    quizzes: list,
    final_assignment: dict,
) -> str:
    course_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with _connect() as conn:
        conn.execute(
            """INSERT INTO courses
               (id, title, description, total_duration_hours,
                plan_json, sections_json, quizzes_json, final_assignment_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                course_id, title, description, total_duration_hours,
                json.dumps(plan), json.dumps(sections),
                json.dumps(quizzes), json.dumps(final_assignment or {}),
                now,
            ),
        )
    return course_id


def list_courses() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, title, description, total_duration_hours, created_at "
            "FROM courses ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_course(course_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
    if not row:
        return None
    return {
        "id":                   row["id"],
        "title":                row["title"],
        "description":          row["description"],
        "total_duration_hours": row["total_duration_hours"],
        "plan":                 json.loads(row["plan_json"]),
        "sections":             json.loads(row["sections_json"]),
        "quizzes":              json.loads(row["quizzes_json"]),
        "final_assignment":     json.loads(row["final_assignment_json"]),
        "created_at":           row["created_at"],
    }


def write_manuscript(course_id: str, title: str, sections: dict) -> str:
    """Human-readable stitched manuscript for the published course."""
    course_dir = os.path.join(DB_DIR, "courses", course_id)
    os.makedirs(course_dir, exist_ok=True)
    path = os.path.join(course_dir, "manuscript.md")
    ordered = sorted(
        sections.values(),
        key=lambda s: (s.get("module_number", 0), s.get("id", "")),
    )
    parts = [f"# {title}\n"]
    for s in ordered:
        parts.append(f"\n## Module {s.get('module_number')} — {s.get('title','')}\n")
        parts.append(s.get("content", "") or "")
        parts.append("\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))
    return path
