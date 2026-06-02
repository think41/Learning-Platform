"""
FastAPI wrapper around the CLI learning platform state machine.
Each POST /session creates a fresh session with its own state.
"""
import uuid
import os
import asyncio
import tempfile
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import PlanningAgent
from generator import (generate_section, run_critic, generate_quiz,
                       generate_final_assignment, summarize_section)
from store import PlanStore, SectionStore
from models import GeneratedSection, SectionStatus
from parser import extract_json
from file_extractor import extract_text
import re
import json as _json


def clean_reply(text: str) -> str:
    """Strip raw JSON blocks and internal meta tags from the LLM reply."""
    # Remove ```json ... ``` fences
    cleaned = re.sub(r'```json\s*.*?\s*```', '', text, flags=re.DOTALL)
    # Remove internal control tags the model sometimes echoes back
    cleaned = re.sub(r'\[\s*(CONSTRAINT|NOTE)\b[^\]]*\]', '', cleaned, flags=re.IGNORECASE)
    # Remove bare { ... } if it parses as a plan (contains "modules" key)
    start = cleaned.find('{')
    end   = cleaned.rfind('}')
    if start != -1 and end > start:
        try:
            data = _json.loads(cleaned[start:end + 1])
            if 'modules' in data:
                cleaned = cleaned[:start] + cleaned[end + 1:]
        except _json.JSONDecodeError:
            pass
    return cleaned.strip()

