# TRACER AI v2 - Kiro Spec

## Overview
Transform TRACER AI from a basic code analyzer into a portfolio-grade "hybrid verification" tool that combines LLM insights with deterministic code validation. The UI will adopt a distinctive "forensic case file" aesthetic rather than generic AI dashboard patterns.

**Core Innovation**: LLM proposes findings → deterministic verification checks what it can → UI clearly shows verified vs. suggested results. Never present unverified output as certain.

---

## Requirements

### R1. Product Requirements

#### R1.1 Core Functionality
- **R1.1.1**: Support three analysis modes: Debug (errors + fixes), Review (security/performance/practices), Explain (plain-language walkthrough)
- **R1.1.2**: Accept code via paste or file upload
- **R1.1.3**: Display findings as a numbered report where each finding links to source lines
- **R1.1.4**: Show fixed code as an interactive diff (added/removed lines)
- **R1.1.5**: Enable copy to clipboard and download fixed code as a file

#### R1.2 Verification Pipeline
- **R1.2.1**: Run deterministic preflight checks (Python: ast.parse for syntax errors)
- **R1.2.2**: Call Groq API with JSON mode, strict schema, low temperature
- **R1.2.3**: Validate LLM output with pydantic; drop hallucinated line numbers
- **R1.2.4**: Verify fixed code parses correctly (Python only initially)
- **R1.2.5**: Attempt ONE repair if verification fails, mark clearly if repair also fails
- **R1.2.6**: Never execute user code; parse-only verification
- **R1.2.7**: Report verification status honestly in UI ("Parses cleanly" / "Not verified" / "Repaired once")

#### R1.3 Security & Abuse Protection
- **R1.3.1**: Load GROQ_API_KEY from environment only
- **R1.3.2**: Create .env.example, comprehensive .gitignore
- **R1.3.3**: Treat code as untrusted data; use delimiters and schema validation
- **R1.3.4**: XSS-proof frontend (textContent only for model output, no innerHTML)
- **R1.3.5**: Rate limiting: 10/min, 100/day per IP; global daily cap
- **R1.3.6**: MAX_CODE_LENGTH 15000 chars (client + server)
- **R1.3.7**: Security headers (CSP, X-Content-Type-Options, Referrer-Policy)
- **R1.3.8**: Remove flask-cors entirely; no CORS middleware
- **R1.3.9**: Never return raw exceptions to clients; use friendly error codes
- **R1.3.10**: Never store or log submitted code except explicit Share; logs contain only request_id, code size, mode, language, latency, error codes
- **R1.3.11**: Groq API calls must have explicit 30s timeout and bounded retries (max 2)

#### R1.4 API Contract v2
- **R1.4.1**: POST /api/analyze with {code, language, mode}
- **R1.4.2**: Response includes schema_version:2, meta (request_id, latency, verification), verdict, findings, fixed_code
- **R1.4.3**: Findings include id, severity, category, line_start, line_end, title, root_cause, fix_hint, confidence
- **R1.4.4**: Error responses use codes: RATE_LIMITED, TOO_LARGE, EMPTY, LLM_UNAVAILABLE, BAD_OUTPUT
- **R1.4.5**: Remove quality_score/maintainability fields

### R2. Must-Have Features (M1-M10)

#### R2.1 UI Redesign (M1)
- **R2.1.1**: Implement "forensic case file" design language
- **R2.1.2**: Color palette: --bg #0E0D0B, --surface #151310, --signal #D6FF3A, severity colors
- **R2.1.3**: Typography: Instrument Serif (display), Schibsted Grotesk (UI), JetBrains Mono (code)
- **R2.1.4**: Layout: slim top bar, "EXHIBIT A" editor on left, "REPORT" on right
- **R2.1.5**: Numbered findings with thin rules, not stacked cards
- **R2.1.6**: Mobile: single column with Source/Report tabs

#### R2.2 CodeMirror 6 Editor (M2)
- **R2.2.1**: Syntax highlighting for all supported languages
- **R2.2.2**: Line numbers in gutter
- **R2.2.3**: Gutter markers showing severity (critical/warning/info)
- **R2.2.4**: Click finding → scroll to and highlight lines
- **R2.2.5**: Click gutter marker → focus corresponding finding

#### R2.3 Diff View (M3)
- **R2.3.1**: Show original vs fixed code with added/removed lines highlighted
- **R2.3.2**: Use @codemirror/merge or equivalent
- **R2.3.3**: Copy fixed code button
- **R2.3.4**: Download as file with correct extension

#### R2.4 Mode System (M4)
- **R2.4.1**: Debug mode: show errors, root causes, fixed code
- **R2.4.2**: Review mode: show security, performance, practices; no rewrite
- **R2.4.3**: Mode selector in top bar (segmented control)
- **R2.4.4**: Different report sections per mode

#### R2.5 Verification Badge (M5)
- **R2.5.1**: Display verification status in status bar
- **R2.5.2**: Three states: "Parses cleanly", "Not verified", "Repaired once"
- **R2.5.3**: Show verification detail on hover/click

#### R2.6 Loading States (M6)
- **R2.6.1**: Staged loading UI: Reading → Static check → Tracing → Verifying → Done
- **R2.6.2**: Progress indicator tied to actual pipeline stages
- **R2.6.3**: Animated trace line drawing along affected lines
- **R2.6.4**: Findings reveal sequentially (~60ms stagger)

#### R2.7 Designed States (M7)
- **R2.7.1**: Empty state: clear call-to-action
- **R2.7.2**: Error state: friendly message with actionable next steps
- **R2.7.3**: Rate limited state: "demo at capacity" message
- **R2.7.4**: Too large state: show size limit clearly

#### R2.8 Example Gallery (M8)
- **R2.8.1**: 6 buggy example snippets (Python, JavaScript, Java, C++, C, SQL)
- **R2.8.2**: One-click load into editor
- **R2.8.3**: Examples demonstrate different bug categories

#### R2.9 Keyboard Shortcuts (M9)
- **R2.9.1**: Ctrl/Cmd+Enter to run analysis
- **R2.9.2**: Esc to clear focus/close modals
- **R2.9.3**: Full keyboard navigation support
- **R2.9.4**: Visible focus rings using --signal color

#### R2.10 Local History (M10)
- **R2.10.1**: Store last 10 traces in localStorage
- **R2.10.2**: History panel to re-open previous results
- **R2.10.3**: Show timestamp, mode, language for each entry

### R3. Should-Have Features (S1-S3)

#### R3.1 Streaming Progress (S1)
- **R3.1.1**: Server-Sent Events for real-time stage updates
- **R3.1.2**: POST /api/analyze/stream endpoint
- **R3.1.3**: Set X-Accel-Buffering: no header
- **R3.1.4**: Fallback to non-streaming if SSE fails

#### R3.2 Share Links (S2)
- **R3.2.1**: POST /api/share stores result in SQLite
- **R3.2.2**: Generate short random ID with 7-day expiry
- **R3.2.3**: GET /r/<id> renders read-only report with noindex
- **R3.2.4**: Include delete token for user control

#### R3.3 Export Options (S3)
- **R3.3.1**: Export report as Markdown
- **R3.3.2**: Print stylesheet for PDF export
- **R3.3.3**: Preserve formatting and hierarchy

### R4. Stretch Features (X1-X3)
- **R4.1**: Explain mode implementation
- **R4.2**: Light "paper" theme toggle
- **R4.3**: Per-hunk accept/reject in diff view

### R5. Testing & Evaluation

#### R5.1 Evaluation Harness
- **R5.1.1**: 30 buggy test cases (6 each: Python, JavaScript, Java, C++, C)
- **R5.1.2**: Each case: {id, language, code, bug_lines, category}
- **R5.1.3**: Python cases include asserts for correct fixes
- **R5.1.4**: Eval script reports: schema-valid rate, detection rate, fix validity, latency
- **R5.1.5**: Output results to EVAL.md as table

