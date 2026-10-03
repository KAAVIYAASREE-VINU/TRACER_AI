# Render Deployment

- **Runtime:** Python 3.12.13 (`runtime.txt`)
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn "app:create_app()" --worker-class gthread --workers 1 --threads 4 --timeout 60`
- **Health Check Path:** `/health`
- **Required env var:** `GROQ_API_KEY` (set in Render dashboard — never commit `.env`)
- Static assets (including `static/vendor/codemirror.bundle.js`) are committed; no build step needed.
