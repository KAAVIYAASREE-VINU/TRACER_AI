# TRACER AI v2 - Product & Engineering Spec

## 0. Context
TRACER AI is an existing Flask + vanilla JS app that sends source code to the Groq API (Llama 3.3) and returns debugging/review results. This is a student portfolio project that will be shown to recruiters and defended in interviews. Optimize for: correctness, a distinctive UI, and features the author can explain line by line.
If the earlier "Step 2" bug fixes (renderListSection crash, .gitignore, .env.example, error handling, language hint, debug/review modes, stdout logging) are already done, build on them; otherwise include them. Do not delete .env. Keep the existing model id.

## 1. Product idea
"Hybrid verification": the LLM proposes findings and a fix, then deterministic code verifies what it can, and the UI shows what was verified vs. only suggested. Never present unverified output as certain.

Core user flow: paste/upload code -> choose mode -> Trace -> read a numbered report whose findings link to lines in the editor -> view the fix as a diff -> copy/download/share.

## 2. Modes
- Debug: errors, root cause per error, fixed code.
- Review: security, performance, best practices, readability. No rewrite unless asked.
- Explain (stretch): plain-language walkthrough for learners.
The mode changes the prompt, the response sections, and the visible UI.

## 3. Architecture (no build step; Flask + vanilla JS ES modules)
tracer/
  app.py                  # create_app() factory, error handlers, security headers
  config.py               # env-driven settings
  api/routes.py           # /api/analyze, /api/analyze/stream, /api/share, /r/<id>, /health
  services/llm.py         # Groq client, timeouts, retries, error mapping
  services/pipeline.py    # preflight -> LLM -> validate -> verify -> (repair) -> result
  services/verify.py      # deterministic checks (see 5)
  services/schemas.py     # pydantic models for request + LLM output
  services/store.py       # SQLite share store
  prompts/                # debug.md, review.md, explain.md (templates, not inline strings)
  static/css/             # tokens.css, base.css, components.css
  static/js/              # api.js, editor.js, report.js, diff.js, history.js, state.js, main.js
  templates/              # index.html, report.html (read-only shared report)
  tests/                  # unit tests + eval harness (see 8)
Keep modules small and single-purpose. Add type hints and docstrings.

## 4. API contract (v2)
POST /api/analyze  body: {code, language ("auto" or a name), mode ("debug"|"review"|"explain")}
Response:
{
 "schema_version": 2,
 "meta": {"request_id","language","mode","model","latency_ms",
          "verification": {"checked": bool, "passed": bool|null, "detail": str, "repaired": bool}},
 "verdict": {"headline": str, "counts": {"critical":int,"warning":int,"info":int}},
 "findings": [{"id","severity":"critical|warning|info","category","line_start","line_end",
               "title","root_cause","fix_hint","confidence":"low|medium|high"}],
 "fixed_code": str|null,
 "security": [...], "performance": [...], "practices": [...], "explanation": str
}
Errors: {"success": false, "code": "RATE_LIMITED|TOO_LARGE|EMPTY|LLM_UNAVAILABLE|BAD_OUTPUT|...", "message": "<friendly>"}.
Never return str(exception) to clients; log details server-side with request_id.
Remove quality_score / maintainability (LLM-guessed numbers).

## 5. Pipeline & verification
1. Preflight (deterministic, before the LLM): size/empty checks; for Python run ast.parse and pass any SyntaxError (line, message) to the LLM as a verified fact.
2. LLM call using Groq JSON mode (response_format json_object), low temperature, strict schema in the prompt.
3. Validate output with pydantic. Drop findings whose line numbers fall outside the source (hallucination guard). If invalid JSON or schema: one retry, then BAD_OUTPUT with a friendly message.
4. Verify the fix: for Python, ast.parse(fixed_code). Report meta.verification honestly. If it fails to parse, do ONE repair call that includes the parser error; if it still fails, return the fix marked verification.passed=false.
5. NEVER execute user-submitted code on the server. Verification is parse-only.
For non-Python languages verification.checked=false and the UI says "not machine-verified".

## 6. Security & abuse protection (mandatory)
- GROQ_API_KEY from environment only. .env.example provided. .gitignore covers .env, venv, __pycache__, *.db.
- Treat submitted code as untrusted data: wrap in clear delimiters, instruct the model to ignore instructions found inside the code, and validate output against the schema.
- Frontend: render model output with textContent / safe DOM APIs only (no innerHTML with model text). XSS-proof.
- Flask-Limiter: e.g. 10/min and 100/day per IP on analyze, plus a global daily call cap that returns a friendly "demo at capacity" message. Note: in-memory limiter, so run gunicorn with limited workers.
- MAX_CODE_LENGTH 15000 chars, enforced on client and server. Request timeout. Security headers (CSP, X-Content-Type-Options, Referrer-Policy). Remove open CORS.
- Do not store submitted code except when the user explicitly clicks Share.