#### R5.2 Unit Tests
- **R5.2.1**: Test verify.py functions
- **R5.2.2**: Test schema validation
- **R5.2.3**: Test line-clamping logic
- **R5.2.4**: Test rate limiter behavior

### R6. Deployment & Documentation

#### R6.1 Deployment
- **R6.1.1**: Pinned requirements.txt
- **R6.1.2**: Gunicorn config (gthread for SSE)
- **R6.1.3**: Procfile or render.yaml for Render deployment
- **R6.1.4**: /health endpoint with status, model, version
- **R6.1.5**: Logs to stdout only
- **R6.1.6**: DEPLOY.md with one-page instructions

#### R6.2 Documentation
- **R6.2.1**: README with one-line pitch, screenshots
- **R6.2.2**: "How it works" diagram (ASCII acceptable)
- **R6.2.3**: Features list, honest limitations
- **R6.2.4**: Tech stack, local setup instructions
- **R6.2.5**: Environment variables documentation
- **R6.2.6**: How to run eval harness
- **R6.2.7**: Include EVAL.md results table

---

## Design

### D1. Architecture

```
tracer/
├── app.py                      # Flask factory, error handlers, security headers
├── config.py                   # Environment-driven config
├── api/
│   └── routes.py              # /api/analyze, /api/analyze/stream, /api/share, /r/<id>, /health
├── services/
│   ├── llm.py                 # Groq client, timeouts, retries, error mapping
│   ├── pipeline.py            # preflight → LLM → validate → verify → repair → result
│   ├── verify.py              # Deterministic checks (ast.parse for Python)
│   ├── schemas.py             # Pydantic models for request + LLM output
│   └── store.py               # SQLite for share functionality
├── prompts/
│   ├── debug.md               # Debug mode prompt template
│   ├── review.md              # Review mode prompt template
│   └── explain.md             # Explain mode prompt template
├── static/
│   ├── css/
│   │   ├── tokens.css         # CSS variables (colors, spacing, typography)
│   │   ├── base.css           # Reset, layout, utilities
│   │   └── components.css     # Component-specific styles
│   └── js/
│       ├── api.js             # API communication layer
│       ├── editor.js          # CodeMirror setup and interactions
│       ├── report.js          # Report rendering logic
│       ├── diff.js            # Diff view handling
│       ├── history.js         # localStorage history management
│       ├── state.js           # Application state management
│       └── main.js            # Entry point, initialization
├── templates/
│   ├── index.html             # Main application page
│   └── report.html            # Read-only shared report view
└── tests/
    ├── eval/
    │   ├── cases/             # JSON test cases
    │   └── run_eval.py        # Evaluation harness
    └── unit/                  # Unit tests
```

### D2. API Design

#### Request Schema (v2)
```json
{
  "code": "string (required, max 15000 chars)",
  "language": "auto|python|javascript|java|cpp|c|sql",
  "mode": "debug|review|explain"
}
```

#### Response Schema (v2)
```json
{
  "schema_version": 2,
  "meta": {
    "request_id": "uuid",
    "language": "detected_language",
    "mode": "debug|review|explain",
    "model": "llama-3.3-70b-versatile",
    "latency_ms": 1234,
    "verification": {
      "checked": true,
      "passed": true|false|null,
      "detail": "Parses cleanly",
      "repaired": false
    }
  },
  "verdict": {
    "headline": "3 defects. 1 critical.",
    "counts": {
      "critical": 1,
      "warning": 1,
      "info": 1
    }
  },
  "findings": [
    {
      "id": "F001",
      "severity": "critical|warning|info",
      "category": "syntax|logic|security|performance|style",
      "line_start": 10,
      "line_end": 12,
      "title": "Undefined variable reference",
      "root_cause": "Variable 'count' used before assignment",
      "fix_hint": "Initialize 'count = 0' before the loop",
      "confidence": "high|medium|low"
    }
  ],
  "fixed_code": "string|null",
  "security": [...],
  "performance": [...],
  "practices": [...],
  "explanation": "string (explain mode only)"
}
```

