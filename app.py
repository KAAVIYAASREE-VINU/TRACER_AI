"""
TRACER AI v2 - Main Application
Flask factory with security headers, rate limiting, and error handlers.
"""
import logging
import sys
from flask import Flask, render_template, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from tracer.config import Config
from tracer.api.routes import api_bp


def create_app():
    """
    Flask application factory.
    Returns configured Flask app with security, rate limiting, and blueprints.
    """
    app = Flask(__name__, 
                template_folder='templates',
                static_folder='static')
    
    # Configuration
    app.config.from_object(Config)
    
    # Logging to stdout only
    # Log only: request_id, code size, mode, language, latency, error codes
    # NEVER log actual code content
    logging.basicConfig(
        level=getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO),
        format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
        stream=sys.stdout
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"Starting {Config.APP_NAME} v{Config.VERSION}")
    logger.info(f"Model: {Config.MODEL_NAME}, Max code length: {Config.MAX_CODE_LENGTH}")
    
    # Rate limiting
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        storage_uri=Config.RATELIMIT_STORAGE_URI,
        default_limits=[]  # No global limits, apply per-route
    )
    
    # Apply rate limits to analyze endpoint
    @limiter.limit(Config.RATELIMIT_PER_MINUTE)
    @limiter.limit(Config.RATELIMIT_PER_DAY)
    def analyze_with_limits():
        pass
    
    # Register blueprints
    app.register_blueprint(api_bp)
    
    # Security headers (applied to all responses)
    @app.after_request
    def add_security_headers(response):
        for header, value in Config.SECURITY_HEADERS.items():
            response.headers[header] = value
        return response
    
    # Error handlers - return friendly messages, never expose internals
    @app.errorhandler(404)
    def not_found(e):
        logger.warning(f"404 Not Found: {e}")
        return jsonify({
            "success": False,
            "code": "NOT_FOUND",
            "message": "The requested resource was not found"
        }), 404
    
    @app.errorhandler(405)
    def method_not_allowed(e):
        logger.warning(f"405 Method Not Allowed: {e}")
        return jsonify({
            "success": False,
            "code": "METHOD_NOT_ALLOWED",
            "message": "Method not allowed for this endpoint"
        }), 405
    
    @app.errorhandler(413)
    def payload_too_large(e):
        logger.warning(f"413 Payload Too Large: {e}")
        return jsonify({
            "success": False,
            "code": "TOO_LARGE",
            "message": f"Request exceeds maximum size of {Config.MAX_CODE_LENGTH} characters"
        }), 413
    
    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        logger.warning(f"429 Rate Limit Exceeded: {e}")
        return jsonify({
            "success": False,
            "code": "RATE_LIMITED",
            "message": "Too many requests. Please wait before trying again."
        }), 429
    
    @app.errorhandler(500)
    def internal_error(e):
        logger.exception(f"500 Internal Server Error: {e}")
        return jsonify({
            "success": False,
            "code": "INTERNAL_ERROR",
            "message": "An internal error occurred. Please try again later."
        }), 500
    
    # Main route
    @app.route('/')
    def index():
        """Render the main application page"""
        return render_template('index.html')
    
    # Apply rate limit decorator to the analyze route
    # We need to do this after blueprint registration
    analyze_view = app.view_functions.get('api.analyze')
    if analyze_view:
        app.view_functions['api.analyze'] = limiter.limit(Config.RATELIMIT_PER_MINUTE)(
            limiter.limit(Config.RATELIMIT_PER_DAY)(analyze_view)
        )
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )
