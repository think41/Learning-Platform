"""
Stateless generation functions — no thread dependency.
Every call receives the full context it needs: approved plan + concepts so far + section brief.
"""
from typing import Tuple, List
from dotenv import load_dotenv
from llm import get_llm
from models import CriticReport, ApprovedPlan, SectionBrief
from prompts import (build_section_prompt, build_critic_prompt,
                     build_quiz_prompt, build_final_assignment_prompt,
                     build_summary_prompt, build_slides_only_prompt,
                     build_trim_prompt,
                     SECTION_WORD_CAP, SECTION_WORD_GRACE)
from parser import extract_json

load_dotenv()


def _word_count(text: str) -> int:
    return len(text.split())


def _trim_to_cap(content: str) -> str:
    """If content exceeds cap+grace, do one LLM trim pass. Otherwise return as-is."""
    wc = _word_count(content)
    if wc <= SECTION_WORD_CAP + SECTION_WORD_GRACE:
        return content
    raw = get_llm().complete(
        [
            {"role": "system", "content": "You are a precise editor. Output ONLY the requested JSON — no preamble."},
            {"role": "user", "content": build_trim_prompt(content, wc)},
        ],
        temperature=0.3,
        max_tokens=4096,
    )
    data = extract_json(raw)
    if data and "content" in data:
        return data["content"]
    return content  # trim failed — accept the original rather than loop


