"""
Terminal REPL for the AI Learning Platform.

State machine:
  CLARIFYING   → agent asks questions (capped at MAX_CLARIFICATION_ROUNDS)
  PLAN_DRAFTED → plan JSON produced, waiting for approval or field edits
  CONTENT      → generating sections one by one (stateless calls, not thread)
  DONE         → all sections approved
"""
import os
import json
import sys

from agent import PlanningAgent
from generator import generate_section, run_critic, generate_ppt_slides
from store import PlanStore, SectionStore
from models import GeneratedSection, SectionStatus
from parser import extract_json
from ppt_generator import generate_ppt
from file_extractor import extract_text

DIVIDER = "─" * 64

STATE_CLARIFYING   = "clarifying"
STATE_PLAN_DRAFTED = "plan_drafted"
STATE_CONTENT      = "content"
STATE_DONE         = "done"

HELP = f"""
{DIVIDER}
COMMANDS
  /upload <path>      PDF / PPTX / DOCX / TXT → injected as reference material
  /status             Plan version, section statuses, concept count
  /export             Save plan + all sections to output/course_export.json
  /ppt <section-id>   Generate PPT for a section  (e.g. /ppt m1_s0)
  /reset              Start over
  /help               This message
  /quit               Exit

CONVERSATION KEYWORDS
  approve plan        Lock the plan and begin content generation
  approve section     Accept the current section and move to next
  revise: <note>      Regenerate current section with your feedback
{DIVIDER}"""


# ─── Display helpers ─────────────────────────────────────────────────────────

def banner():
    print(f"\n{DIVIDER}")
    print("  AI Learning Platform — Structured Course Builder")
    print(f"{DIVIDER}{HELP}")


def show_critic(report):
    label = "PASSED" if report.passed else "NEEDS ATTENTION"
    print(f"\n  ┌─ Critic report [{label}]")
    if report.flagged_claims:
        for c in report.flagged_claims:
            print(f"  │  ! claim  : {c}")
    if report.out_of_order_concepts:
        for c in report.out_of_order_concepts:
            print(f"  │  ! order  : {c}")
    if report.style_violations:
        for v in report.style_violations:
            print(f"  │  ! style  : {v}")
    if report.passed and not any([report.flagged_claims, report.out_of_order_concepts, report.style_violations]):
        print("  │  No issues found.")
    print("  └─\n")


def show_section(section):
    print(f"\n{'─'*64}")
    print(f"  {section.title}  [m{section.module_number}]")
    print(f"{'─'*64}")
    print(section.content)


# ─── Command handlers ─────────────────────────────────────────────────────────

def handle_upload(path: str, planning_agent, reference_store: list):
    path = path.strip().strip('"')
    try:
        text, filename, truncated = extract_text(path)
        if truncated:
            print("  [Note] File truncated to 15,000 chars.\n")
        reference_store.append(text)
        if planning_agent:
            planning_agent.queue_upload(text, filename)
        print(f"  [Uploaded] {filename} ({len(text):,} chars queued)\n")
        return text, filename
    except Exception as e:
        print(f"  [Upload Error] {e}\n")
        return None, None


def handle_export(plan_store: PlanStore, section_store: SectionStore):
    os.makedirs("output", exist_ok=True)
    payload = {
        "plan": plan_store._raw,
        "sections": {
            sid: {
                "content": s.content,
                "concepts_introduced": s.concepts_introduced,
                "status": s.status.value,
                "critic": (
                    {
                        "flagged_claims": s.critic_report.flagged_claims,
                        "out_of_order_concepts": s.critic_report.out_of_order_concepts,
                        "style_violations": s.critic_report.style_violations,
                        "passed": s.critic_report.passed,
                    }
                    if s.critic_report
                    else None
                ),
            }
            for sid, s in section_store.sections.items()
        },
    }
    out_path = "output/course_export.json"
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"  [Exported] {len(section_store.sections)} section(s) → {out_path}\n")


def handle_ppt(arg: str, section_store: SectionStore, plan_store: PlanStore):
    if not arg:
        print("  Usage: /ppt <section-id>  e.g. /ppt m1_s0\n")
        return
    if arg not in section_store.sections:
        ids = list(section_store.sections.keys()) or ["(none yet)"]
        print(f"  Section '{arg}' not found. Available: {', '.join(ids)}\n")
        return
    sec = section_store.sections[arg]
    print(f"  [Generating PPT for '{sec.title}'...]\n")
    try:
        style = plan_store.plan.style if plan_store.plan else None
        ppt_data = generate_ppt_slides(sec.content, sec.title, style)
        if ppt_data.get("type") == "ppt":
            path = generate_ppt(ppt_data)
            print(f"  [PPT saved] {path}\n")
        else:
            print("  [Could not parse PPT response — try again]\n")
    except Exception as e:
        print(f"  [PPT Error] {e}\n")


# ─── Section generation step ─────────────────────────────────────────────────

def generate_next_section(briefs, brief_index, plan_store, section_store, reference_material):
    """Generate, critique, and display one section. Returns the GeneratedSection."""
    b = briefs[brief_index]
    ref_text = "\n\n".join(reference_material)

    print(f"\n  [Generating] Module {b.module_number} — {b.title}")
    print(f"  Concepts to cover: {', '.join(b.concepts_to_cover) or 'TBD'}\n")

    content, concepts = generate_section(
        plan_store.plan,
        b,
        section_store.concepts_introduced,
        section_store.get_summary(),
        ref_text,
    )

    sid = f"m{b.module_number}_s{b.submodule_index}"

    print(f"  [Critic reviewing '{b.title}'...]\n")
    critic = run_critic(content, b, section_store.concepts_introduced, plan_store.plan)

    section = GeneratedSection(
        id=sid,
        module_number=b.module_number,
        title=b.title,
        content=content,
        concepts_introduced=concepts,
        status=SectionStatus.CRITIC_REVIEWED,
        critic_report=critic,
    )

    show_section(section)
    show_critic(critic)
    print("  Type **approve section** to accept, or **revise: <note>** to regenerate.\n")
    return section


# ─── Main loop ────────────────────────────────────────────────────────────────

