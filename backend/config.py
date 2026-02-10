import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL")

# OpenRouter
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

# Reddit JSON endpoint (no API key needed)
REDDIT_BASE_URL = "https://www.reddit.com"
REDDIT_USER_AGENT = "fraud-dashboard-research:v1.0 (educational project)"
REDDIT_REQUEST_DELAY = 6.0  # seconds between requests (~10 req/min limit)

# Processing
RELEVANCE_CONFIDENCE_THRESHOLD = float(os.getenv("RELEVANCE_CONFIDENCE_THRESHOLD", "0.6"))
MAX_COMMENTS_PER_POST = int(os.getenv("MAX_COMMENTS_PER_POST", "20"))
LLM_BATCH_SIZE = int(os.getenv("LLM_BATCH_SIZE", "10"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))