#### Error Response
```json
{
  "success": false,
  "code": "RATE_LIMITED|TOO_LARGE|EMPTY|LLM_UNAVAILABLE|BAD_OUTPUT",
  "message": "Friendly user message"
}
```

### D3. Pipeline Flow

```
1. PREFLIGHT (deterministic)
   └─> Size check (< 15000 chars)
   └─> Empty check
   └─> Python: ast.parse → SyntaxError facts

2. LLM CALL
   └─> Load mode-specific prompt template
   └─> Inject code with clear delimiters
   └─> Call Groq with JSON mode
   └─> Timeout + retry logic

3. VALIDATE
   └─> Pydantic schema validation
   └─> Clamp line numbers to valid range
   └─> Drop hallucinated findings
   └─> Retry once if invalid, then BAD_OUTPUT

4. VERIFY (Python only)
   └─> ast.parse(fixed_code)
   └─> verification.checked = true
   └─> verification.passed = bool

5. REPAIR (if verify failed)
   └─> One repair call with parser error
   └─> verification.repaired = true
   └─> If still fails: passed = false

6. RESULT
   └─> Return structured response
```

### D4. Design System

#### Colors (tokens.css)
```css
--bg: #0E0D0B;           /* Warm near-black */
--surface: #151310;      /* Elevated surface */
--rule: #2B2721;         /* Thin separator lines */
--text: #EDE6D6;         /* Off-white paper */
--muted: #8D8574;        /* Secondary text */
--signal: #D6FF3A;       /* Acid green - primary action */
--crit: #FF4B3E;         /* Critical severity */
--warn: #FF9F1C;         /* Warning severity */
--info: #8EC9C0;         /* Info severity */
```

#### Typography
- **Display/Headlines**: Instrument Serif (Google Fonts)
- **UI/Body**: Schibsted Grotesk (Google Fonts)
- **Code**: JetBrains Mono (Google Fonts)
- All with proper fallback stacks
- Small-caps with letter-spacing for labels

#### Layout (Desktop)
```
┌─────────────────────────────────────────────────────────┐
│ [TRACER] CASE No. 042  [ Debug | Review | Explain ]   │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│  EXHIBIT A - SOURCE  │  REPORT                         │
│  [CodeMirror Editor] │  ═══════════════════════════    │
│  with gutter markers │  01 ┃ CRITICAL                  │
│  and line numbers    │     Line 14-16                  │
│                      │     Undefined variable          │
│                      │     ─────────────────────       │
│                      │  02 ┃ WARNING                   │
│                      │     ...                          │
│                      │                                  │
│                      │  [ Fix | Security | Perf ]      │
├──────────────────────┴──────────────────────────────────┤
│ Python • 142 lines • 1.2s • llama-3.3 • ✓ Verified     │
└─────────────────────────────────────────────────────────┘
```

#### Motion Principles
- Gutter markers and trace lines draw along affected lines
- Findings reveal sequentially with ~60ms stagger
- All motion respects `prefers-reduced-motion`
- No decoration for decoration's sake

---

## Tasks

### Phase 1: Backend Core (P1)
**Goal**: Restructure backend with new architecture, implement verification pipeline, add security measures

- **T1.1**: Restructure project into new directory layout
  - Create tracer/ with api/, services/, prompts/ subdirectories
  - Move old files to legacy/ folder (except .env, venv)
  - Keep .env, requirements.txt, Procfile at project root
  - Keep existing .env intact

- **T1.2**: Implement config.py enhancements
  - Update MAX_CODE_LENGTH to 15000
  - Add security header configs
  - Add rate limiting configs
  - Add deployment settings

