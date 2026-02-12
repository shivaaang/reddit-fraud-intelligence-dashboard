"""OpenRouter API clients for Pass 1 (GPT-OSS-120B) and Pass 2 (DeepSeek V3.2)."""

import json
import re
import time
import httpx
from backend.config import (
    OPENROUTER_API_KEY, OPENROUTER_BASE_URL,
    PASS1_MODEL, PASS2_MODEL,
    LLM_TEMPERATURE, LLM_MAX_RETRIES,
)
from backend.utils import setup_logger

log = setup_logger("llm_client")

# Pass 2 settings
DEEPSEEK_TIMEOUT = 120.0
DEEPSEEK_MAX_RETRIES = 3


# ============================================================
# JSON Parsing
# ============================================================

def _parse_json_response(text: str) -> dict | None:
    """Parse JSON from LLM response, handling code fences and common issues.

    Used by call_llm where responses are well-structured (json_schema format).
    """
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


def _extract_json(text: str) -> str | None:
    """Extract JSON from LLM response, handling thinking tokens and code fences.

    Used by call_deepseek where responses may include thinking tokens or
    other non-JSON content before the actual JSON object.
    """
    text = text.strip()

    # Strip markdown code fences
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # If response starts with non-JSON (thinking tokens), find the first {
    first_brace = text.find("{")
    if first_brace > 0:
        text = text[first_brace:]

    # Find the matching closing brace
    depth = 0
    for i, ch in enumerate(text):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                text = text[: i + 1]
                break

    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text if text.startswith("{") else None


# ============================================================
# Pass 1 Client: GPT-OSS-120B (structured JSON output)
# ============================================================

def call_llm(system_prompt: str, user_prompt: str, model: str = None,
             temperature: float = None, max_tokens: int = None,
             json_schema: dict = None,
             reasoning_effort: str = None) -> dict | None:
    """Call OpenRouter with json_schema structured output and return parsed JSON.

    Used by Pass 1 for boolean routing (is_fraud / is_idv).
    """
    model = model or PASS1_MODEL
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
    }

    if max_tokens is not None:
        body["max_tokens"] = max_tokens

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
                timeout=30.0,
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
            content = data["choices"][0]["message"].get("content") or ""

            if not content.strip():
                log.warning(f"Empty content from API (attempt {attempt})")
                if attempt < LLM_MAX_RETRIES:
                    time.sleep(2 * attempt)
                    continue
                return None

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


# ============================================================
# Pass 2 Client: DeepSeek V3.2 (json_object output)
# ============================================================

def call_deepseek(system_prompt: str, user_prompt: str,
                  reasoning: str = None) -> dict | None:
    """Call DeepSeek V3.2 via OpenRouter and return parsed JSON.

    Used by Pass 2 for deep classification (fraud type, IDV friction, etc.).
    Uses json_object response format with DeepSeek provider routing.
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": PASS2_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "provider": {
            "order": ["DeepSeek"],
            "allow_fallbacks": False,
        },
    }

    if reasoning:
        body["reasoning"] = {"effort": reasoning}

    for attempt in range(1, DEEPSEEK_MAX_RETRIES + 1):
        try:
            resp = httpx.post(
                OPENROUTER_BASE_URL,
                headers=headers,
                json=body,
                timeout=DEEPSEEK_TIMEOUT,
            )

            if resp.status_code == 429:
                wait = min(2 ** attempt * 3, 30)
                print(f"  [429] Rate limited, waiting {wait}s (attempt {attempt})")
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                print(f"  [ERR] Status {resp.status_code}: {resp.text[:200]}")
                if attempt < DEEPSEEK_MAX_RETRIES:
                    time.sleep(2 * attempt)
                    continue
                return None

            data = resp.json()
            content = data["choices"][0]["message"].get("content") or ""

            if not content.strip():
                print(f"  [EMPTY] Empty response (attempt {attempt})")
                if attempt < DEEPSEEK_MAX_RETRIES:
                    time.sleep(2)
                    continue
                return None

            json_str = _extract_json(content)
            if json_str is None:
                print(f"  [PARSE] No JSON found (attempt {attempt}): {content[:150]}")
                if attempt < DEEPSEEK_MAX_RETRIES:
                    time.sleep(1)
                    continue
                return None

            parsed = json.loads(json_str)
            return parsed

        except json.JSONDecodeError as e:
            print(f"  [JSON] Decode error (attempt {attempt}): {e}")
            if attempt < DEEPSEEK_MAX_RETRIES:
                time.sleep(1)
                continue
            return None
        except httpx.TimeoutException:
            print(f"  [TIMEOUT] Request timed out (attempt {attempt})")
            if attempt < DEEPSEEK_MAX_RETRIES:
                time.sleep(3 * attempt)
                continue
            return None
        except Exception as e:
            print(f"  [ERR] Unexpected: {e} (attempt {attempt})")
            if attempt < DEEPSEEK_MAX_RETRIES:
                time.sleep(2)
                continue
            return None

    return None
