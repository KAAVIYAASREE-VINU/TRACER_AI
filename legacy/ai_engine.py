"""
=========================================================
TRACER AI
AI Engine

Handles all communication with the Groq API.

Author : TRACER AI
Version : 1.0
=========================================================
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Dict

from groq import Groq

from config import Config
from prompts import SYSTEM_PROMPT, build_user_prompt


class AIEngine:
    """
    Core AI engine responsible for communicating
    with the Groq API.
    """

    def __init__(self) -> None:

        self.logger = logging.getLogger("TRACER_AI")

        self.client = Groq(
            api_key=Config.GROQ_API_KEY
        )

        self.model = Config.MODEL_NAME

        self.temperature = Config.TEMPERATURE

        self.max_tokens = Config.MAX_OUTPUT_TOKENS

        self.logger.info(
            "AI Engine initialized successfully."
        )

    # =====================================================
    # Helpers
    # =====================================================

    def _default_response(self) -> Dict[str, Any]:

        return {
            "language": "Unknown",
            "summary": "",
            "errors": [],
            "explanation": "",
            "fixed_code": "",
            "security": [],
            "performance": [],
            "best_practices": [],
            "quality_score": 0,
            "maintainability": 0,
            "complexity": "Unknown",
            "suggestions": [],
        }

    def _clean_response(
        self,
        text: str,
    ) -> str:
        """
        Removes markdown formatting if returned
        accidentally by the model.
        """

        text = text.strip()

        text = re.sub(
            r"^```(?:json)?",
            "",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"```$",
            "",
            text,
        )

        return text.strip()

    def _extract_json(
        self,
        text: str,
    ) -> str:
        """
        Extract JSON object from response.
        """

        text = self._clean_response(text)

        start = text.find("{")

        end = text.rfind("}")

        if start == -1 or end == -1:

            raise ValueError(
                "JSON object not found."
            )

        return text[start:end + 1]

    def _parse_json(
        self,
        text: str,
    ) -> Dict[str, Any]:

        try:

            json_text = self._extract_json(text)

            return json.loads(json_text)

        except Exception as exc:

            self.logger.exception(exc)

            return self._default_response()

    # =====================================================
    # API Request
    # =====================================================

    def _request(
        self,
        prompt: str,
    ) -> str:

        retries = 3

        for attempt in range(retries):

            try:

                completion = (
                    self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {
                                "role": "system",
                                "content": SYSTEM_PROMPT,
                            },
                            {
                                "role": "user",
                                "content": prompt,
                            },
                        ],
                        temperature=self.temperature,
                        max_tokens=self.max_tokens,
                    )
                )

                return (
                    completion
                    .choices[0]
                    .message
                    .content
                )

            except Exception as exc:

                self.logger.warning(
                    f"Attempt {attempt + 1} failed: {exc}"
                )

                time.sleep(1)

        raise RuntimeError(
            "Unable to contact Groq API."
        )

    # =====================================================
    # Continue in Part 2
    # =====================================================

    def analyze_code(
        self,
        code: str,
    ) -> Dict[str, Any]:
        """
        Analyze user source code.
        """

        code = code.strip()

        if not code:

            response = self._default_response()

            response["summary"] = "No source code provided."

            response["suggestions"] = [
                "Paste some source code before clicking Analyze."
            ]

            return response

        if len(code) > Config.MAX_CODE_LENGTH:

            response = self._default_response()

            response["summary"] = (
                "Source code exceeds the maximum allowed size."
            )

            response["suggestions"] = [
                f"Maximum allowed size is {Config.MAX_CODE_LENGTH} characters."
            ]

            return response

        try:

            prompt = build_user_prompt(code)

            raw_response = self._request(prompt)

            parsed_response = self._parse_json(raw_response)

            validated_response = self._validate_response(
            parsed_response
            )

            return validated_response

        except Exception as exc:

            self.logger.exception(exc)

            response = self._default_response()

            response["summary"] = (
                "Failed to analyze the source code."
            )

            response["errors"] = [
                {
                    "line": "",
                    "type": "Runtime Error",
                    "message": str(exc),
                    "severity": "Critical",
                }
            ]

            response["suggestions"] = [
                "Verify your Groq API key.",
                "Check your internet connection.",
                "Try again later.",
            ]

            return response

    # =====================================================
    # Validation
    # =====================================================

    def _validate_response(
        self,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Ensure every required field exists.
        """

        defaults = self._default_response()

        if not isinstance(data, dict):

            return defaults

        for key, value in defaults.items():

            if key not in data:

                data[key] = value

        string_fields = [

            "language",

            "summary",

            "explanation",

            "fixed_code",

            "complexity",

        ]

        for field in string_fields:

            if not isinstance(data[field], str):

                data[field] = str(data[field])

        numeric_fields = [

            "quality_score",

            "maintainability",

        ]

        for field in numeric_fields:

            try:

                data[field] = int(data[field])

            except Exception:

                data[field] = 0

            data[field] = max(
                0,
                min(
                    100,
                    data[field],
                ),
            )

    # =====================================================
    # Continue in Part 3
    # =====================================================

            list_fields = [

            "errors",

            "security",

            "performance",

            "best_practices",

            "suggestions",

        ]

        for field in list_fields:

            if not isinstance(data[field], list):

                data[field] = []

        # --------------------------------------------
        # Normalize Errors
        # --------------------------------------------

        normalized_errors = []

        for error in data["errors"]:

            if not isinstance(error, dict):

                continue

            normalized_errors.append(
                {
                    "line": str(
                        error.get("line", "")
                    ),
                    "type": str(
                        error.get("type", "")
                    ),
                    "message": str(
                        error.get("message", "")
                    ),
                    "severity": str(
                        error.get(
                            "severity",
                            "Medium",
                        )
                    ),
                }
            )

        data["errors"] = normalized_errors

        # --------------------------------------------
        # Normalize Security
        # --------------------------------------------

        normalized_security = []

        for item in data["security"]:

            if not isinstance(item, dict):

                continue

            normalized_security.append(
                {
                    "issue": str(
                        item.get("issue", "")
                    ),
                    "risk": str(
                        item.get("risk", "")
                    ),
                    "solution": str(
                        item.get(
                            "solution",
                            "",
                        )
                    ),
                }
            )

        data["security"] = normalized_security

        # --------------------------------------------
        # Normalize Performance
        # --------------------------------------------

        normalized_performance = []

        for item in data["performance"]:

            if not isinstance(item, dict):

                continue

            normalized_performance.append(
                {
                    "issue": str(
                        item.get("issue", "")
                    ),
                    "improvement": str(
                        item.get(
                            "improvement",
                            "",
                        )
                    ),
                }
            )

        data["performance"] = normalized_performance

        data["best_practices"] = [
            str(item)
            for item in data["best_practices"]
        ]

        data["suggestions"] = [
            str(item)
            for item in data["suggestions"]
        ]

        return data

    # =====================================================
    # Health Check
    # =====================================================

    def health_check(self) -> Dict[str, Any]:

        try:

            return {
                "status": "healthy",
                "provider": "Groq",
                "model": self.model,
                "api_key_loaded": bool(
                    Config.GROQ_API_KEY
                ),
            }

        except Exception as exc:

            return {
                "status": "error",
                "message": str(exc),
            }

    # =====================================================
    # Continue in Part 4
    # =====================================================

        def __repr__(self) -> str:
            """
        String representation of the AI Engine.
        """

        return (
            f"<AIEngine "
            f"model='{self.model}' "
            f"provider='Groq'>"
        )


# =========================================================
# Singleton Instance
# =========================================================

ai_engine = AIEngine()
