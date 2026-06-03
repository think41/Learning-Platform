import json
import re
from typing import Optional, Dict, Any


def extract_json(text: str) -> Optional[Dict[Any, Any]]:
    # Try ```json blocks first
    pattern = r'```json\s*(.*?)\s*```'
    matches = re.findall(pattern, text, re.DOTALL)
    for match in matches:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue

    # Fallback: find outermost { }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


def detect_phase_transition(text: str) -> Optional[str]:
    t = text.lower().strip()
    if 'finalize plan' in t:
        return 'content'
    if 'finalize content' in t:
        return 'assessments'
    if 'finalize assessments' in t:
        return 'export'
    return None


def is_ppt_data(data: Optional[Dict]) -> bool:
    return bool(data and data.get('type') == 'ppt')
