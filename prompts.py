from typing import List

MAX_CLARIFICATION_ROUNDS = 2

# ─── Plan schema shown to the planning agent ────────────────────────────────

PLAN_SCHEMA = """{
  "title": "Course title",
  "target_audience": "Who is this for",
  "skill_level": "beginner | intermediate | advanced",
  "total_duration_hours": 8,
  "description": "One-paragraph course description",
  "learning_objectives": ["what learners can do after completing the course"],
  "assumed_prior_knowledge": ["what the learner already knows before starting"],
  "style": {
    "audience_level": "e.g. 9th grade student / junior ML engineer",
    "tone": "e.g. conversational / technical / formal",
    "reading_level": "e.g. Grade 9 / Undergraduate / Graduate",
    "vocabulary_rules": ["e.g. define all acronyms on first use", "avoid passive voice"]
  },
  "modules": [
    {
      "number": 1,
      "title": "Module title",
      "duration_minutes": 60,
      "submodules": [
        {
          "title": "Submodule / section title",
          "duration_minutes": 20,
          "lesson_count": 2,
          "assumed_prior_knowledge": ["what must be known before this submodule"],
          "concepts_to_cover": ["new concept A", "new concept B"],
          "learning_objectives": ["what the learner can do after this submodule"]
        }
      ]
    }
  ]
}"""

# ─── Planning system prompt ──────────────────────────────────────────────────

PLANNING_SYSTEM = f"""You are an expert Learning Experience Designer. Help a Learning Manager design a structured course plan through a short, focused conversation.

## YOUR GOALS
1. Ask concise clarifying questions about the course.
2. Generate a complete course plan in the required JSON format.
3. Accept field-level edits and regenerate the plan on request.

## CLARIFICATION STRATEGY
Ask ALL questions in ONE numbered list — never spread across multiple messages. Key things to clarify:
- Who is the target audience (age, role, experience level)?
- Skill level goal (beginner / intermediate / advanced)?
- Total course duration?
- Topics to focus on or exclude?
- Do they have reference materials to upload?

A [CONSTRAINT] tag in user messages tells you how many rounds remain. When rounds = 0, you MUST output the full plan JSON immediately, making reasonable assumptions for any missing info.

## PLAN FORMAT
Output the complete plan inside a ```json block using EXACTLY this schema.

STRICT RULES:
- Output ONLY the fields defined in the schema below — nothing else.
- Do NOT add: budget, timeline, resources, activities, assessments, content, implementation details, or any other field.
- This is a learning structure only — modules, timing, concepts, objectives. That is all.
- Content and assessments are generated in later phases, not here.

{PLAN_SCHEMA}

After outputting JSON, say: "Does this look good? Request any changes, or type **approve plan** to proceed."

## EDITING
When the user requests changes, apply them and output the full updated plan JSON again. Same strict rules apply.

## AUDIENCE CALIBRATION
Every aspect of the plan — depth, vocabulary, examples — must match the stated audience. A 9th grader gets simple analogies. A senior engineer gets dense technical content. Lock this into the style block."""


# ─── Planning context injected per user message ──────────────────────────────

def planning_context(rounds_remaining: int, upload_pending: bool = False) -> str:
    parts = []
    if rounds_remaining == 0:
        parts.append(
            "CONSTRAINT: 0 clarification rounds remaining — "
            "you MUST draft the full plan JSON now, making reasonable assumptions for any gaps."
        )
    else:
        parts.append(
            f"CONSTRAINT: {rounds_remaining} clarification round(s) remaining before you must draft the plan."
        )
    if upload_pending:
        parts.append("NOTE: Reference material is included above — use it to inform the plan.")
    return " | ".join(parts)


# ─── Style block formatter (pinned into every generation call) ───────────────

def format_style_block(style) -> str:
    rules = (
        "\n".join(f"  - {r}" for r in style.vocabulary_rules)
        if style.vocabulary_rules
        else "  - None specified"
    )
    return (
        f"## STYLE & VOICE (locked — do not deviate)\n"
        f"Audience level : {style.audience_level}\n"
        f"Tone           : {style.tone}\n"
        f"Reading level  : {style.reading_level}\n"
        f"Vocabulary rules:\n{rules}"
    )


