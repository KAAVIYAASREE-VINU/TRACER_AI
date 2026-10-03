"""
Unit tests for pydantic schemas
"""
import pytest
from pydantic import ValidationError
from tracer.services.schemas import (
    AnalyzeRequest, Finding, AnalyzeResponse
)


def test_analyze_request_valid():
    """Test valid request creation"""
    req = AnalyzeRequest(
        code="x = 1",
        language="python",
        mode="debug"
    )
    assert req.code == "x = 1"
    assert req.language == "python"
    assert req.mode == "debug"


def test_analyze_request_defaults():
    """Test default values"""
    req = AnalyzeRequest(code="x = 1")
    assert req.language == "auto"
    assert req.mode == "debug"


def test_analyze_request_empty_code():
    """Test that empty code raises validation error"""
    with pytest.raises(ValidationError):
        AnalyzeRequest(code="")


def test_analyze_request_too_long():
    """Test that code exceeding max length raises error"""
    long_code = "x = 1\n" * 10000  # > 15000 chars
    with pytest.raises(ValidationError):
        AnalyzeRequest(code=long_code)


def test_analyze_request_invalid_mode():
    """Test that invalid mode raises error"""
    with pytest.raises(ValidationError):
        AnalyzeRequest(code="x = 1", mode="invalid")


def test_finding_valid():
    """Test valid finding creation"""
    finding = Finding(
        id="F001",
        severity="critical",
        category="syntax",
        line_start=1,
        line_end=3,
        title="Test error",
        root_cause="Because",
        fix_hint="Fix it",
        confidence="high"
    )
    assert finding.id == "F001"
    assert finding.line_start == 1
    assert finding.line_end == 3


def test_finding_line_validation():
    """Test that line_end must be >= line_start"""
    with pytest.raises(ValidationError):
        Finding(
            id="F001",
            severity="critical",
            category="syntax",
            line_start=5,
            line_end=3,  # Invalid: less than start
            title="Test",
            root_cause="Test",
            fix_hint="Test",
            confidence="high"
        )


def test_finding_invalid_severity():
    """Test that invalid severity raises error"""
    with pytest.raises(ValidationError):
        Finding(
            id="F001",
            severity="super-critical",  # Invalid
            category="syntax",
            line_start=1,
            line_end=1,
            title="Test",
            root_cause="Test",
            fix_hint="Test",
            confidence="high"
        )
