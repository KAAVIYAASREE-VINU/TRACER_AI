"""
TRACER AI v2 - Configuration
Environment-driven settings for security, API, and app behavior.
"""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    """Central configuration for TRACER AI v2"""
    
    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", "5000"))
    
    # Groq API
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")
    GROQ_TIMEOUT = 30  # seconds
    GROQ_MAX_RETRIES = 2  # total attempts = 1 + retries = 3
    
    # Code limits
    MAX_CODE_LENGTH = 15000  # characters
    MAX_OUTPUT_TOKENS = 2048
    TEMPERATURE = 0.2
    
    # Rate limiting
    RATELIMIT_STORAGE_URI = "memory://"
    RATELIMIT_PER_MINUTE = "10/minute"
    RATELIMIT_PER_DAY = "100/day"
    RATELIMIT_GLOBAL_DAILY = 1000  # total calls per day across all IPs
    
    # Security headers
    # CSP allows only specific CDN hosts for CodeMirror and Google Fonts
    SECURITY_HEADERS = {
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "connect-src 'self';"
        ),
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "DENY"
    }
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # App metadata
    APP_NAME = "TRACER AI"
    VERSION = "2.0.0"
    SCHEMA_VERSION = 2