app = FastAPI(title="Learning Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=4)

STATE_CLARIFYING   = "clarifying"
STATE_PLAN_DRAFTED = "plan_drafted"
STATE_CONTENT      = "content"
STATE_ASSESSMENT   = "assessment"
STATE_DONE         = "done"

sessions: Dict[str, dict] = {}


# ── Session helpers ───────────────────────────────────────────────────────────

def new_session() -> dict:
    return {
        "planning_agent":     PlanningAgent(),
        "plan_store":         PlanStore(),
        "section_store":      SectionStore(),
        "reference_material": [],
        "state":              STATE_CLARIFYING,
        "briefs":             [],
        "brief_index":        0,
        "current_section":    None,
        "quizzes":            [],
        "final_assignment":   None,
    }


def _sec_dict(s) -> dict:
    return {
        "id":                   s.id,
        "module_number":        s.module_number,
        "title":                s.title,
        "content":              s.content,
        "concepts_introduced":  s.concepts_introduced,
        "status":               s.status.value,
        "summary":              s.summary,
        "critic": {
            "flagged_claims":        s.critic_report.flagged_claims,
            "out_of_order_concepts": s.critic_report.out_of_order_concepts,
            "style_violations":      s.critic_report.style_violations,
            "passed":                s.critic_report.passed,
        } if s.critic_report else None,
    }


def serialize(session: dict) -> dict:
    ps = session["plan_store"]
    ss = session["section_store"]
    cs = session.get("current_section")
    return {
        "state":           session["state"],
        "plan":            ps._raw or None,
        "sections":        {sid: _sec_dict(s) for sid, s in ss.sections.items()},
        "current_section": _sec_dict(cs) if cs else None,
        "brief_index":     session["brief_index"],
        "total_briefs":    len(session["briefs"]),
        "uploaded_files":  session.get("uploaded_files", []),
        "quizzes":         session.get("quizzes", []),
        "final_assignment": session.get("final_assignment"),
    }


async def run(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, fn, *args)


def _build_section(session: dict) -> GeneratedSection:
    briefs = session["briefs"]
    idx    = session["brief_index"]
    ps     = session["plan_store"]
    ss     = session["section_store"]
    ref    = "\n\n".join(session["reference_material"])
    b      = briefs[idx]

    content, concepts = generate_section(
        ps.plan, b, ss.concepts_introduced, ss.approved_summaries_block(), ref
    )
    sid    = f"m{b.module_number}_s{b.submodule_index}"
    critic = run_critic(content, b, ss.concepts_introduced, ps.plan)
    return GeneratedSection(
        id=sid, module_number=b.module_number, title=b.title,
        content=content, concepts_introduced=concepts,
        status=SectionStatus.CRITIC_REVIEWED, critic_report=critic,
    )


# ── Assessment helpers ─────────────────────────────────────────────────────────

def _module_payload(session: dict, module):
    """Gather the approved section content + concepts for one module."""
    ss = session["section_store"]
    secs = [s for s in ss.sections.values() if s.module_number == module.number]
    content = "\n\n".join(f"### {s.title}\n{s.content}" for s in secs)
    concepts = []
    for s in secs:
        for c in s.concepts_introduced:
            if c not in concepts:
                concepts.append(c)
    return content, concepts


def _build_quiz(session: dict, module) -> dict:
    content, concepts = _module_payload(session, module)
    return generate_quiz(session["plan_store"].plan, module.number, module.title, content, concepts)


def _build_final_assignment(session: dict) -> dict:
    ss = session["section_store"]
    return generate_final_assignment(
        session["plan_store"].plan,
        ss.get_summary(),
        ss.concepts_introduced,
        ss.approved_summaries_block(),
    )


# ── Internal action helpers ───────────────────────────────────────────────────

async def _do_approve_plan(session_id: str) -> dict:
    session = sessions[session_id]
    if not session["plan_store"].plan:
        raise HTTPException(400, "No plan drafted yet — keep chatting with the AI")

    session["section_store"].mark_all_stale()
    session["state"]       = STATE_CONTENT
    session["briefs"]      = session["plan_store"].section_briefs()
    session["brief_index"] = 0

    if not session["briefs"]:
        session["state"] = STATE_PLAN_DRAFTED
        raise HTTPException(400, "Plan has no submodules — add some content first")

    section = await run(_build_section, session)
    session["current_section"] = section
    return {
        "reply": f"Plan approved! Generating content — first section: **{section.title}**. Review it on the right.",
        **serialize(session),
    }


async def _do_approve_section(session_id: str) -> dict:
    session = sessions[session_id]
    cs      = session.get("current_section")
    if not cs:
        return {"reply": "No section to approve.", **serialize(session)}

    briefs = session["briefs"]
    idx    = session["brief_index"]
    module_title = briefs[idx].module_title if idx < len(briefs) else cs.title
    cs.summary = await run(summarize_section, cs.title, module_title, cs.content)

    session["section_store"].add(cs)
    session["section_store"].approve_section(cs.id)
    session["brief_index"] += 1

    if session["brief_index"] >= len(session["briefs"]):
        session["state"]           = STATE_ASSESSMENT
        session["current_section"] = None
        return {
            "reply": "All sections approved! 🎉 Next, generate the assessments — one quiz per module plus a final assignment.",
            **serialize(session),
        }

    section = await run(_build_section, session)
    session["current_section"] = section
    return {
        "reply": f"Section approved! Next: **{section.title}** ({session['brief_index'] + 1}/{len(session['briefs'])}).",
        **serialize(session),
    }


async def _do_revise(session_id: str, feedback: str) -> dict:
    session = sessions[session_id]
    cs      = session.get("current_section")
    idx     = session["brief_index"]
    briefs  = session["briefs"]

    if not cs or idx >= len(briefs):
        return {"reply": "No section to revise.", **serialize(session)}

    b   = briefs[idx]
    ref = "\n\n".join(session["reference_material"])
    aug = ref + f"\n\n[INSTRUCTOR REVISION NOTE]: {feedback}"

    def _revise():
        content, concepts = generate_section(
            session["plan_store"].plan, b,
            session["section_store"].concepts_introduced,
            session["section_store"].approved_summaries_block(), aug,
        )
        sid2   = f"m{b.module_number}_s{b.submodule_index}"
        critic = run_critic(content, b, session["section_store"].concepts_introduced, session["plan_store"].plan)
        return GeneratedSection(
            id=sid2, module_number=b.module_number, title=b.title,
            content=content, concepts_introduced=concepts,
            status=SectionStatus.CRITIC_REVIEWED, critic_report=critic,
        )

    section = await run(_revise)
    session["current_section"] = section
    return {"reply": f"Section revised! Review the updated **{section.title}**.", **serialize(session)}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/session")
async def create_session():
    sid     = str(uuid.uuid4())
    session = new_session()
    sessions[sid] = session
    # No opening message — the hero greets the user, and the AI responds to
    # the user's first actual message.
    return {"session_id": sid, **serialize(session)}


class ChatBody(BaseModel):
    message: str


@app.post("/session/{sid}/chat")
async def chat(sid: str, body: ChatBody):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    session = sessions[sid]
    state   = session["state"]
    msg     = body.message.strip()

    if state in (STATE_CLARIFYING, STATE_PLAN_DRAFTED):
        if "approve plan" in msg.lower() and session["plan_store"].plan:
            return await _do_approve_plan(sid)

        reply = await run(session["planning_agent"].chat, msg)

        data = extract_json(reply)
        if data and "modules" in data:
            had = bool(session["section_store"].sections)
            session["plan_store"].approve(data)
            if had:
                session["section_store"].mark_all_stale()
            session["state"] = STATE_PLAN_DRAFTED

        return {"reply": clean_reply(reply), **serialize(session)}

    elif state == STATE_CONTENT:
        if "approve section" in msg.lower():
            return await _do_approve_section(sid)
        if msg.lower().startswith("revise:"):
            note = msg[7:].strip()
            return await _do_revise(sid, note)
        return {
            "reply": "You're in content review mode. Use the **Approve** or **Revise** buttons on the right to proceed.",
            **serialize(session),
        }

    elif state == STATE_ASSESSMENT:
        return {
            "reply": "All sections are done. Use **Generate Assessments** on the right to create the module quizzes and final assignment.",
            **serialize(session),
        }

    elif state == STATE_DONE:
        return {"reply": "Your course is complete! Use the Export button to save it.", **serialize(session)}

    return {"reply": "Unknown state.", **serialize(session)}


@app.post("/session/{sid}/approve-plan")
async def approve_plan(sid: str):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    return await _do_approve_plan(sid)


@app.post("/session/{sid}/approve-section")
async def approve_section(sid: str):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    return await _do_approve_section(sid)


@app.post("/session/{sid}/generate-assessments")
async def generate_assessments(sid: str):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    session = sessions[sid]
    if not session["section_store"].sections:
        raise HTTPException(400, "No course content to build assessments from")

    modules = session["plan_store"].plan.modules
    quizzes = []
    for m in modules:
        quizzes.append(await run(_build_quiz, session, m))
    session["quizzes"] = quizzes
    session["final_assignment"] = await run(_build_final_assignment, session)
    session["state"] = STATE_DONE
    return {
        "reply": f"Generated {len(quizzes)} module quiz(zes) and a final assignment. 🎓",
        **serialize(session),
    }


@app.post("/session/{sid}/regenerate-quiz/{module_number}")
async def regenerate_quiz(sid: str, module_number: int):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    session = sessions[sid]
    module = next((m for m in session["plan_store"].plan.modules if m.number == module_number), None)
    if not module:
        raise HTTPException(404, f"Module {module_number} not found")
    quiz = await run(_build_quiz, session, module)
    session["quizzes"] = [quiz if q.get("module_number") == module_number else q
                          for q in session.get("quizzes", [])]
    return {"reply": f"Regenerated the quiz for Module {module_number}.", **serialize(session)}


@app.post("/session/{sid}/regenerate-assignment")
async def regenerate_assignment(sid: str):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    session = sessions[sid]
    session["final_assignment"] = await run(_build_final_assignment, session)
    return {"reply": "Regenerated the final assignment.", **serialize(session)}


class ReviseBody(BaseModel):
    feedback: str


@app.post("/session/{sid}/revise")
async def revise(sid: str, body: ReviseBody):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    return await _do_revise(sid, body.feedback)


def _extract_upload(file_bytes: bytes, filename: str):
    suffix = os.path.splitext(filename or "")[1]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        return extract_text(tmp_path)
    finally:
        os.unlink(tmp_path)


@app.post("/session/{sid}/upload")
async def upload(sid: str, files: List[UploadFile] = File(...), message: str = Form("")):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    session = sessions[sid]

    accepted, any_truncated = [], False
    for file in files:
        raw = await file.read()
        text, _filename, truncated = await run(_extract_upload, raw, file.filename)
        any_truncated = any_truncated or truncated
        session["reference_material"].append(text)
        session.setdefault("uploaded_files", []).append(file.filename)
        accepted.append((file.filename, text))

    names = ", ".join(f"'{n}'" for n, _ in accepted)
    msg = (message or "").strip()

    if session["state"] in (STATE_CLARIFYING, STATE_PLAN_DRAFTED):
        for name, text in accepted:
            session["planning_agent"].queue_upload(text, name)
        # All queued file contents are auto-prepended to whatever the user typed.
        prompt = msg if msg else f"I just uploaded {names}. Acknowledge and factor into the plan."
        reply = await run(session["planning_agent"].chat, prompt)
        data = extract_json(reply)
        if data and "modules" in data:
            session["plan_store"].approve(data)
            session["state"] = STATE_PLAN_DRAFTED
        return {"reply": clean_reply(reply), "truncated": any_truncated, **serialize(session)}

    note = f"{names} added as reference material for content generation."
    if msg:
        note += f" (Note: '{msg}' — reference files are applied during section generation.)"
    return {"reply": note, "truncated": any_truncated, **serialize(session)}


@app.get("/session/{sid}/export")
async def export_session(sid: str):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    session = sessions[sid]
    ps      = session["plan_store"]
    ss      = session["section_store"]
    return {
        "plan": ps._raw,
        "sections": {
            s_id: {
                "content":              s.content,
                "concepts_introduced":  s.concepts_introduced,
                "status":               s.status.value,
                "critic":               vars(s.critic_report) if s.critic_report else None,
            }
            for s_id, s in ss.sections.items()
        },
        "quizzes":          session.get("quizzes", []),
        "final_assignment": session.get("final_assignment"),
    }
