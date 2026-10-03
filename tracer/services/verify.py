"""
TRACER AI v2 - Verification Service
Deterministic code verification using AST parsing (Python only for now).
Never executes user code; parse-only verification.
"""
import ast
from typing import Optional, Tuple


class VerificationResult:
    """Result of deterministic verification"""
    def __init__(self, checked: bool, passed: Optional[bool], detail: str):
        self.checked = checked
        self.passed = passed
        self.detail = detail


def verify_python_syntax(code: str) -> Tuple[bool, Optional[str], Optional[int]]:
    """
    Verify Python code parses correctly using ast.parse.
    
    Returns:
        (is_valid, error_message, error_line)
    
    NEVER executes code; parse-only verification for security.
    """
    try:
        ast.parse(code)
        return True, None, None
    except SyntaxError as e:
        # Extract line number and message
        line = e.lineno if e.lineno else None
        message = str(e.msg) if hasattr(e, 'msg') else str(e)
        return False, message, line
    except Exception as e:
        # Other parse errors (encoding, etc.)
        return False, str(e), None


def verify_fixed_code(code: str, language: str) -> VerificationResult:
    """
    Verify that fixed code is syntactically valid.
    Currently only supports Python; other languages return "not verified".
    
    Args:
        code: The fixed code to verify
        language: Programming language (python, javascript, etc.)
    
    Returns:
        VerificationResult with checked, passed, and detail
    """
    language_lower = language.lower()
    
    if language_lower not in ["python", "py"]:
        # Not yet implemented for other languages
        return VerificationResult(
            checked=False,
            passed=None,
            detail=f"{language} verification not available"
        )
    
    # Python verification
    is_valid, error_msg, error_line = verify_python_syntax(code)
    
    if is_valid:
        return VerificationResult(
            checked=True,
            passed=True,
            detail="Parses cleanly"
        )
    else:
        detail = f"SyntaxError"
        if error_line:
            detail += f" at line {error_line}"
        if error_msg:
            detail += f": {error_msg}"
        
        return VerificationResult(
            checked=True,
            passed=False,
            detail=detail
        )


def get_preflight_errors(code: str, language: str) -> list[dict]:
    """
    Run deterministic checks before calling the LLM.
    For Python, detect syntax errors that can be passed as verified facts.
    
    Returns:
        List of verified error dictionaries
    """
    language_lower = language.lower()
    errors = []
    
    if language_lower in ["python", "py"]:
        is_valid, error_msg, error_line = verify_python_syntax(code)
        if not is_valid:
            errors.append({
                "line": str(error_line) if error_line else "unknown",
                "type": "SyntaxError",
                "message": error_msg or "Invalid syntax",
                "severity": "critical",
                "verified": True  # Mark as deterministically verified
            })
    
    return errors