def main():
    banner()

    try:
        planning_agent = PlanningAgent()
    except ValueError as e:
        print(f"[Startup Error] {e}")
        sys.exit(1)

    plan_store      = PlanStore()
    section_store   = SectionStore()
    reference_material: list = []
    state           = STATE_CLARIFYING
    briefs          = []
    brief_index     = 0
    current_section = None

    # Opening message
    reply = planning_agent.chat(
        "Hello! Briefly introduce yourself and ask what course the user wants to build."
    )
    print(f"\nAgent: {reply}\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        # ── Commands ──────────────────────────────────────────────────────
        if user_input.startswith("/"):
            parts = user_input.split(maxsplit=1)
            cmd, arg = parts[0].lower(), (parts[1] if len(parts) > 1 else "")

            if cmd == "/quit":
                print("Goodbye!")
                break

            elif cmd == "/upload":
                if arg:
                    agent_ref = planning_agent if state in (STATE_CLARIFYING, STATE_PLAN_DRAFTED) else None
                    text, filename = handle_upload(arg, agent_ref, reference_material)
                    if text and state in (STATE_CLARIFYING, STATE_PLAN_DRAFTED):
                        reply = planning_agent.chat(
                            f"I just uploaded '{filename}'. Acknowledge it and factor it into the plan."
                        )
                        print(f"\nAgent: {reply}\n")
                else:
                    print("  Usage: /upload <file_path>\n")

            elif cmd == "/status":
                print(f"\n  State          : {state}")
                if plan_store.plan:
                    print(f"  Plan version   : v{plan_store.plan.version}")
                    print(f"  Plan title     : {plan_store.plan.title}")
                print(f"  Sections       : {len(section_store.sections)}")
                stale = section_store.stale_count()
                if stale:
                    print(f"  Stale sections : {stale}  ← plan changed, needs regeneration")
                print(f"  Concepts known : {len(section_store.concepts_introduced)}")
                if section_store.sections:
                    print(f"\n  Section statuses:")
                    print(section_store.get_summary())
                print()

            elif cmd == "/export":
                handle_export(plan_store, section_store)

            elif cmd == "/ppt":
                handle_ppt(arg, section_store, plan_store)

            elif cmd == "/reset":
                confirm = input("  Reset all progress? (y/n): ").strip().lower()
                if confirm == "y":
                    planning_agent   = PlanningAgent()
                    plan_store       = PlanStore()
                    section_store    = SectionStore()
                    reference_material = []
                    state            = STATE_CLARIFYING
                    briefs           = []
                    brief_index      = 0
                    current_section  = None
                    print("  [Reset complete]\n")
                    reply = planning_agent.chat(
                        "Hello! Ask what course the user wants to build."
                    )
                    print(f"\nAgent: {reply}\n")

            elif cmd == "/help":
                print(HELP)

            else:
                print(f"  Unknown command: {cmd}. Type /help.\n")
            continue

        # ── Planning states ───────────────────────────────────────────────
        if state in (STATE_CLARIFYING, STATE_PLAN_DRAFTED):

            if "approve plan" in user_input.lower():
                if not plan_store.plan:
                    print("  [No plan drafted yet — keep chatting with the agent]\n")
                    continue

                # 08: any stale sections from a prior plan edit get discarded concepts
                if section_store.stale_count():
                    print(f"  [{section_store.stale_count()} stale section(s) discarded — plan was updated]\n")
                    section_store.mark_all_stale()

                state       = STATE_CONTENT
                briefs      = plan_store.section_briefs()
                brief_index = 0
                total       = len(briefs)
                print(f"\n  [Plan v{plan_store.plan.version} approved — {total} section(s) to generate]\n")

                if briefs:
                    current_section = generate_next_section(
                        briefs, brief_index, plan_store, section_store, reference_material
                    )
                else:
                    print("  [Plan has no submodules — add some and re-approve]\n")
                    state = STATE_PLAN_DRAFTED
                continue

            # Regular planning chat
            reply = planning_agent.chat(user_input)
            print(f"\nAgent: {reply}\n")

            # 08: detect plan JSON in reply — auto-version and mark stale if sections exist
            data = extract_json(reply)
            if data and "modules" in data:
                had_sections = bool(section_store.sections)
                plan_store.approve(data)
                if had_sections:
                    section_store.mark_all_stale()
                    print(
                        f"  [Plan updated to v{plan_store.plan.version} — "
                        f"{section_store.stale_count()} section(s) marked stale]\n"
                    )
                else:
                    print(
                        f"  [Plan v{plan_store.plan.version} ready — "
                        f"type 'approve plan' to begin content generation]\n"
                    )
                state = STATE_PLAN_DRAFTED

        # ── Content generation state ──────────────────────────────────────
        elif state == STATE_CONTENT:

            if "approve section" in user_input.lower():
                if current_section:
                    section_store.add(current_section)
                    section_store.approve_section(current_section.id)
                    print(f"  ['{current_section.title}' approved]\n")
                    brief_index += 1

                if brief_index >= len(briefs):
                    state = STATE_DONE
                    print(f"  [All {len(briefs)} section(s) complete!]\n")
                    print("  Use /export to save everything, or /ppt <section-id> for slides.\n")
                else:
                    current_section = generate_next_section(
                        briefs, brief_index, plan_store, section_store, reference_material
                    )

            elif user_input.lower().startswith("revise:"):
                note = user_input[7:].strip()
                if not note:
                    print("  Usage: revise: <your feedback>\n")
                    continue
                if current_section and brief_index < len(briefs):
                    b = briefs[brief_index]
                    ref_text = "\n\n".join(reference_material)
                    augmented = ref_text + f"\n\n[INSTRUCTOR REVISION NOTE]: {note}"
                    print(f"\n  [Regenerating with note: {note}]\n")
                    content, concepts = generate_section(
                        plan_store.plan, b,
                        section_store.concepts_introduced,
                        section_store.get_summary(),
                        augmented,
                    )
                    sid = f"m{b.module_number}_s{b.submodule_index}"
                    critic = run_critic(content, b, section_store.concepts_introduced, plan_store.plan)
                    current_section = GeneratedSection(
                        id=sid, module_number=b.module_number, title=b.title,
                        content=content, concepts_introduced=concepts,
                        status=SectionStatus.CRITIC_REVIEWED, critic_report=critic,
                    )
                    show_section(current_section)
                    show_critic(critic)
                    print("  Type **approve section** or **revise: <note>**.\n")
                else:
                    print("  [No section to revise]\n")

            else:
                print("  Type **approve section** or **revise: <your note>**\n")

        elif state == STATE_DONE:
            print("  Course complete. Use /export or /ppt <section-id>.\n")


if __name__ == "__main__":
    main()
