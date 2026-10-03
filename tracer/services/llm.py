"""
TRACER AI v2 - LLM Service
Groq API client with JSON mode, timeout, retries, and error mapping.
"""
import logging
import time
from typing import Optional
from groq import Groq
from groq import RateLimitError, AuthenticationError, APITimeoutError, APIError

from tracer.config import Config

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Base exception for LLM errors with user-friendly codes"""
    def __init__(self, code: str, message: str, original_error: Optional[Exception] = None):
        self.code = code
        self.message = message
        self.original_error = original_error
        super().__init__(message)


class LLMClient:
    """
    Groq API client with:
    - JSON mode (response_format: json_object)
    - Explicit 30s timeout
    - Bounded retries (max 2 retries = 3 total attempts)
    - Specific error mapping for user-friendly messages
    """
    
    def __init__(self):
        if not Config.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not configured")
        
        self.client = Groq(
            api_key=Config.GROQ_API_KEY,
            timeout=Config.GROQ_TIMEOUT
        )
        self.model = Config.MODEL_NAME
        self.temperature = Config.TEMPERATURE
        self.max_tokens = Config.MAX_OUTPUT_TOKENS
        self.max_retries = Config.GROQ_MAX_RETRIES
        
        logger.info(f"LLM client initialized: model={self.model}, timeout={Config.GROQ_TIMEOUT}s")
    
    def call(self, system_prompt: str, user_prompt: str, request_id: str) -> str:
        """
        Call Groq API with JSON mode and retry logic.
        
        Args:
            system_prompt: System instructions
            user_prompt: User code and instructions
            request_id: Request ID for logging (never log the actual code)
        
        Returns:
            Raw JSON string from the model
        
        Raises:
            LLMError: With user-friendly error code and message
        """
        attempt = 0
        last_error = None
        
        while attempt <= self.max_retries:
            try:
                logger.info(f"[{request_id}] LLM call attempt {attempt + 1}/{self.max_retries + 1}")
                
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    response_format={"type": "json_object"}  # Force JSON mode
                )
                
                content = completion.choices[0].message.content
                
                if not content:
                    raise LLMError(
                        "LLM_UNAVAILABLE",
                        "The AI model returned an empty response. Please try again."
                    )
                
                logger.info(f"[{request_id}] LLM call succeeded, response length: {len(content)} chars")
                return content
            
            except AuthenticationError as e:
                # Don't retry auth errors
                logger.error(f"[{request_id}] Authentication failed: {e}")
                raise LLMError(
                    "LLM_AUTH_ERROR",
                    "API authentication failed. Please contact support.",
                    e
                )
            
            except RateLimitError as e:
                logger.warning(f"[{request_id}] Rate limited: {e}")
                raise LLMError(
                    "LLM_RATE_LIMITED",
                    "The AI service is temporarily unavailable due to high demand. Please try again in a few moments.",
                    e
                )
            
            except APITimeoutError as e:
                last_error = e
                logger.warning(f"[{request_id}] Timeout on attempt {attempt + 1}: {e}")
                
                if attempt < self.max_retries:
                    wait_time = 1 * (attempt + 1)  # Linear backoff: 1s, 2s
                    logger.info(f"[{request_id}] Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    attempt += 1
                else:
                    raise LLMError(
                        "LLM_TIMEOUT",
                        "The analysis took too long. Please try with a smaller code snippet.",
                        e
                    )
            
            except APIError as e:
                last_error = e
                logger.warning(f"[{request_id}] API error on attempt {attempt + 1}: {e}")
                
                if attempt < self.max_retries:
                    wait_time = 1 * (attempt + 1)
                    logger.info(f"[{request_id}] Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    attempt += 1
                else:
                    raise LLMError(
                        "LLM_UNAVAILABLE",
                        "The AI service is temporarily unavailable. Please try again later.",
                        e
                    )
            
            except Exception as e:
                # Unexpected errors
                logger.exception(f"[{request_id}] Unexpected error: {e}")
                raise LLMError(
                    "LLM_UNAVAILABLE",
                    "An unexpected error occurred. Please try again.",
                    e
                )
        
        # Should not reach here, but just in case
        raise LLMError(
            "LLM_UNAVAILABLE",
            "Failed to get a response after multiple attempts.",
            last_error
        )


# Singleton instance
_llm_client = None


def get_llm_client() -> LLMClient:
    """Get or create the LLM client singleton"""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
