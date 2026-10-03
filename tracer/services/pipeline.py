"""
TRACER AI v2 - Analysis Pipeline
Coordinates: preflight -> LLM -> validate -> verify -> repair -> result
"""
import json
import logging
import uuid
import time
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from tracer.config import Config
from tracer.services.schemas import (
    AnalyzeRequest, AnalyzeResponse, Meta, Verdict,
    Finding, SecurityItem, PerformanceItem, Verification
)
from tracer.services.llm import get_llm_client, LLMError
from tracer.services.verify import (
    verify_fixed_code, get_preflight_errors
)

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    """Pipeline-specific errors with user-friendly codes"""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def load_prompt_template(mode: str) -> str:
    """Load the system prompt for the given mode"""
    prompts_dir = Path(__file__).parent.parent / "prompts"
    prompt_file = prompts_dir / f"{mode}.md"
    
    if not prompt_file.exists():
        raise PipelineError(
            "INVALID_MODE",
            f"Unknown analysis mode: {mode}"
        )
    
    return prompt_file.read_text()


def build_user_prompt(code: str, language: str, preflight_errors: list) -> str:
    """
    Build the user prompt with clear delimiters.
    Code is wrapped in delimiters to prevent prompt injection.
    """
    prompt = "Analyze the following source code.\n\n"
    
    if preflight_errors:
        prompt += "VERIFIED ERRORS (from static analysis):\n"
        for err in preflight_errors:
            prompt += f"- Line {err['line']}: {err['type']} - {err['message']}\n"
        prompt += "\n"
    
    prompt += "==== BEGIN SOURCE CODE ====\n"
    prompt += code
    prompt += "\n==== END SOURCE CODE ====\n\n"
    prompt += "Return ONLY valid JSON matching the schema. No markdown, no fences."
    
    return prompt


def clamp_line_numbers(findings: list[Finding], max_line: int) -> list[Finding]:
    """
    Remove findings with hallucinated line numbers.
    This guards against the LLM making up line numbers outside the code bounds.
    """
    valid_findings = []
    
    for finding in findings:
        if finding.line_start < 1 or finding.line_start > max_line:
            logger.warning(f"Dropping finding {finding.id}: line_start {finding.line_start} out of bounds (1-{max_line})")
            continue
        if finding.line_end < 1 or finding.line_end > max_line:
            logger.warning(f"Dropping finding {finding.id}: line_end {finding.line_end} out of bounds (1-{max_line})")
            continue
        valid_findings.append(finding)
    
    return valid_findings


def parse_llm_response(raw_json: str, request_id: str) -> dict:
    """
    Parse and clean the LLM's JSON response.
    Handles markdown fences and validates JSON structure.
    """
    # Remove potential markdown fences
    cleaned = raw_json.strip()
    if cleaned.startswith("```"):
        # Remove first line if it's a fence
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"[{request_id}] JSON parse error: {e}")
        logger.error(f"[{request_id}] Raw response (first 500 chars): {raw_json[:500]}")
        raise PipelineError(
            "BAD_OUTPUT",
            "The AI returned invalid JSON. This might be a temporary issue. Please try again."
        )