- **T1.3**: Create services/schemas.py
  - Define pydantic model for analyze request
  - Define pydantic model for analyze response v2
  - Define error response schemas
  - Add line number validation

- **T1.4**: Implement services/verify.py
  - Create ast.parse wrapper for Python syntax checking
  - Return structured verification result
  - Add timeout protection
  - Add comprehensive docstrings

- **T1.5**: Refactor services/llm.py from existing ai_engine.py
  - Implement Groq JSON mode with explicit 30s timeout
  - Add specific error mapping (401, 429, timeout)
  - Add retry logic with max 2 retries total (3 attempts)
  - Never expose raw exceptions to caller

- **T1.6**: Create services/pipeline.py
  - Implement preflight stage (size, empty, Python syntax)
  - Implement LLM stage with mode-specific prompts
  - Implement validate stage with line clamping
  - Implement verify stage (Python only)
  - Implement repair stage (one attempt)
  - Return structured response with verification metadata

- **T1.7**: Create prompt templates
  - prompts/debug.md with JSON schema
  - prompts/review.md with JSON schema
  - Include instruction to ignore code-embedded instructions
  - Use clear delimiters around user code

- **T1.8**: Refactor api/routes.py from app.py
  - POST /api/analyze using new pipeline
  - GET /health with status, model, version
  - Implement error handlers returning codes not exceptions
  - Add request_id to all responses

- **T1.9**: Refactor app.py to factory pattern
  - create_app() factory
  - Apply security headers (CSP, X-Content-Type-Options, Referrer-Policy)
  - Remove flask-cors entirely
  - Configure logging to stdout (request_id, code size, mode, language, latency, error codes only)

- **T1.10**: Implement rate limiting
  - Add Flask-Limiter dependency
  - 10/min, 100/day per IP
  - Global daily cap with friendly message
  - Rate limit on /api/analyze only

- **T1.11**: Create .gitignore and .env.example
  - Comprehensive .gitignore (venv, __pycache__, *.db, .env, logs/)
  - .env.example with GROQ_API_KEY placeholder and comments
  - Verify .env is NOT tracked

- **T1.12**: Update requirements.txt and runtime.txt
  - Pin all versions to tested versions
  - Add: pydantic, Flask-Limiter, gunicorn
  - Keep existing: Flask, python-dotenv, groq
  - Remove: flask-cors
  - Create runtime.txt with Python version

### Phase 2: Frontend Foundation + Design System (P2)
**Goal**: Implement CodeMirror editor, design system tokens, and core UI layout

- **T2.1**: Create design system tokens
  - static/css/tokens.css with all color, spacing, typography variables
  - Load Instrument Serif, Schibsted Grotesk, JetBrains Mono from Google Fonts
  - Define fallback stacks

- **T2.2**: Create base styles
  - static/css/base.css with reset, layout primitives
  - Implement desktop grid layout (60/40 split)
  - Implement mobile single-column with tabs

- **T2.3**: Implement top bar component
  - Wordmark with trace glyph
  - Case number counter (from localStorage or random)
  - Segmented mode switch (Debug | Review | Explain)
  - static/css/components.css

- **T2.4**: Integrate CodeMirror 6
  - Add CodeMirror 6 via CDN or npm (prefer CDN for no build step)
  - static/js/editor.js module
  - Syntax highlighting for Python, JavaScript, Java, C++, C, SQL
  - Line numbers, gutter for markers
  - Dark theme matching design tokens

- **T2.5**: Implement gutter markers
  - Severity-based icons/colors (critical, warning, info)
  - Click handler to focus corresponding finding
  - Animated draw effect (respects prefers-reduced-motion)

- **T2.6**: Implement finding → line interaction
  - Click finding scrolls editor to line range
  - Highlight line range temporarily
  - Smooth scroll animation

- **T2.7**: Create report structure
  - "REPORT" heading with serif typography
  - Verdict headline ("N defects. M critical.")
  - Numbered findings list with thin rules
  - Each finding: severity tag, line chip, title, root cause, fix hint

