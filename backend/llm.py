"""
LLM factory — provider-agnostic interface.

Switch providers by setting LLM_PROVIDER in .env:
  LLM_PROVIDER=gemini    +  GEMINI_API_KEY=...
  LLM_PROVIDER=openai    +  OPENAI_API_KEY=...
  LLM_PROVIDER=claude    +  ANTHROPIC_API_KEY=...

Optionally pin a specific model:
  LLM_MODEL=gemini-1.5-pro
"""
import os
from abc import ABC, abstractmethod
from dotenv import load_dotenv
from config import PROVIDER_CONFIGS

load_dotenv()


class LLMClient(ABC):
    @abstractmethod
    def complete(self, messages: list, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        """
        messages: OpenAI-style list — [{"role": "system"|"user"|"assistant", "content": "..."}]
        Returns the assistant reply as a plain string.
        """


class GeminiClient(LLMClient):
    def __init__(self, model: str, api_key: str):
        from google import genai
        self._model = model
        self._client = genai.Client(api_key=api_key)

    def complete(self, messages: list, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        from google.genai import types

        system = next((m["content"] for m in messages if m["role"] == "system"), None)
        contents = [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part(text=m["content"])],
            )
            for m in messages
            if m["role"] != "system"
        ]
        response = self._client.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        return response.text


class OpenAIClient(LLMClient):
    def __init__(self, model: str, api_key: str):
        from openai import OpenAI
        self._model = model
        self._client = OpenAI(api_key=api_key)

    def complete(self, messages: list, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content


class GroqClient(LLMClient):
    def __init__(self, model: str, api_key: str):
        from groq import Groq
        self._model = model
        self._client = Groq(api_key=api_key)

    def complete(self, messages: list, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content


class ClaudeClient(LLMClient):
    def __init__(self, model: str, api_key: str):
        import anthropic
        self._model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def complete(self, messages: list, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        chat_messages = [m for m in messages if m["role"] != "system"]
        response = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=chat_messages,
        )
        return response.content[0].text


_REGISTRY = {
    "gemini": GeminiClient,
    "openai": OpenAIClient,
    "claude": ClaudeClient,
    "groq": GroqClient,
}


def get_llm() -> LLMClient:
    """Factory — reads LLM_PROVIDER from env and returns the right client."""
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider not in PROVIDER_CONFIGS:
        raise ValueError(
            f"Unknown LLM_PROVIDER={provider!r}. Valid options: {list(PROVIDER_CONFIGS)}"
        )
    cfg = PROVIDER_CONFIGS[provider]
    model = os.getenv("LLM_MODEL", cfg["model"])
    api_key = os.getenv(cfg["api_key_env"])
    if not api_key:
        raise ValueError(f"{cfg['api_key_env']} not set in .env")
    return _REGISTRY[provider](model=model, api_key=api_key)