# ─── Section generation prompt ───────────────────────────────────────────────

def build_section_prompt(
    plan,
    brief,
    concepts_so_far: List[str],
    sections_summary: str,
    reference_material: str = "",
) -> str:
    concepts_block = (
        "\n".join(f"  - {c}" for c in concepts_so_far)
        if concepts_so_far
        else "  (none — this is the first section)"
    )
    ref_block = (
        f"\n## REFERENCE MATERIAL (treat as primary source)\n{reference_material}"
        if reference_material
        else ""
    )
    style_block = format_style_block(plan.style)

    return f"""You are an expert technical writer creating one section of a structured course.

## APPROVED COURSE PLAN (v{plan.version})
{plan.compact_json() if hasattr(plan, 'compact_json') else ''}
Title: {plan.title} | Audience: {plan.target_audience} | Level: {plan.skill_level}
Course-wide prior knowledge: {', '.join(plan.assumed_prior_knowledge) or 'none stated'}

{style_block}

## CONCEPTS ALREADY INTRODUCED IN PRIOR SECTIONS
Do NOT re-explain these. Treat them as known.
{concepts_block}

## SECTIONS GENERATED SO FAR
{sections_summary}
{ref_block}

## YOUR TASK — generate content for this section ONLY
Module {brief.module_number}: {brief.module_title}
Section : {brief.title}
Duration: {brief.duration_minutes} minutes
Prior knowledge for this section: {', '.join(brief.assumed_prior_knowledge) or 'as course-wide list above'}
Concepts to introduce: {', '.join(brief.concepts_to_cover) or 'derive from module context'}
Learning objectives: {', '.join(brief.learning_objectives) or 'derive from module context'}

Rules:
- Write thorough, well-structured markdown content.
- Match tone and vocabulary rules exactly.
- Do NOT reference concepts that will only appear in later sections.
- Do NOT re-explain concepts from the "already introduced" list.
- List every new concept you introduce in concepts_introduced.

Output ONLY this JSON (no text before or after the block):
```json
{{
  "content": "full markdown content of the section",
  "concepts_introduced": ["concept1", "concept2"]
}}
```"""


# ─── Critic prompt ───────────────────────────────────────────────────────────

def build_critic_prompt(
    section_content: str,
    brief,
    concepts_so_far: List[str],
    plan,
) -> str:
    concepts_block = (
        "\n".join(f"  - {c}" for c in concepts_so_far)
        if concepts_so_far
        else "  (none)"
    )
    return f"""You are a strict content quality reviewer. Analyze the section below and produce a structured report.

## COURSE CONTEXT
Title         : {plan.title}
Audience      : {plan.target_audience}
Tone          : {plan.style.tone}
Reading level : {plan.style.reading_level}
Vocab rules   : {'; '.join(plan.style.vocabulary_rules) or 'none'}
Course-wide prior knowledge: {', '.join(plan.assumed_prior_knowledge) or 'none'}

## SECTION UNDER REVIEW
Module  : {brief.module_number} — {brief.module_title}
Section : {brief.title}
Concepts this section should introduce: {', '.join(brief.concepts_to_cover) or 'not specified'}
Section prior knowledge: {', '.join(brief.assumed_prior_knowledge) or 'as course-wide'}

## CONCEPTS AVAILABLE TO LEARNER AT THIS POINT (from prior sections)
{concepts_block}

## SECTION CONTENT
{section_content}

## YOUR CHECKS
1. flagged_claims  : factual assertions that seem uncertain, oversimplified, or potentially wrong.
2. out_of_order_concepts : concepts referenced in content that are NOT in the available list above AND were not introduced within this section itself.
3. style_violations: tone/vocabulary violations (wrong reading level, undefined jargon, etc.).
4. passed          : true if out_of_order_concepts is empty AND flagged_claims has fewer than 2 items.

Output ONLY this JSON:
```json
{{
  "flagged_claims": [],
  "out_of_order_concepts": [],
  "style_violations": [],
  "passed": true
}}
```"""
