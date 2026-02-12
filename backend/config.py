import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL")

# OpenRouter API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

# Models (both accessed through OpenRouter)
PASS1_MODEL = os.getenv("PASS1_MODEL", "openai/gpt-oss-120b")
PASS2_MODEL = os.getenv("PASS2_MODEL", "deepseek/deepseek-v3.2")

# Reddit JSON endpoint (no API key needed)
REDDIT_BASE_URL = "https://www.reddit.com"
REDDIT_USER_AGENT = "fraud-dashboard-research:v1.0 (educational project)"
REDDIT_REQUEST_DELAY = 2.0  # seconds between requests (1.0s hits 429 after ~100 sustained reqs)

# Processing
MAX_COMMENTS_PER_POST = int(os.getenv("MAX_COMMENTS_PER_POST", "5"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))
