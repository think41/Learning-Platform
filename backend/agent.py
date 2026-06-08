import os
from typing import Optional
from dotenv import load_dotenv
from llm import get_llm
from prompts import PLANNING_SYSTEM, planning_context, MAX_CLARIFICATION_ROUNDS

load_dotenv()


def verify_plan_durations(plan: dict) -> Optional[str]:
    """Return a human-readable issue list if duration arithmetic is wrong, else None."""
    try:
        target = int(round(float(plan["total_duration_hours"]) * 60))
    except (KeyError, TypeError, ValueError):
        return None  # missing/non-numeric total — let normal validation handle it

    issues = []
    grand_total = 0
    for m in plan.get("modules", []):
        sub_sum = sum(int(s.get("duration_minutes", 0)) for s in m.get("submodules", []))
        mod_dur = int(m.get("duration_minutes", 0))
        if sub_sum != mod_dur:
            issues.append(
                f'- Module {m.get("number")} "{m.get("title")}": '
                f'submodules sum to {sub_sum} min but module.duration_minutes is {mod_dur}.'
            )
        grand_total += sub_sum

    if grand_total != target:
        issues.append(
            f"- Grand total: submodule durations across all modules sum to {grand_total} min, "
            f"but total_duration_hours × 60 = {target} min."
        )

    return "\n".join(issues) if issues else None


class PlanningAgent:
    """
    Thread-based agent used ONLY during the planning phase.
    Tracks clarification rounds and forces a plan draft after MAX_CLARIFICATION_ROUNDS.
    Content generation is handled separately via stateless calls in generator.py.
    """

    def __init__(self):
        self._llm = get_llm()
        self.messages = [{"role": "system", "content": PLANNING_SYSTEM}]
        self._rounds_used = 0
        self._pending_upload = ""

    def chat(self, user_message: str) -> str:
        rounds_remaining = max(0, MAX_CLARIFICATION_ROUNDS - self._rounds_used)
        context = planning_context(rounds_remaining, bool(self._pending_upload))

        content = user_message
        if self._pending_upload:
            content = (
                f"[REFERENCE MATERIAL — use to inform the plan]\n"
                f"{self._pending_upload}\n\n"
                f"[USER MESSAGE]\n{user_message}"
            )
            self._pending_upload = ""

        content += f"\n\n[{context}]"

        self.messages.append({"role": "user", "content": content})
        self._rounds_used += 1

        reply = self._llm.complete(self.messages, temperature=0.7, max_tokens=4096)
        self.messages.append({"role": "assistant", "content": reply})
        return reply

    def repair_plan_durations(self, issues: str) -> str:
        """
        Ask the LLM to re-emit the plan with corrected duration_minutes values.
        Used after verify_plan_durations() reports arithmetic mismatches.
        Does NOT count against clarification rounds.
        """
        prompt = (
            "[CONSTRAINT] Your previous plan has duration mismatches:\n"
            f"{issues}\n\n"
            "Re-emit the FULL plan JSON in the same ```json block, adjusting ONLY "
            "the `duration_minutes` fields so the arithmetic is exact. "
            "Do NOT change titles, descriptions, concepts, learning_objectives, "
            "lesson_count, or any other field. Keep `total_duration_hours` unchanged — "
            "redistribute time across submodules so they sum to exactly "
            "total_duration_hours * 60, and so each module's duration_minutes equals "
            "the sum of its own submodules."
        )
        self.messages.append({"role": "user", "content": prompt})
        reply = self._llm.complete(self.messages, temperature=0.3, max_tokens=4096)
        self.messages.append({"role": "assistant", "content": reply})
        return reply

    def queue_upload(self, text: str, filename: str):
        self._pending_upload += f"\n\n--- {filename} ---\n{text}"

    @property
    def rounds_used(self) -> int:
        return self._rounds_used