def analyze_code(request: AnalyzeRequest) -> dict:
    """
    Main pipeline: analyze user code and return structured results.
    
    Pipeline stages:
    1. Preflight: size/empty checks, Python syntax verification
    2. LLM call: get analysis with JSON mode
    3. Validate: parse and validate with pydantic, clamp line numbers
    4. Verify: check if fixed_code parses (Python only)
    5. Repair: one retry if verification fails
    6. Result: return structured response
    
    Args:
        request: Validated AnalyzeRequest
    
    Returns:
        Dictionary matching AnalyzeResponse schema
    
    Raises:
        PipelineError: User-facing error with code and message
        LLMError: LLM-specific error with code and message
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    code = request.code.strip()
    language = request.language
    mode = request.mode
    
    # Log only metadata, NEVER the actual code
    code_size = len(code)
    line_count = code.count("\n") + 1
    logger.info(f"[{request_id}] Starting analysis: mode={mode}, language={language}, size={code_size} chars, lines={line_count}")
    
    # Stage 1: Preflight checks
    if not code:
        raise PipelineError("EMPTY", "No code provided")
    
    if code_size > Config.MAX_CODE_LENGTH:
        raise PipelineError(
            "TOO_LARGE",
            f"Code exceeds maximum size of {Config.MAX_CODE_LENGTH} characters"
        )
    
    # Detect language if auto
    if language == "auto":
        # Language detection heuristics
        if "#include" in code and ("printf" in code or "scanf" in code):
            language = "c"
        elif "#include" in code or "std::" in code or "cout" in code or "cin" in code:
            language = "cpp"
        elif "def " in code or "import " in code or "from " in code:
            language = "python"
        elif "function" in code or "const " in code or "let " in code or "console.log" in code:
            language = "javascript"
        elif "public class" in code or "public static void" in code:
            language = "java"
        elif "SELECT " in code.upper() or "FROM " in code.upper():
            language = "sql"
        else:
            language = "unknown"
    
    # Get preflight errors (Python syntax check)
    preflight_errors = get_preflight_errors(code, language)
    
    # Stage 2: LLM call
    system_prompt = load_prompt_template(mode)
    user_prompt = build_user_prompt(code, language, preflight_errors)
    
    llm_client = get_llm_client()
    raw_response = llm_client.call(system_prompt, user_prompt, request_id)
    
    # Stage 3: Validate
    llm_data = parse_llm_response(raw_response, request_id)
    
    # Retry once if invalid
    try:
        # Build the full response structure
        findings_data = llm_data.get("findings", [])
        findings = [Finding(**f) for f in findings_data]
        
        # Clamp line numbers
        findings = clamp_line_numbers(findings, line_count)
        
        # Count severity
        counts = {"critical": 0, "warning": 0, "info": 0}
        for f in findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
        
        verdict = Verdict(
            headline=llm_data.get("verdict", {}).get("headline", f"{len(findings)} findings"),
            counts=counts
        )
        
        fixed_code = llm_data.get("fixed_code")
        
        # Stage 4: Verify fixed code
        verification = Verification(
            checked=False,
            passed=None,
            detail="Not verified",
            repaired=False
        )
        
        if fixed_code:
            verify_result = verify_fixed_code(fixed_code, language)
            verification.checked = verify_result.checked
            verification.passed = verify_result.passed
            verification.detail = verify_result.detail
            
            # Stage 5: Repair if verification failed
            if verification.checked and not verification.passed:
                logger.warning(f"[{request_id}] Verification failed: {verification.detail}. Attempting repair...")
                
                repair_prompt = (
                    f"The previous fix has a syntax error:\n{verification.detail}\n\n"
                    f"==== FAILED CODE ====\n{fixed_code}\n==== END FAILED CODE ====\n\n"
                    "Please provide a corrected version that parses successfully. "
                    "Return the same JSON structure with updated fixed_code."
                )
                
                try:
                    repair_response = llm_client.call(system_prompt, repair_prompt, request_id)
                    repair_data = parse_llm_response(repair_response, request_id)
                    repaired_code = repair_data.get("fixed_code")
                    
                    if repaired_code:
                        repair_verify = verify_fixed_code(repaired_code, language)
                        if repair_verify.checked and repair_verify.passed:
                            fixed_code = repaired_code
                            verification.passed = True
                            verification.detail = "Repaired successfully"
                            verification.repaired = True
                            logger.info(f"[{request_id}] Repair succeeded")
                        else:
                            # Repair failed, keep original
                            verification.detail = f"Repair failed: {repair_verify.detail}"
                            logger.warning(f"[{request_id}] Repair failed")
                except Exception as e:
                    logger.warning(f"[{request_id}] Repair attempt failed: {e}")
                    verification.detail = "Repair attempt failed"
        
        # Build response
        latency_ms = int((time.time() - start_time) * 1000)
        
        meta = Meta(
            request_id=request_id,
            language=language,
            mode=mode,
            model=Config.MODEL_NAME,
            latency_ms=latency_ms,
            verification=verification
        )
        
        # Parse security, performance, practices
        security_items = [SecurityItem(**s) for s in llm_data.get("security", [])]
        performance_items = [PerformanceItem(**p) for p in llm_data.get("performance", [])]
        practices = llm_data.get("practices", [])
        explanation = llm_data.get("explanation", "")
        
        response = AnalyzeResponse(
            schema_version=Config.SCHEMA_VERSION,
            meta=meta,
            verdict=verdict,
            findings=findings,
            fixed_code=fixed_code,
            security=security_items,
            performance=performance_items,
            practices=practices,
            explanation=explanation
        )
        
        logger.info(f"[{request_id}] Analysis complete: {len(findings)} findings, latency={latency_ms}ms")
        
        return response.model_dump()
    
    except ValidationError as e:
        logger.error(f"[{request_id}] Validation error: {e}")
        # Retry once
        logger.info(f"[{request_id}] Retrying with stricter prompt...")
        
        retry_prompt = user_prompt + "\n\nIMPORTANT: Your previous response had schema errors. Ensure all fields match the exact types and structure."
        
        try:
            raw_response = llm_client.call(system_prompt, retry_prompt, request_id)
            llm_data = parse_llm_response(raw_response, request_id)
            
            # Try parsing again (same logic, no recursion)
            findings = [Finding(**f) for f in llm_data.get("findings", [])]
            findings = clamp_line_numbers(findings, line_count)
            
            counts = {"critical": 0, "warning": 0, "info": 0}
            for f in findings:
                counts[f.severity] = counts.get(f.severity, 0) + 1
            
            verdict = Verdict(
                headline=llm_data.get("verdict", {}).get("headline", f"{len(findings)} findings"),
                counts=counts
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            meta = Meta(
                request_id=request_id,
                language=language,
                mode=mode,
                model=Config.MODEL_NAME,
                latency_ms=latency_ms,
                verification=Verification(checked=False, passed=None, detail="Not verified")
            )
            
            response = AnalyzeResponse(
                schema_version=Config.SCHEMA_VERSION,
                meta=meta,
                verdict=verdict,
                findings=findings,
                fixed_code=llm_data.get("fixed_code"),
                security=[SecurityItem(**s) for s in llm_data.get("security", [])],
                performance=[PerformanceItem(**p) for p in llm_data.get("performance", [])],
                practices=llm_data.get("practices", []),
                explanation=llm_data.get("explanation", "")
            )
            
            logger.info(f"[{request_id}] Retry succeeded")
            return response.model_dump()
        
        except Exception as retry_error:
            logger.error(f"[{request_id}] Retry failed: {retry_error}")
            raise PipelineError(
                "BAD_OUTPUT",
                "The AI returned malformed data twice. Please try again with different code."
            )
