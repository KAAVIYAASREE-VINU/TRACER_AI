"""
TRACER AI v2 - API Routes
Endpoints: /api/analyze, /health
"""
import logging
from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from tracer.config import Config
from tracer.services.schemas import AnalyzeRequest, ErrorResponse
from tracer.services.pipeline import analyze_code, PipelineError
from tracer.services.llm import LLMError

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api')


def success_response(data: dict, status: int = 200):
    """Return successful JSON response"""
    return jsonify({"success": True, **data}), status


def error_response(code: str, message: str, status: int = 400):
    """Return error JSON response with friendly code"""
    return jsonify(ErrorResponse(code=code, message=message).model_dump()), status


@api_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Analyze user code.
    
    Request: {"code": "...", "language": "auto", "mode": "debug"}
    Response: AnalyzeResponse schema or ErrorResponse
    """
    try:
        # Parse request
        data = request.get_json(silent=True)
        
        if data is None:
            return error_response(
                "INVALID_REQUEST",
                "Request body must be valid JSON",
                400
            )
        
        # Validate with pydantic
        try:
            req = AnalyzeRequest(**data)
        except ValidationError as e:
            errors = e.errors()
            first_error = errors[0] if errors else {}
            field = first_error.get('loc', ['unknown'])[0]
            msg = first_error.get('msg', 'Invalid field')
            
            return error_response(
                "INVALID_REQUEST",
                f"Invalid {field}: {msg}",
                400
            )
        
        # Run pipeline
        result = analyze_code(req)
        
        return success_response(result)
    
    except PipelineError as e:
        logger.error(f"Pipeline error: {e.code} - {e.message}")
        status = 400
        if e.code == "TOO_LARGE":
            status = 413
        return error_response(e.code, e.message, status)
    
    except LLMError as e:
        logger.error(f"LLM error: {e.code} - {e.message}")
        status = 503
        if e.code == "LLM_RATE_LIMITED":
            status = 429
        elif e.code == "LLM_AUTH_ERROR":
            status = 500  # Don't expose auth details
        return error_response(e.code, e.message, status)
    
    except Exception as e:
        # Unexpected errors - never expose details to client
        logger.exception(f"Unexpected error in /analyze: {e}")
        return error_response(
            "INTERNAL_ERROR",
            "An unexpected error occurred. Please try again.",
            500
        )


@api_bp.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint.
    Returns: status, model, version (no secrets)
    """
    return success_response({
        "status": "healthy",
        "model": Config.MODEL_NAME,
        "version": Config.VERSION,
        "schema_version": Config.SCHEMA_VERSION
    })
