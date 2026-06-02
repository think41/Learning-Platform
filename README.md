# CourseBuilder — AI Learning Platform

An AI-powered course builder. Describe a course in chat, the AI asks a few
clarifying questions and drafts a structured plan, then generates each section
(with an automated critic review), per-module quizzes, and a final capstone
assignment — all reviewed and approved by you.

There are two ways to use it:

- **Web app** — FastAPI backend (`api.py`) + React/Vite frontend (`frontend/`)
- **CLI** — a terminal REPL (`main.py`)

---

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+ and npm
- An API key for **one** LLM provider: Gemini, OpenAI, Claude, or Groq

---

## 1. Backend setup

```bash
cd learning-platform

# create + activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# install dependencies
pip install -r requirements.txt
```

### Configure the `.env`

Create a file named `.env` in the project root (you can copy `.env.example`):

```bash
cp .env.example .env
```

Set **`LLM_PROVIDER`** to the provider you want, and add **only that
provider's key**. Pick one of the following:

```ini
# Option A — Google Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Option B — OpenAI
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key_here

# Option C — Anthropic Claude
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Option D — Groq
# LLM_PROVIDER=groq
# GROQ_API_KEY=your_groq_api_key_here
```

Optional — pin a specific model (otherwise a sensible default per provider is used):

```ini
# LLM_MODEL=gemini-2.5-flash-lite
```

| Provider | `LLM_PROVIDER` | Key variable        | Default model              |
|----------|----------------|---------------------|----------------------------|
| Gemini   | `gemini`       | `GEMINI_API_KEY`    | `gemini-2.5-flash-lite`    |
| OpenAI   | `openai`       | `OPENAI_API_KEY`    | `gpt-4o`                   |
| Claude   | `claude`       | `ANTHROPIC_API_KEY` | `claude-haiku-4-5`         |
| Groq     | `groq`         | `GROQ_API_KEY`      | `llama-3.3-70b-versatile`  |

> `.env` is git-ignored — your keys never get committed.

### Run the API server

```bash
source venv/bin/activate
uvicorn api:app --port 8000 --reload
```

The API runs at `http://localhost:8000`.

---

## 2. Frontend setup

In a **second terminal**:

```bash
cd learning-platform/frontend

# install dependencies
npm install

# start the dev server
npm run dev
```

Then open **http://localhost:5173/course-builder**.

The Vite dev server proxies all `/session` API calls to the backend on
`http://localhost:8000`, so just keep both terminals running. Make sure the
backend is up before using the app.

To build for production: `npm run build` (output in `frontend/dist/`).

---

## 3. CLI (optional)

Prefer the terminal? With the backend `.env` configured and the venv active:

```bash
source venv/bin/activate
python main.py
```

Commands: `/upload <path>`, `/status`, `/export`, `/ppt <section-id>`,
`/reset`, `/help`, `/quit`. Keywords: `approve plan`, `approve section`,
`revise: <note>`.

---

## How it works

```
CLARIFYING → PLAN_DRAFTED → CONTENT → ASSESSMENT → DONE
```

1. **Chat** — describe your course; attach reference files (PDF, DOCX, PPTX,
   TXT) for the AI to use as source material.
2. **Plan** — the AI drafts a structured plan (max 4 modules × 2 submodules).
   Review it on the right and approve, or keep refining.
3. **Content** — each section is generated and critic-reviewed; you approve or
   revise it.
4. **Assessments** — generate one quiz per module plus a capstone final
   assignment.
5. **Export** — download the full course (plan + sections + assessments) as JSON.

---

## Project layout

```
learning-platform/
├── api.py            # FastAPI web backend
├── main.py           # CLI REPL
├── agent.py          # planning conversation agent
├── generator.py      # section / quiz / assignment generation
├── prompts.py        # system prompts, schemas, limits
├── store.py          # in-memory plan + section state
├── models.py         # data models
├── llm.py / config.py# provider-agnostic LLM factory
├── file_extractor.py # PDF/DOCX/PPTX/TXT text extraction
├── requirements.txt
└── frontend/         # React + Vite + Tailwind UI
```