def generate_section(
    plan: ApprovedPlan,
    brief: SectionBrief,
    concepts_so_far: List[str],
    prior_summaries: str,
    reference_material: str = "",
) -> Tuple[str, List[str]]:
    """
    Stateless section generation.
    Returns (content_markdown, concepts_introduced).
    Each call is independent — no reliance on conversation thread.
    """
    prompt = build_section_prompt(plan, brief, concepts_so_far, prior_summaries, reference_material)
    raw = get_llm().complete(
        [
            {
                "role": "system",
                "content": "You are an expert technical writer and educator. Output ONLY the requested JSON — no preamble, no commentary.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=4096,
    )
    data = extract_json(raw)
    if data and "content" in data:
        content = _trim_to_cap(data["content"])
        return content, data.get("concepts_introduced", [])
    return raw, []


def _validate_slides(slides) -> list[str]:
    """Structural check for a slide deck. Empty list = passed."""
    issues: list[str] = []
    if not isinstance(slides, list):
        return ["'slides' must be a list."]
    if not (6 <= len(slides) <= 10):
        issues.append(f"Deck must have 6 to 10 slides, got {len(slides)}.")
    for i, s in enumerate(slides, 1):
        if not isinstance(s, dict):
            issues.append(f"Slide {i}: not a JSON object.")
            continue
        title = (s.get("title") or "").strip()
        if not title:
            issues.append(f"Slide {i}: empty title.")
        has_bullets = "bullets" in s
        has_code    = "code" in s
        if has_bullets == has_code:
            issues.append(f"Slide {i}: must have exactly one of 'bullets' or 'code'.")
            continue
        if has_bullets:
            bullets = s.get("bullets")
            if not isinstance(bullets, list):
                issues.append(f"Slide {i}: 'bullets' must be a list.")
                continue
            if not (3 <= len(bullets) <= 5):
                issues.append(f"Slide {i}: bullets must be 3 to 5, got {len(bullets)}.")
            if any(not (isinstance(b, str) and b.strip()) for b in bullets):
                issues.append(f"Slide {i}: contains empty or non-string bullets.")
        else:
            code = s.get("code")
            if not (isinstance(code, str) and code.strip()):
                issues.append(f"Slide {i}: 'code' must be a non-empty string.")
    return issues


def summarize_section(section_title: str, module_title: str, section_content: str) -> Tuple[str, list]:
    """
    Returns (summary_text, slides_list).
    One LLM call produces both artifacts. On slide-validation failure we do one slides-only retry.
    Fail-soft: if everything fails, returns the best summary we have and slides=[].
    """
    prompt = build_summary_prompt(section_title, module_title, section_content)
    raw = get_llm().complete(
        [
            {"role": "system", "content": "You are a concise summarizer and slide designer. Output ONLY the requested JSON — no preamble."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    data    = extract_json(raw) or {}
    summary = (data.get("summary") or "").strip()
    slides  = data.get("slides") or []

    # Summary is load-bearing. If JSON parse failed entirely, fall back to raw text.
    if not summary:
        summary = raw.strip()

    issues = _validate_slides(slides)
    if not issues:
        return summary, slides

    # One slides-only retry.
    retry_prompt = build_slides_only_prompt(section_title, module_title, section_content, issues)
    retry_raw = get_llm().complete(
        [
            {"role": "system", "content": "You are a slide designer. Output ONLY the requested JSON — no preamble."},
            {"role": "user", "content": retry_prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    retry_data   = extract_json(retry_raw) or {}
    retry_slides = retry_data.get("slides") or []
    if not _validate_slides(retry_slides):
        return summary, retry_slides

    # Fail-soft: keep the summary, drop the deck.
    return summary, []


def run_critic(
    section_content: str,
    brief: SectionBrief,
    concepts_so_far: List[str],
    plan: ApprovedPlan,
) -> CriticReport:
    """
    Critic agent — sees only the section it reviews, the concepts available so far,
    and the plan metadata. Never sees other section content.
    Outputs a structured CriticReport, not free text.
    """
    prompt = build_critic_prompt(section_content, brief, concepts_so_far, plan)
    raw = get_llm().complete(
        [
            {
                "role": "system",
                "content": "You are a strict quality reviewer. Output ONLY the requested JSON — no preamble, no commentary.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=1024,
    )
    data = extract_json(raw)
    if data:
        return CriticReport(
            flagged_claims=data.get("flagged_claims", []),
            out_of_order_concepts=data.get("out_of_order_concepts", []),
            style_violations=data.get("style_violations", []),
            passed=bool(data.get("passed", True)),
        )
    return CriticReport([], [], [], True)


def generate_ppt_slides(section_content: str, section_title: str, style) -> dict:
    """Convert section content into PPT slide JSON."""
    from prompts import format_style_block
    style_str = format_style_block(style)
    prompt = (
        f"Convert this course section into a slide deck.\n\n"
        f"{style_str}\n\n"
        f"Section title: {section_title}\n\n"
        f"Content:\n{section_content}\n\n"
        f"Aim for 8-12 slides. First slide = overview, last = key takeaways.\n\n"
        f'Output ONLY this JSON:\n'
        f'{{"type":"ppt","module_title":"{section_title}","slides":['
        f'{{"slide_number":1,"title":"...","content":["bullet 1","bullet 2"],"speaker_notes":"..."}}'
        f"]}}"
    )
    raw = get_llm().complete(
        [{"role": "user", "content": prompt}],
        max_tokens=3000,
    )
    return extract_json(raw) or {}


def _validate_quiz(data: dict, expected_n: int) -> list[str]:
    """Return a list of structural issues. Empty list = passed."""
    issues: list[str] = []
    questions = data.get("questions") if isinstance(data, dict) else None
    if not isinstance(questions, list):
        return ["Response missing a 'questions' array."]
    if len(questions) != expected_n:
        issues.append(f"Expected {expected_n} questions, got {len(questions)}.")

    types_seen = set()
    for i, q in enumerate(questions, 1):
        if not isinstance(q, dict):
            issues.append(f"Q{i}: not a JSON object.")
            continue
        qtext       = (q.get("question") or "").strip()
        qtype       = q.get("type", "")
        answer      = q.get("answer", "")
        options     = q.get("options", [])
        explanation = (q.get("explanation") or "").strip()
        answer_str  = answer.strip() if isinstance(answer, str) else ""

        if not qtext:       issues.append(f"Q{i}: empty question text.")
        if not answer_str:  issues.append(f"Q{i}: empty answer.")
        if not explanation: issues.append(f"Q{i}: missing explanation.")

        if qtype != "multiple_choice":
            issues.append(f"Q{i}: every question must be 'multiple_choice', got {qtype!r}.")
            continue

        if not isinstance(options, list) or len(options) != 4:
            issues.append(f"Q{i}: multiple_choice must have exactly 4 options.")
            continue
        stripped = [o.strip() if isinstance(o, str) else "" for o in options]
        if any(not o for o in stripped):
            issues.append(f"Q{i}: options contain empty strings.")
        if len(set(stripped)) != len(stripped):
            issues.append(f"Q{i}: options contain duplicates.")
        if answer_str and answer_str not in stripped:
            issues.append(f"Q{i}: answer {answer_str!r} is not an exact match of any option.")

    return issues


def _quiz_llm_call(plan, module_number, module_title, module_content, concepts, prior_issues=None):
    prompt = build_quiz_prompt(plan, module_number, module_title, module_content, concepts, prior_issues)
    raw = get_llm().complete(
        [
            {"role": "system", "content": "You are an expert assessment designer. Output ONLY the requested JSON — no preamble."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=2048,
    )
    return extract_json(raw)


def generate_quiz(plan, module_number, module_title, module_content, concepts):
    """Generate one quiz for a single module, with one validation-retry on failure."""
    from prompts import QUIZ_QUESTIONS
    data = _quiz_llm_call(plan, module_number, module_title, module_content, concepts) or {}
    issues = _validate_quiz(data, QUIZ_QUESTIONS)
    if issues:
        retry = _quiz_llm_call(plan, module_number, module_title, module_content, concepts, prior_issues=issues) or {}
        retry_issues = _validate_quiz(retry, QUIZ_QUESTIONS)
        if not retry_issues:
            retry["validated"] = True
            retry["validation_issues"] = []
            return retry
        # both attempts failed — return the second one, flagged
        retry["validated"] = False
        retry["validation_issues"] = retry_issues
        retry.setdefault("module_number", module_number)
        retry.setdefault("module_title", module_title)
        retry.setdefault("questions", [])
        return retry

    data["validated"] = True
    data["validation_issues"] = []
    return data


def generate_final_assignment(plan, sections_summary, concepts, prior_summaries=""):
    """Stateless: generate one capstone final assignment (JSON dict) for the course."""
    prompt = build_final_assignment_prompt(plan, sections_summary, concepts, prior_summaries)
    raw = get_llm().complete(
        [
            {"role": "system", "content": "You are an expert instructional designer. Output ONLY the requested JSON — no preamble."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        max_tokens=2048,
    )
    data = extract_json(raw)
    if data and "title" in data:
        return data
    return {}
