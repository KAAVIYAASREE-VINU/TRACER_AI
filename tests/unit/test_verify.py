"""
Unit tests for verification service
"""
import pytest
from tracer.services.verify import (
    verify_python_syntax,
    verify_fixed_code,
    get_preflight_errors
)


def test_verify_python_syntax_valid():
    """Test that valid Python code passes"""
    code = "x = 1\nprint(x)"
    is_valid, error_msg, error_line = verify_python_syntax(code)
    assert is_valid is True
    assert error_msg is None
    assert error_line is None


def test_verify_python_syntax_invalid():
    """Test that invalid Python code fails with line number"""
    code = "x = 1\nif x ==\nprint(x)"
    is_valid, error_msg, error_line = verify_python_syntax(code)
    assert is_valid is False
    assert error_msg is not None
    assert error_line == 2


def test_verify_fixed_code_python_valid():
    """Test verification of valid Python fixed code"""
    code = "def hello():\n    return 'world'"
    result = verify_fixed_code(code, "python")
    assert result.checked is True
    assert result.passed is True
    assert "Parses cleanly" in result.detail


def test_verify_fixed_code_python_invalid():
    """Test verification of invalid Python fixed code"""
    code = "def hello(\n    return 'world'"
    result = verify_fixed_code(code, "python")
    assert result.checked is True
    assert result.passed is False
    assert "SyntaxError" in result.detail


def test_verify_fixed_code_unsupported_language():
    """Test that unsupported languages return not verified"""
    code = "console.log('test');"
    result = verify_fixed_code(code, "javascript")
    assert result.checked is False
    assert result.passed is None
    assert "not available" in result.detail


def test_get_preflight_errors_valid():
    """Test preflight finds no errors in valid Python"""
    code = "x = 1\nprint(x)"
    errors = get_preflight_errors(code, "python")
    assert len(errors) == 0


def test_get_preflight_errors_syntax_error():
    """Test preflight finds syntax errors"""
    code = "x = 1\nif x ==\nprint(x)"
    errors = get_preflight_errors(code, "python")
    assert len(errors) == 1
    assert errors[0]["type"] == "SyntaxError"
    assert errors[0]["severity"] == "critical"
    assert errors[0]["verified"] is True


def test_get_preflight_errors_non_python():
    """Test preflight doesn't check non-Python languages"""
    code = "function test() { return; }"
    errors = get_preflight_errors(code, "javascript")
    assert len(errors) == 0
