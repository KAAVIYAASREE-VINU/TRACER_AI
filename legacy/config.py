"""
===========================================
TRACER AI Configuration
===========================================

Loads application configuration from the
environment and exposes a Config class.

Author: TRACER AI
"""

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------
# Project Root
# ---------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------
# Load .env
# ---------------------------------------------------

load_dotenv(BASE_DIR / ".env")


class Config:
    """
    Central configuration class for TRACER AI.
    """

    # ------------------------------------------------
    # Flask
    # ------------------------------------------------

    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        secrets.token_hex(32)
    )

    DEBUG = os.getenv(
        "DEBUG",
        "True"
    ).lower() == "true"

    HOST = os.getenv(
        "HOST",
        "127.0.0.1"
    )

    PORT = int(
        os.getenv(
            "PORT",
            5000
        )
    )

    # ------------------------------------------------
    # Groq
    # ------------------------------------------------

    GROQ_API_KEY = os.getenv(
        "GROQ_API_KEY",
        ""
    )

    MODEL_NAME = os.getenv(
        "MODEL_NAME",
        "llama-3.3-70b-versatile"
    )

    # ------------------------------------------------
    # Limits
    # ------------------------------------------------

    MAX_CODE_LENGTH = int(
        os.getenv(
            "MAX_CODE_LENGTH",
            50000
        )
    )

    MAX_OUTPUT_TOKENS = 2048

    TEMPERATURE = 0.2

    # ------------------------------------------------
    # Logging
    # ------------------------------------------------

    LOG_LEVEL = os.getenv(
        "LOG_LEVEL",
        "INFO"
    )

    LOG_DIRECTORY = BASE_DIR / "logs"

    LOG_DIRECTORY.mkdir(
        exist_ok=True
    )

    # ------------------------------------------------
    # Uploads
    # ------------------------------------------------

    UPLOAD_FOLDER = BASE_DIR / "uploads"

    UPLOAD_FOLDER.mkdir(
        exist_ok=True
    )

    ALLOWED_EXTENSIONS = {
        "py",
        "cpp",
        "c",
        "java",
        "js",
        "ts",
        "go",
        "rs",
        "php",
        "html",
        "css",
        "sql",
        "json"
    }

    # ------------------------------------------------
    # App Info
    # ------------------------------------------------

    APP_NAME = "TRACER AI"

    VERSION = "1.0.0"

    DESCRIPTION = (
        "AI Powered Code Analysis Platform"
    )