"""
Stateless generation functions — no thread dependency.
Every call receives the full context it needs: approved plan + concepts so far + section brief.
"""
from typing import Tuple, List
from dotenv import load_dotenv
from llm import get_llm
from models import CriticReport, ApprovedPlan, SectionBrief
from prompts import (build_section_prompt, build_critic_prompt,
                     build_quiz_prompt, build_final_assignment_prompt)
from parser import extract_json

load_dotenv()


def generate_section(
    plan: ApprovedPlan,
    brief: SectionBrief,
    concepts_so_far: List[str],
    sections_summary: str,
    reference_material: str = "",
) -> Tuple[str, List[str]]:
    """
    Stateless section generation.
    Returns (content_markdown, concepts_introduced).
    Each call is independent — no reliance on conversation thread.
    """
    prompt = build_section_prompt(plan, brief, concepts_so_far, sections_summary, reference_material)
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
        return data["content"], data.get("concepts_introduced", [])
    return raw, []


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


def generate_quiz(plan, module_number, module_title, module_content, concepts):
    """Stateless: generate one quiz (JSON dict) for a single module."""
    prompt = build_quiz_prompt(plan, module_number, module_title, module_content, concepts)
    raw = get_llm().complete(
        [
            {"role": "system", "content": "You are an expert assessment designer. Output ONLY the requested JSON — no preamble."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=2048,
    )
    data = extract_json(raw)
    if data and "questions" in data:
        return data
    return {"module_number": module_number, "module_title": module_title, "questions": []}


def generate_final_assignment(plan, sections_summary, concepts):
    """Stateless: generate one capstone final assignment (JSON dict) for the course."""
    prompt = build_final_assignment_prompt(plan, sections_summary, concepts)
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