- **T2.8**: Implement diff view component
  - Integrate @codemirror/merge or equivalent
  - Show original vs fixed side-by-side or unified
  - Highlight added/removed lines with semantic colors
  - Tab: "Fix" in report area

- **T2.9**: Implement copy and download
  - Copy fixed code to clipboard
  - Download with correct file extension based on language
  - Visual feedback for copy action

- **T2.10**: Create state management
  - static/js/state.js for app state
  - Handle mode switching
  - Handle analysis lifecycle (idle, loading, success, error)

- **T2.11**: Create API client module
  - static/js/api.js with fetch wrapper
  - POST /api/analyze with error handling
  - Parse v2 response schema
  - Return friendly errors based on error codes

- **T2.12**: Implement designed states
  - Empty state with clear CTA
  - Loading state with stage indicators
  - Error state with friendly message and next steps
  - Rate limited state
  - Too large state

### Phase 3: Remaining Must-Haves (P3)
**Goal**: Complete M4-M10 features

- **T3.1**: Implement mode-specific reports
  - Debug mode: show errors, root causes, fixed code tab
  - Review mode: show security, performance, practices tabs; no fix tab
  - Update report rendering based on mode

- **T3.2**: Implement verification badge
  - Bottom status bar component
  - Show: language, lines/chars, latency, model name
  - Verification badge with three states
  - Tooltip or expandable detail for verification info

- **T3.3**: Implement staged loading UI
  - Show: Reading → Static check → Tracing → Verifying → Done
  - Progress indicator tied to actual response metadata
  - Findings reveal with stagger animation
  - Trace line drawing effect

- **T3.4**: Create example gallery
  - 6 example snippets (Python, JS, Java, C++, C, SQL)
  - Each intentionally buggy with clear issues
  - UI: drawer or modal with one-click load
  - Store examples in static/js/examples.js

- **T3.5**: Implement keyboard shortcuts
  - Ctrl/Cmd+Enter to run analysis
  - Esc to clear focus or close modals
  - Arrow keys for finding navigation
  - Tab order for full keyboard accessibility

- **T3.6**: Implement keyboard accessibility
  - Visible focus rings using --signal
  - aria-live regions for dynamic content
  - Semantic HTML landmarks
  - Labels on all controls
  - Test with keyboard-only navigation

- **T3.7**: Implement local history
  - Store last 10 traces in localStorage
  - History panel UI (drawer or sidebar)
  - Show: timestamp, mode, language, verdict
  - Click to restore previous result
  - Clear history button

- **T3.8**: Wire everything together in main.js
  - Initialize CodeMirror editor
  - Set up event listeners
  - Handle mode switching
  - Handle analyze trigger
  - Update UI based on state changes

- **T3.9**: Implement responsive mobile layout
  - Single column layout
  - Source / Report tab switcher
  - Sticky Trace button
  - Touch-friendly controls
  - Test on various screen sizes

- **T3.10**: Test and polish P3 features
  - Cross-browser testing
  - Keyboard navigation testing
  - Accessibility audit
  - Visual polish and animations

### Phase 4: Should-Haves (P4)
**Goal**: Implement S1-S3 features

- **T4.1**: Implement streaming progress (S1)
  - Create POST /api/analyze/stream endpoint
  - Implement Server-Sent Events in routes
  - Set X-Accel-Buffering: no header
  - Emit events for each pipeline stage
  - Configure gunicorn with gthread worker

- **T4.2**: Update frontend for streaming
  - Detect SSE support
  - Connect to /api/analyze/stream
  - Update UI based on stage events
  - Fallback to /api/analyze if streaming fails
  - Show real-time progress

- **T4.3**: Implement share functionality (S2)
  - Create services/store.py with SQLite
  - Define share table schema (id, result_json, created_at, delete_token)
  - POST /api/share endpoint stores result
  - Generate short random ID (6-8 chars)
  - Return share URL and delete token

