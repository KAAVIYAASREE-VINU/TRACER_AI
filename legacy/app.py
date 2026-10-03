"""
=========================================================
TRACER AI
Main Flask Application

Author : TRACER AI
Version : 1.0
=========================================================
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
)

from flask_cors import CORS

from config import Config
from ai_engine import AIEngine
ai_engine = AIEngine()


# ==========================================================
# Flask App
# ==========================================================

app = Flask(__name__)

app.config["SECRET_KEY"] = Config.SECRET_KEY

app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CODE_LENGTH

CORS(app)


# ==========================================================
# Logging
# ==========================================================

LOG_FILE = Path(Config.LOG_DIRECTORY) / "app.log"

handler = RotatingFileHandler(

    LOG_FILE,

    maxBytes=1_000_000,

    backupCount=5,

)

formatter = logging.Formatter(

    "[%(asctime)s] %(levelname)s : %(message)s"

)

handler.setFormatter(formatter)

logger = logging.getLogger("TRACER_AI")

logger.setLevel(

    getattr(

        logging,

        Config.LOG_LEVEL.upper(),

        logging.INFO,

    )

)

if not logger.handlers:

    logger.addHandler(handler)

logger.info("=" * 60)

logger.info("TRACER AI Server Starting")

logger.info("=" * 60)


# ==========================================================
# Helper Responses
# ==========================================================

def success_response(
    data,
    status=200,
):

    return jsonify(

        {

            "success": True,

            "data": data,

        }

    ), status


def error_response(

    message,

    status=400,

):

    return jsonify(

        {

            "success": False,

            "message": message,

        }

    ), status


# ==========================================================
# Routes
# ==========================================================

@app.route("/")

def home():

    """
    Render Dashboard.
    """

    logger.info("Homepage Loaded")

    return render_template("index.html")

# ==========================================================
# Health Check
# ==========================================================

@app.route("/health", methods=["GET"])
def health():

    logger.info("Health check requested.")

    return success_response(
        ai_engine.health_check()
    )


# ==========================================================
# Analyze Code API
# ==========================================================

@app.route(
    "/api/analyze",
    methods=["POST"],
)
def analyze():

    try:

        payload = request.get_json(
            silent=True
        )

        if payload is None:

            return error_response(
                "Request body must be valid JSON.",
                400,
            )

        code = payload.get(
            "code",
            "",
        )

        if not isinstance(code, str):

            return error_response(
                "Code must be a string.",
                400,
            )

        code = code.strip()

        if not code:

            return error_response(
                "No source code provided.",
                400,
            )

        if len(code) > Config.MAX_CODE_LENGTH:

            return error_response(
                (
                    f"Source code exceeds "
                    f"{Config.MAX_CODE_LENGTH} characters."
                ),
                413,
            )

        logger.info(
            "Starting AI analysis..."
        )

        result = ai_engine.analyze_code(
            code
        )

        logger.info(
            "Analysis completed successfully."
        )

        return success_response(result)

    except Exception as exc:

        logger.exception(
            "Unexpected error during analysis."
        )

        return error_response(
            str(exc),
            500,
        )


# ==========================================================
# Continue in Part 3
# ==========================================================

# ==========================================================
# Global Error Handlers
# ==========================================================

@app.errorhandler(404)
def not_found(error):

    logger.warning(
        "404 - Resource not found."
    )

    return error_response(
        "Requested resource was not found.",
        404,
    )


@app.errorhandler(405)
def method_not_allowed(error):

    logger.warning(
        "405 - Method not allowed."
    )

    return error_response(
        "Method not allowed.",
        405,
    )


@app.errorhandler(413)
def payload_too_large(error):

    logger.warning(
        "413 - Payload too large."
    )

    return error_response(
        (
            "Source code exceeds the "
            "maximum allowed size."
        ),
        413,
    )


@app.errorhandler(500)
def internal_server_error(error):

    logger.exception(
        "500 - Internal Server Error."
    )

    return error_response(
        "Internal Server Error.",
        500,
    )


# ==========================================================
# Before Request
# ==========================================================

@app.before_request
def before_request():

    logger.info(
        "%s %s",
        request.method,
        request.path,
    )


# ==========================================================
# After Request
# ==========================================================

@app.after_request
def after_request(response):

    response.headers[
        "X-App-Name"
    ] = Config.APP_NAME

    response.headers[
        "X-App-Version"
    ] = Config.VERSION

    return response


# ==========================================================
# Continue in Part 4
# ==========================================================

# ==========================================================
# Application Banner
# ==========================================================

def print_banner():

    print("\n")

    print("=" * 60)

    print(f"{Config.APP_NAME} v{Config.VERSION}")

    print(Config.DESCRIPTION)

    print("=" * 60)

    print(f"Model   : {Config.MODEL_NAME}")

    print(f"Host    : {Config.HOST}")

    print(f"Port    : {Config.PORT}")

    print(f"Debug   : {Config.DEBUG}")

    print("=" * 60)

    print(
        f"Running at http://{Config.HOST}:{Config.PORT}"
    )

    print("=" * 60)

    print("\n")


# ==========================================================
# Main
# ==========================================================

if __name__ == "__main__":

    print_banner()

    logger.info(
        "Starting Flask application..."
    )

    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
    )

