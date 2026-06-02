from typing import List

MAX_CLARIFICATION_ROUNDS = 2

# Hard limits on plan structure (enforced in the prompt and again in store.py)
MAX_MODULES = 4
MAX_SUBMODULES_PER_MODULE = 2

# Section length controls
SECTION_WORD_CAP = 1000       # hard cap; prompt-enforced + verified in code
SECTION_WORD_GRACE = 100      # allow up to cap+grace before forcing a trim
SUMMARY_WORD_TARGET = 100     # target length for per-section forward-context summary

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
Keep it tight. Open with at most ONE short sentence, then ask your questions as ONE concise numbered markdown list — never spread across multiple messages. No long preamble, no repeating the user back. Each question should be a single short line. Cover:
1. Target audience (role / experience level)?
2. Skill level goal (beginner / intermediate / advanced)?
3. Total course duration?
4. Topics to focus on or exclude?
5. Any reference materials to upload?

## INTERNAL CONTROL TAGS
User messages may contain bracketed control tags like [CONSTRAINT: ...] or [NOTE: ...]. These are internal instructions for you ONLY — obey them but NEVER repeat, quote, or display them in your reply. A [CONSTRAINT] tag tells you how many rounds remain; when rounds = 0 you MUST output the full plan JSON immediately, making reasonable assumptions for any gaps.

## PLAN FORMAT
Output the complete plan inside a ```json block using EXACTLY this schema.

STRICT RULES:
- Output ONLY the fields defined in the schema below — nothing else.
- Do NOT add: budget, timeline, resources, activities, assessments, content, implementation details, or any other field.
- This is a learning structure only — modules, timing, concepts, objectives. That is all.
- Content and assessments are generated in later phases, not here.
- HARD LIMIT: at most {MAX_MODULES} modules total, and at most {MAX_SUBMODULES_PER_MODULE} submodules per module. Never exceed these. If the topic is large, prioritize and consolidate to fit within these limits.

{PLAN_SCHEMA}

After outputting the JSON, add one short, warm closing line in plain conversational language — invite the user to review the plan and either suggest changes or approve it when they're ready. Do NOT mention typing commands, keywords, buttons, or JSON. Keep it natural, e.g. "Take a look and let me know if you'd like to adjust anything — otherwise we can move on to building out the content." Vary the wording.

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
    prior_summaries: str,
    reference_material: str = "",
) -> str:
    concepts_block = (
        "\n".join(f"  - {c}" for c in concepts_so_far)
        if concepts_so_far
        else "  (none — this is the first section)"
    )
    summaries_block = prior_summaries.strip() or "(none — this is the first section)"
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

## SUMMARIES OF PRIOR APPROVED SECTIONS
Use these for narrative continuity, consistent vocabulary, and to avoid repeating examples or explanations already given. Build on what's here.
{summaries_block}
{ref_block}

## YOUR TASK — generate content for this section ONLY
Module {brief.module_number}: {brief.module_title}
Section : {brief.title}
Duration: {brief.duration_minutes} minutes
Prior knowledge for this section: {', '.join(brief.assumed_prior_knowledge) or 'as course-wide list above'}
Concepts to introduce: {', '.join(brief.concepts_to_cover) or 'derive from module context'}
Learning objectives: {', '.join(brief.learning_objectives) or 'derive from module context'}

Rules:
- HARD CAP: section content must be at most {SECTION_WORD_CAP} words. Be tight. Cut filler before adding more.
- Write well-structured markdown content.
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


# ─── Summary prompt (per-section, used as forward context) ───────────────────

def build_summary_prompt(section_title: str, module_title: str, section_content: str) -> str:
    return f"""Summarize the course section below for use as forward context when later sections are generated.

## SECTION
Module : {module_title}
Title  : {section_title}

## CONTENT
{section_content}

## YOUR TASK
Write a single dense paragraph of about {SUMMARY_WORD_TARGET} words covering:
- The key concepts taught (named exactly as the section named them).
- Any worked example(s) used, briefly.
- Any vocabulary or analogies the section relied on that later sections should stay consistent with.

No headings, no bullet lists, no preamble. Just the paragraph."""


# ─── Trim prompt (when a section exceeds the word cap) ───────────────────────

def build_trim_prompt(section_content: str, current_words: int) -> str:
    return f"""The course section below is {current_words} words. Trim it to at most {SECTION_WORD_CAP} words.

## RULES
- Preserve all key concepts, code examples, and the overall structure / headings.
- Remove filler, repetition, and over-elaboration. Tighten prose.
- Do NOT drop entire concepts or examples.
- Keep the same markdown formatting.

## CONTENT TO TRIM
{section_content}

Output ONLY this JSON (no text before or after):
```json
{{
  "content": "trimmed markdown content"
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


# ─── Quiz prompt (one per module) ────────────────────────────────────────────

QUIZ_QUESTIONS = 4

def build_quiz_prompt(
    plan,
    module_number: int,
    module_title: str,
    module_content: str,
    concepts: List[str],
    prior_issues: List[str] | None = None,
) -> str:
    style_block = format_style_block(plan.style)
    concepts_block = ", ".join(concepts) or "the concepts taught in this module"
    fix_block = ""
    if prior_issues:
        issues_lines = "\n".join(f"  - {i}" for i in prior_issues)
        fix_block = (
            f"\n## PREVIOUS ATTEMPT FAILED VALIDATION — FIX THESE ISSUES\n"
            f"{issues_lines}\n"
            f"Regenerate the quiz so that NONE of the above issues recur.\n"
        )
    return f"""You are an expert assessment designer. Write a quiz for ONE module of a course, based strictly on what that module taught.

## COURSE
Title: {plan.title} | Audience: {plan.target_audience} | Level: {plan.skill_level}

{style_block}

## MODULE {module_number}: {module_title}
Concepts covered: {concepts_block}

## MODULE CONTENT (the only material the quiz may test)
{module_content}
{fix_block}
## YOUR TASK
Write exactly {QUIZ_QUESTIONS} questions that test understanding of THIS module only.

STRICT RULES:
- Question types: "multiple_choice" (exactly 4 options) and "short_answer" (empty options list).
- Include AT LEAST 1 multiple_choice and AT LEAST 1 short_answer question.
- For multiple_choice:
  - "answer" must be the EXACT text of one of the options (character-for-character).
  - Exactly ONE option is correct. No other option may be a paraphrase, synonym, or restatement of the correct answer.
  - All distractors must be defensibly wrong — plausible but verifiably incorrect against the module content.
  - All 4 options must be unique non-empty strings.
- For short_answer: "options" must be []; "answer" is a concise model answer.
- Every question must have a non-empty "explanation".
- Across the {QUIZ_QUESTIONS} questions, cover at least 2 different concepts from the list.
- Only test material actually present in the module content above. Do not invent facts.
- Match the audience reading level and tone.

Output ONLY this JSON (no text before or after):
```json
{{
  "module_number": {module_number},
  "module_title": "{module_title}",
  "questions": [
    {{
      "question": "...",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "answer": "the correct option text",
      "explanation": "why this is correct"
    }},
    {{
      "question": "...",
      "type": "short_answer",
      "options": [],
      "answer": "model answer",
      "explanation": "what a good answer should include"
    }}
  ]
}}
```"""


# ─── Final assignment prompt (one per course) ────────────────────────────────

def build_final_assignment_prompt(
    plan,
    sections_summary: str,
    concepts: List[str],
    prior_summaries: str = "",
) -> str:
    style_block = format_style_block(plan.style)
    objectives = "\n".join(f"  - {o}" for o in plan.learning_objectives) or "  - (derive from the course)"
    concepts_block = ", ".join(concepts) or "the concepts taught across the course"
    summaries_block = prior_summaries.strip() or "(no detailed summaries available)"
    return f"""You are an expert instructional designer. Design ONE capstone final assignment for the whole course.

## COURSE
Title: {plan.title} | Audience: {plan.target_audience} | Level: {plan.skill_level}
Description: {plan.description}

## COURSE LEARNING OBJECTIVES
{objectives}

{style_block}

## ALL CONCEPTS TAUGHT
{concepts_block}

## SECTIONS COVERED (structure)
{sections_summary}

## WHAT EACH SECTION ACTUALLY TAUGHT
Ground the assignment in what was actually covered. Do NOT assume content beyond what appears below.
{summaries_block}

## YOUR TASK
Design a single, cohesive capstone assignment that requires applying concepts from across the WHOLE course
(not just one module). It should be realistic, achievable for the stated audience, and tied to the learning objectives.

Output ONLY this JSON (no text before or after):
```json
{{
  "title": "assignment title",
  "overview": "1-2 paragraph description of the assignment and its goal",
  "tasks": ["concrete step 1", "concrete step 2", "concrete step 3"],
  "deliverables": ["what the learner submits"],
  "evaluation_criteria": ["how it will be graded"],
  "estimated_hours": 4
}}
```"""
