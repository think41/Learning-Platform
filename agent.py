import os
from groq import Groq
from dotenv import load_dotenv
from prompts import PLANNING_SYSTEM, planning_context, MAX_CLARIFICATION_ROUNDS

load_dotenv()

MODEL = "llama-3.3-70b-versatile"


class PlanningAgent:
    """
    Thread-based agent used ONLY during the planning phase.
    Tracks clarification rounds and forces a plan draft after MAX_CLARIFICATION_ROUNDS.
    Content generation is handled separately via stateless calls in generator.py.
    """

    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set — copy .env.example to .env and add your key.")
        self.client = Groq(api_key=api_key)
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

        response = self.client.chat.completions.create(
            model=MODEL,
            messages=self.messages,
            temperature=0.7,
            max_tokens=4096,
        )
        reply = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": reply})
        return reply

    def queue_upload(self, text: str, filename: str):
        self._pending_upload += f"\n\n--- {filename} ---\n{text}"

    @property
    def rounds_used(self) -> int:
        return self._rounds_used