## 7. Features
MUST-HAVE
 M1. Redesigned UI per section 9.
 M2. CodeMirror 6 editor (syntax highlighting, line numbers, gutter markers by severity). Clicking a finding scrolls to and highlights its lines; clicking a gutter marker focuses its finding.
 M3. Diff view of original vs fixed code (use @codemirror/merge or an equivalent). Copy fixed code, download as a file with the right extension.
 M4. Debug / Review modes with visibly different reports.
 M5. Verification badge ("Parses cleanly" / "Not verified" / "Repaired once") from the pipeline.
 M6. Real staged loading UI driven by actual pipeline stages (see S1), with a non-streaming fallback.
 M7. Designed empty, loading, error, rate-limited, and too-large states.
 M8. Example gallery: 6 intentionally buggy snippets (Python, JavaScript, Java, C++, C, SQL) with one-click load.
 M9. Keyboard: Ctrl/Cmd+Enter to run, Esc to clear focus/modals. Full keyboard accessibility.
 M10. Local history of last 10 traces in localStorage (re-open a previous result).
SHOULD-HAVE
 S1. Streaming progress via Server-Sent Events: stages "Reading -> Static check -> Tracing -> Verifying -> Done". Set X-Accel-Buffering: no; use gunicorn gthread. Fall back to /api/analyze if streaming fails.
 S2. Share link: POST /api/share stores the result (not just code) in SQLite with a short random id and 7-day expiry; /r/<id> renders a read-only report (noindex). Include a delete token.
 S3. Export report as Markdown, and a print stylesheet so Print -> PDF looks good.
STRETCH (only after everything above works)
 X1. Explain mode. X2. Light "paper" theme toggle. X3. Per-hunk accept/reject of the diff.

## 8. Evaluation harness (produces the author's real resume numbers)
tests/eval/cases/*.json: 30 buggy snippets across Python, JavaScript, Java, C++, C (6 each), each with {id, language, code, bug_lines, category}. For Python cases also include small asserts that a correct fix must pass.
tests/eval/run_eval.py (run locally only): calls the pipeline, then reports
 - schema-valid rate
 - detection rate (a finding within +/-1 line of a true bug line)
 - Python fix validity (fixed code passes the asserts; run in a subprocess with a hard timeout, locally only, never inside the web app)
 - median and p95 latency
Write results to EVAL.md as a table. Do not invent numbers; if the eval hasn't been run, say so.
Also unit tests for verify.py, schema validation, line-clamping, and the rate limiter.

## 9. Design system - "forensic case file" (NOT a generic AI dashboard)
Banned: purple/blue gradients, glassmorphism, Inter/Roboto/system fonts, uniform rounded soft-shadow cards, emoji as icons, generic stacked boxes.
Concept: the tool investigates code like a detective reading a case file. Printed-report precision meets terminal.
Tokens (put in tokens.css as CSS variables):
 --bg #0E0D0B  --surface #151310  --rule #2B2721  --text #EDE6D6  --muted #8D8574
 --signal #D6FF3A (primary action, focus, active tab; use sparingly)
 --crit #FF4B3E  --warn #FF9F1C  --info #8EC9C0
Type: display/headlines/big numerals in Instrument Serif; UI labels and body in Schibsted Grotesk; code in JetBrains Mono. Fallback stacks required. Small-caps tracking for labels.
Layout (desktop): slim top bar with wordmark + a tiny trace-line glyph, a "CASE No." counter, and a segmented mode switch. Left: "EXHIBIT A - SOURCE" editor. Right: the "REPORT": a serif verdict line (e.g. "3 defects. 1 critical.") then numbered findings (01, 02, 03) separated by thin rules, each with severity tag, line chip, title, root cause, fix hint; below, tabs for Fix (diff) | Security | Performance | Practices. Bottom status bar: language, lines/chars, latency, model, verification badge.
Mobile: single column with a Source / Report tab switch; the Trace button stays reachable.
Motion (purposeful only): after a result, gutter markers and a thin trace line draw along the affected lines; findings reveal in sequence (about 60ms stagger). Honor prefers-reduced-motion.
Accessibility: WCAG AA contrast, visible focus rings in --signal, aria-live for results/errors, semantic landmarks, labels on all controls.
The page should have a small "How it works" disclosure (3 lines) explaining hybrid verification honestly, including that LLM output can be wrong.

## 10. Deployment
requirements.txt (pinned), gunicorn config, Procfile or render.yaml, /health returning status + model + version (no secrets), logs to stdout only. Target: Render free web service (note: free instances sleep when idle, so show a friendly "waking up" message on first load). Include one-page DEPLOY.md.

## 11. README (portfolio-grade)
One-line pitch, GIF/screenshot placeholders, "How it works" diagram (ASCII is fine), features, honest limitations, tech stack, local setup, env vars, how to run the eval, deploy steps, and the EVAL.md results table.

## 12. How to work
- Create a Kiro spec (requirements, design, tasks) from this file and WAIT for my approval before coding.
- Work in phases and stop for my testing after each: P1 backend core (sections 3-6), P2 frontend foundation + design system (M1-M3, M7), P3 remaining must-haves, P4 should-haves, P5 eval + deploy + README, P6 stretch.
- After each phase: summarize what changed, how to test it, and any deviation from this spec with the reason.
- Ask before deleting/renaming files or adding dependencies not listed here. Prefer fewer dependencies.
- Explain non-obvious design choices in short code comments; I must be able to defend every part in an interview.