- **T4.4**: Create read-only report view
  - GET /r/<id> route
  - templates/report.html for shared reports
  - Render findings, diff, all sections
  - Add noindex meta tag
  - Show expiry notice (7 days)
  - Delete link with token

- **T4.5**: Implement expiry cleanup
  - Background task or startup hook
  - Delete shares older than 7 days
  - Or implement on-read expiry check

- **T4.6**: Implement export as Markdown (S3)
  - Generate markdown from result data
  - Include verdict, findings, code blocks
  - Download as .md file
  - Preserve hierarchy and formatting

- **T4.7**: Create print stylesheet
  - static/css/print.css
  - Optimize layout for PDF export
  - Hide interactive elements
  - Ensure code blocks don't break across pages
  - Test Print → PDF

### Phase 5: Eval + Deploy + README (P5)
**Goal**: Complete testing, evaluation harness, deployment setup, and documentation

- **T5.1**: Create evaluation test cases
  - tests/eval/cases/ directory
  - 30 buggy snippets: 6 Python, 6 JavaScript, 6 Java, 6 C++, 6 C
  - Each case: {id, language, code, bug_lines, category}
  - Python cases include assert statements for validation
  - Cover diverse bug types: syntax, logic, security, performance

- **T5.2**: Implement evaluation harness
  - tests/eval/run_eval.py script
  - Call pipeline for each case
  - Calculate: schema-valid rate, detection rate (+/-1 line)
  - For Python: run fixed code with asserts (subprocess, timeout)
  - Calculate: median latency, p95 latency
  - Never run eval inside web app

- **T5.3**: Generate EVAL.md
  - Run evaluation harness
  - Output results as markdown table
  - Include: metric, value, interpretation
  - Do not invent numbers; show actual results

- **T5.4**: Write unit tests
  - tests/unit/test_verify.py
  - tests/unit/test_schemas.py (line clamping, validation)
  - tests/unit/test_pipeline.py
  - tests/unit/test_rate_limiter.py
  - Use pytest framework

- **T5.5**: Set up deployment configuration
  - Procfile or render.yaml for Render
  - gunicorn config (gthread workers for SSE)
  - Environment variable documentation
  - Health check endpoint verification

- **T5.6**: Write DEPLOY.md
  - One-page deployment guide
  - Render-specific instructions
  - Environment variables setup
  - Database migration if needed
  - Post-deployment verification steps

- **T5.7**: Write comprehensive README.md
  - One-line pitch at top
  - Screenshot/GIF placeholders with descriptions
  - "How it works" diagram (ASCII acceptable)
  - Features list (must-have, should-have clearly marked)
  - Honest limitations section
  - Tech stack details

- **T5.8**: README continued
  - Local setup instructions (step by step)
  - Environment variables table
  - How to run the app locally
  - How to run eval harness
  - How to run unit tests

- **T5.9**: README finalize
  - Deployment instructions (link to DEPLOY.md)
  - Include EVAL.md results table
  - Add "How it works" disclosure about hybrid verification
  - License (if applicable)
  - Contribution guidelines (if applicable)
  - Contact info

- **T5.10**: Add "How it works" disclosure to UI
  - Small expandable section in UI
  - 3-line explanation of hybrid verification
  - Be honest: LLM output can be wrong
  - Explain what "verified" means

### Phase 6: Stretch Features (P6)
**Goal**: Implement X1-X3 if time permits

- **T6.1**: Implement Explain mode (X1)
  - Create prompts/explain.md
  - Plain-language walkthrough output
  - Line-by-line or section-by-section explanation
  - Update UI to show explanation format

- **T6.2**: Implement light theme toggle (X2)
  - Create light theme tokens
  - "Paper" aesthetic: cream background, dark text
  - Theme toggle in top bar
  - Store preference in localStorage

- **T6.3**: Implement per-hunk diff actions (X3)
  - Accept/reject buttons on each diff hunk
  - Build custom fixed code from accepted hunks
  - Update download to use custom version

