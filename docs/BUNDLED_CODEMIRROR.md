# CodeMirror Bundled Solution

## Problem
jsDelivr +esm URLs caused:
1. **Duplicated packages**: Each +esm URL bundled its own @lezer/@codemirror copies → "Cannot read properties of undefined (reading 'deserialize')"
2. **57 CSP violations**: connect-src 'self' blocked jsDelivr module resolution requests

## Root Cause of connect-src Violations
When using `+esm` URLs from jsDelivr, the browser:
1. Loads the main module from jsDelivr
2. That module contains imports to other jsDelivr URLs
3. The browser makes **fetch requests** to resolve those dependencies
4. These fetches violated `connect-src 'self'` (only same-origin allowed)

## Solution
**Bundle CodeMirror once at build time, serve from same origin**

### What Was Done

1. ✅ **Created tools/ directory** with:
   - `package.json` - CodeMirror dependencies (exact versions)
   - `codemirror-entry.js` - Exports only what we need
   - `build.js` - esbuild bundler script

2. ✅ **Installed Node.js dependencies**:
   ```bash
   cd tools/
   npm install
   ```

3. ✅ **Built single bundle**:
   ```bash
   npm run bundle
   ```
   Output: `static/vendor/codemirror.bundle.js` (645KB, minified)

4. ✅ **Updated main.js**:
   - Replaced ALL CDN imports with: `import { ... } from '/static/vendor/codemirror.bundle.js'`
   - Same-origin import (no CSP violations)

5. ✅ **Tightened CSP**:
   - Removed `https://cdn.jsdelivr.net` from script-src
   - CSP now: `script-src 'self'` (strictest possible)

6. ✅ **Updated .gitignore**:
   - Exclude `tools/node_modules/` and `tools/package-lock.json`
   - **Include** `static/vendor/codemirror.bundle.js` (committed bundle)

### Files Created/Modified

**Created:**
- `tools/package.json` - Dependencies
- `tools/codemirror-entry.js` - Entry point
- `tools/build.js` - Build script
- `static/vendor/codemirror.bundle.js` - **645KB bundle (commit this)**

**Modified:**
- `static/js/main.js` - Import from local bundle
- `tracer/config.py` - Removed cdn.jsdelivr.net from CSP
- `.gitignore` - Exclude node_modules

**NOT Created:**
- No `node_modules/` in git
- No `package-lock.json` in git

### Build Process (One-Time)

**To rebuild** (only if upgrading CodeMirror versions):
```bash
cd tools/
npm install
npm run bundle
git add ../static/vendor/codemirror.bundle.js
git commit -m "Update CodeMirror bundle"
```

**Runtime**: NO build step needed. Bundle is committed and served statically.

### Final CSP (Strictest Possible)

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self';
```

**No CDN hosts in script-src. No unsafe-inline in script-src.**

### Bundled Packages (Exact Versions)

```json
{
  "@codemirror/commands": "6.3.3",
  "@codemirror/lang-cpp": "6.0.2",
  "@codemirror/lang-java": "6.0.1",
  "@codemirror/lang-javascript": "6.2.1",
  "@codemirror/lang-python": "6.1.4",
  "@codemirror/lang-sql": "6.5.5",
  "@codemirror/language": "6.10.0",
  "@codemirror/merge": "6.6.0",
  "@codemirror/state": "6.4.0",
  "@codemirror/view": "6.23.0"
}
```

**Single instance** of each package in the bundle (no duplicates).

---

## Expected Browser Console

**Zero errors:**
- ✓ No "deserialize" errors
- ✓ No CSP violations
- ✓ No connect-src violations
- ✓ No module resolution errors

**Console output:**
```
Initializing TRACER AI...
✓ CodeMirror editor initialized successfully
✓ Line numbers visible: true
✓ Cursor visible: true
✓ Initialization complete
✓ Please verify: editor shows line numbers, syntax colors, cursor, accepts typing
```

---

## What Changed (Exact Summary)

1. **Node.js detected** (v26.4.0)
2. **Created** tools/ directory with package.json, entry file, build script
3. **Installed** CodeMirror packages via npm
4. **Bundled** with esbuild → static/vendor/codemirror.bundle.js (645KB)
5. **Updated** main.js to import from /static/vendor/codemirror.bundle.js
6. **Removed** cdn.jsdelivr.net from CSP script-src
7. **Updated** .gitignore to exclude node_modules
8. **Committed** the bundle to git

**No Stop B work. Only bundling fix.**
