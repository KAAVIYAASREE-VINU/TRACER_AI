"""
Unit tests for pipeline functions
"""
import pytest
from tracer.services.pipeline import clamp_line_numbers
from tracer.services.schemas import Finding


def test_clamp_line_numbers_valid():
    """Test that valid findings are kept"""
    findings = [
        Finding(
            id="F001", severity="critical", category="test",
            line_start=1, line_end=2,
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        ),
        Finding(
            id="F002", severity="warning", category="test",
            line_start=5, line_end=7,
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        )
    ]
    
    clamped = clamp_line_numbers(findings, max_line=10)
    assert len(clamped) == 2


def test_clamp_line_numbers_out_of_bounds_start():
    """Test that findings with line_start out of bounds are dropped"""
    # Create findings that pass pydantic validation but are outside the code bounds
    findings = [
        Finding(
            id="F001", severity="critical", category="test",
            line_start=1,  # Valid for pydantic but will be out of range for max_line=0
            line_end=2,
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        ),
        Finding(
            id="F002", severity="critical", category="test",
            line_start=15,  # Invalid: greater than max
            line_end=16,
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        )
    ]
    
    # Both should be dropped when max_line=10
    clamped = clamp_line_numbers(findings, max_line=0)
    assert len(clamped) == 0


def test_clamp_line_numbers_out_of_bounds_end():
    """Test that findings with line_end out of bounds are dropped"""
    findings = [
        Finding(
            id="F001", severity="critical", category="test",
            line_start=5,
            line_end=15,  # Invalid: greater than max
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        )
    ]
    
    clamped = clamp_line_numbers(findings, max_line=10)
    assert len(clamped) == 0


def test_clamp_line_numbers_mixed():
    """Test that only valid findings are kept"""
    findings = [
        Finding(
            id="F001", severity="critical", category="test",
            line_start=1, line_end=2,  # Valid
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        ),
        Finding(
            id="F002", severity="critical", category="test",
            line_start=50, line_end=51,  # Invalid
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        ),
        Finding(
            id="F003", severity="critical", category="test",
            line_start=8, line_end=9,  # Valid
            title="Test", root_cause="Test", fix_hint="Test", confidence="high"
        )
    ]
    
    clamped = clamp_line_numbers(findings, max_line=10)
    assert len(clamped) == 2
    assert clamped[0].id == "F001"
    assert clamped[1].id == "F003"
