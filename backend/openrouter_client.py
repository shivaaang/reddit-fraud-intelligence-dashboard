import json
import re
import time
import httpx
from backend.config import (
    OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL,
    LLM_TEMPERATURE, LLM_MAX_RETRIES,
)
from backend.utils import setup_logger

log = setup_logger("openrouter")


def _parse_json_response(text: str) -> dict | None:
    """Parse JSON from LLM response, handling code fences and common issues."""
    text = text.strip()

    # Strip markdown code fences
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def call_llm(system_prompt: str, user_prompt: str, model: str = None,
             temperature: float = None, max_tokens: int = 500,
             json_schema: dict = None,
             reasoning_effort: str = None) -> dict | None:
    """Call OpenRouter and return parsed JSON response.

    Args:
        json_schema: If provided, request structured output via response_format.
        reasoning_effort: Reasoning effort level — "none", "minimal", "low", "medium", "high".
    """
    model = model or OPENROUTER_MODEL
    temperature = temperature if temperature is not None else LLM_TEMPERATURE

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if json_schema:
        body["response_format"] = {
            "type": "json_schema",
            "json_schema": json_schema,
        }

    if reasoning_effort:
        body["reasoning"] = {"effort": reasoning_effort}

    for attempt in range(1, LLM_MAX_RETRIES + 1):
        try:
            resp = httpx.post(
                OPENROUTER_BASE_URL,
                headers=headers,
                json=body,
                timeout=90.0,
            )

            if resp.status_code == 429:
                wait = min(2 ** attempt * 5, 60)
                log.warning(f"Rate limited (429). Waiting {wait}s before retry {attempt}...")
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                log.error(f"OpenRouter error {resp.status_code}: {resp.text[:300]}")
                if attempt < LLM_MAX_RETRIES:
                    time.sleep(2 * attempt)
                    continue
                return None

            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = _parse_json_response(content)

            if parsed is None:
                log.warning(f"JSON parse failed (attempt {attempt}). Raw: {content[:200]}")
                if attempt < LLM_MAX_RETRIES:
                    time.sleep(1)
                    continue
                return None

            return parsed

        except httpx.TimeoutException:
            log.warning(f"Timeout on attempt {attempt}")
            if attempt < LLM_MAX_RETRIES:
                time.sleep(3 * attempt)
                continue
            return None
        except Exception as e:
            log.error(f"Unexpected error on attempt {attempt}: {e}")
            if attempt < LLM_MAX_RETRIES:
                time.sleep(2 * attempt)
                continue
            return None

    return None
