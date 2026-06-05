# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The repo has two top-level apps:

- `backend/` — FastAPI app (`api.py`) plus the LLM/course-generation pipeline. All Python code lives here, not at the repo root.
- `frontend/` — React 18 + Vite + Tailwind UI.

Note: the README's setup snippets show running commands from the repo root, but the Python code is actually inside `backend/`. `cd backend` before `pip install` / `uvicorn`, and put `.env` in `backend/` (an `.env.example` is there).

## Common commands

Backend (run from `backend/`):
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then set LLM_PROVIDER + matching API key
uvicorn api:app --port 8000 --reload
```

Frontend (run from `frontend/`):
```bash
npm install
npm run dev      # Vite dev server on :5173, proxies /session and /courses to :8000
npm run build    # production build → frontend/dist/
```

Open `http://localhost:5173/course-builder`. The dev server proxy (`vite.config.js`) only forwards `/session` and `/courses` — new API path prefixes need to be added there too.

There are no test, lint, or typecheck scripts configured in either app.

## LLM provider configuration

`backend/llm.py` + `backend/config.py` are a provider-agnostic factory. Set `LLM_PROVIDER` in `.env` to one of `gemini` | `openai` | `claude` | `groq` and provide only that provider's key (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`). Optionally pin a model with `LLM_MODEL`. Anywhere a new LLM call is added, go through this factory — don't import provider SDKs directly elsewhere.

## High-level architecture

The product is a state-machine-driven course builder. One FastAPI session = one in-memory state object holding a planning agent, a `PlanStore`, and a `SectionStore`. The frontend drives the session through these states by calling endpoints:

```
CLARIFYING → PLAN_DRAFTED → CONTENT → ASSESSMENT → DONE
```

Key backend modules and how they fit together:

- `api.py` — FastAPI surface. Owns the in-memory `SESSIONS: Dict[session_id, state]`. Each endpoint mutates state and returns a serialized snapshot the frontend re-renders from. Sessions are ephemeral; only **published** courses are persisted.
- `agent.py` — `PlanningAgent`: the conversational loop that produces a course plan JSON during the CLARIFYING state.
- `generator.py` — Section generation, critic review, quiz generation, final assignment generation, and section summarization. This is where most LLM calls live during CONTENT and ASSESSMENT.
- `prompts.py` — All system prompts, JSON schemas, and hard limits (`MAX_MODULES`, `MAX_SUBMODULES_PER_MODULE`). When changing prompt behavior or schema shape, this is the single source of truth.
- `store.py` — `PlanStore` (versions approved plans, enforces module/submodule caps, produces `compact_json` pinned into every downstream prompt) and `SectionStore` (tracks per-section status: `draft → critic_reviewed → approved`, plus `stale` propagation when an earlier module is re-approved).
- `models.py` — Dataclasses for the domain (`ApprovedPlan`, `Module`, `Submodule`, `GeneratedSection`, `CriticReport`, etc.). Sections are addressed by `"m{module}_s{submodule_index}"`.
- `parser.py` — `extract_json` helper used to pull JSON out of LLM text replies (the model often wraps JSON in prose or fences).
- `file_extractor.py` — PDF/DOCX/PPTX/TXT → text, used when the user attaches reference material during chat.
- `db.py` — SQLite persistence (`backend/data/app.db`), single `courses` table of JSON blobs. Only populated by the **publish** flow; everything else is in-memory.

Important invariants:

- The compact plan from `PlanStore.compact_json()` is re-injected into every section/quiz/assignment prompt so generation stays consistent with the approved plan.
- Revising/re-approving an earlier module marks later sections `STALE` via `SectionStore.mark_stale_from`. Anything that mutates the plan after sections exist must keep this contract.
- `api.py:clean_reply` strips raw JSON blocks and internal `[CONSTRAINT]`/`[NOTE]` tags out of LLM replies before they reach the chat UI — preserve this when adding new chat endpoints.

## Frontend structure

- `main.jsx` — React Router. Two top-level flows:
  - `/course-builder*` — the authoring app (`App.jsx` + `components/ChatPanel`, `PlanPanel`).
  - `/learn/*` — the learner-facing player for published courses (`pages/CourseLibraryPage`, `CourseOverviewPage`, `SectionPlayerPage`, `QuizPlayerPage`, `FinalAssignmentPage`).
- `api.js` — single module wrapping all backend calls. New endpoints go here, not inline `fetch` in components.
- `learnProgress.js` — learner progress is tracked client-side (localStorage), not on the server.
- Styling is Tailwind with custom `brand-*` / `cream` tokens defined in `tailwind.config.js`.

## CLI

The README references `python main.py` for a CLI REPL, but `main.py` is not present in the current tree. Treat the CLI as not-currently-available unless it is re-added.