---

## Phase Testing Instructions

### After Phase 1 (Backend Core)
**Test**:
1. Set GROQ_API_KEY in .env
2. Run `python -m tracer.app`
3. POST to /api/analyze with {code, language, mode}
4. Verify response has schema_version: 2
5. Verify verification.checked is true for Python
6. Test rate limiting by making 11 requests quickly
7. Test too-large code (> 15000 chars)
8. Test empty code
9. Verify no raw exceptions in responses

### After Phase 2 (Frontend Foundation)
**Test**:
1. Open app in browser
2. Verify design system colors match spec
3. Verify fonts load correctly
4. Verify CodeMirror editor has syntax highlighting
5. Type code and verify line numbers update
6. Click "Trace Code" and verify API call
7. Verify report renders with findings
8. Click finding and verify editor scrolls to line
9. Click gutter marker and verify finding highlights
10. Test diff view shows changes correctly
11. Test copy and download buttons
12. Resize browser to mobile and verify responsive layout

### After Phase 3 (Must-Haves)
**Test**:
1. Switch between Debug and Review modes
2. Verify report sections change per mode
3. Load each example snippet and verify analysis
4. Test Ctrl/Cmd+Enter shortcut
5. Test Esc key behavior
6. Navigate with keyboard only (Tab, Enter, Arrows)
7. Run analysis multiple times and verify history
8. Open history panel and restore old result
9. Check verification badge shows correct status
10. Verify staged loading shows all stages

### After Phase 4 (Should-Haves)
**Test**:
1. Verify streaming progress updates in real-time
2. Test fallback if streaming not supported
3. Click Share and verify link is generated
4. Open share link in incognito window
5. Verify shared report is read-only
6. Test delete token
7. Export report as Markdown and verify format
8. Print → PDF and verify layout

### After Phase 5 (Eval + Deploy)
**Test**:
1. Run eval harness: `python tests/eval/run_eval.py`
2. Verify EVAL.md is generated with real numbers
3. Run unit tests: `pytest tests/unit/`
4. Deploy to Render (or staging)
5. Test deployed app at public URL
6. Verify /health endpoint works
7. Verify rate limiting on deployed app
8. Check logs in deployment dashboard

---

## Success Criteria

**Phase 1 Complete When**:
- New architecture in place
- Pipeline with verification working
- Rate limiting active
- Security headers applied
- No raw exceptions returned

**Phase 2 Complete When**:
- Design system fully implemented
- CodeMirror editor functional with interactions
- Diff view working
- UI matches "forensic case file" aesthetic
- Responsive on mobile

**Phase 3 Complete When**:
- All 10 must-have features working
- Keyboard accessible
- Local history functional
- Examples load and analyze correctly

**Phase 4 Complete When**:
- Streaming progress works (with fallback)
- Share links functional with expiry
- Export and print working

**Phase 5 Complete When**:
- Eval harness produces real numbers
- Unit tests pass
- Deployed to Render
- README and DEPLOY.md complete
- App is interview-ready

**Phase 6 Complete When**:
- Explain mode works
- Light theme toggle works
- Per-hunk diff actions work

---

## Notes for Implementation

1. **No Build Step**: Use ES modules, CDN for libraries, no webpack/vite
2. **Type Hints**: All Python functions should have type hints
3. **Docstrings**: Non-obvious functions need short explanatory comments
4. **Error Messages**: Always friendly, never technical jargon to users
5. **Code Style**: Clean, single-purpose modules; easy to explain in interviews
6. **Testing**: Stop after each phase for testing before proceeding
7. **Ask First**: Before deleting/renaming files or adding dependencies

---

## Awaiting Approval

Please review this spec and confirm:
1. Requirements are complete and accurate
2. Design approach is sound
3. Task breakdown is appropriate
4. Phase ordering makes sense
5. Any changes or clarifications needed

Once approved, I'll begin Phase 1: Backend Core.
