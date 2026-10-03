"""
TRACER AI v2 - Pydantic Schemas
Request and response validation with strict typing.
"""
from typing import Literal, Optional, List
from pydantic import BaseModel, Field, field_validator


class AnalyzeRequest(BaseModel):
    """Request schema for code analysis"""
    code: str = Field(..., min_length=1, max_length=15000)
    language: str = Field(default="auto")
    mode: Literal["debug", "review", "explain"] = Field(default="debug")
    
    @field_validator("code")
    @classmethod
    def code_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Code cannot be empty")
        return v


class Finding(BaseModel):
    """A single issue or observation found in the code"""
    id: str
    severity: Literal["critical", "warning", "info"]
    category: str
    line_start: int = Field(ge=1)
    line_end: int = Field(ge=1)
    title: str
    root_cause: str
    fix_hint: str
    confidence: Literal["low", "medium", "high"]
    
    @field_validator("line_end")
    @classmethod
    def line_end_gte_start(cls, v: int, info) -> int:
        if "line_start" in info.data and v < info.data["line_start"]:
            raise ValueError("line_end must be >= line_start")
        return v


class SecurityItem(BaseModel):
    """Security vulnerability or concern"""
    issue: str
    risk: str
    solution: str


class PerformanceItem(BaseModel):
    """Performance optimization opportunity"""
    issue: str
    improvement: str


class Verification(BaseModel):
    """Verification metadata for the fixed code"""
    checked: bool
    passed: Optional[bool]
    detail: str
    repaired: bool = False


class Meta(BaseModel):
    """Response metadata"""
    request_id: str
    language: str
    mode: Literal["debug", "review", "explain"]
    model: str
    latency_ms: int
    verification: Verification


class Verdict(BaseModel):
    """Summary verdict of the analysis"""
    headline: str
    counts: dict[str, int]  # {"critical": 1, "warning": 2, "info": 0}


class AnalyzeResponse(BaseModel):
    """Complete response schema for analysis"""
    schema_version: int = 2
    meta: Meta
    verdict: Verdict
    findings: List[Finding]
    fixed_code: Optional[str] = None
    security: List[SecurityItem] = []
    performance: List[PerformanceItem] = []
    practices: List[str] = []
    explanation: str = ""


class ErrorResponse(BaseModel):
    """Error response schema"""
    success: Literal[False] = False
    code: str
    message: str
