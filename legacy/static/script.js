/* =====================================================
   TRACER AI
   PART 1
   DOM + Editor + Upload
===================================================== */

// ==============================
// DOM Elements
// ==============================

const codeInput = document.getElementById("codeInput");
const lineNumbers = document.getElementById("lineNumbers");

const language = document.getElementById("language");

const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");

const traceBtn = document.getElementById("traceBtn");

const summary = document.getElementById("summary");
const issues = document.getElementById("issues");
const insights = document.getElementById("insights");
const fixedCode = document.getElementById("fixedCode");

const copyBtn = document.getElementById("copyBtn");
const editorInfo = document.getElementById("editorInfo");


// ==============================
// Line Numbers
// ==============================

function updateLineNumbers() {

    const lines = codeInput.value.split("\n").length;

    lineNumbers.innerHTML = "";

    for (let i = 1; i <= lines; i++) {
        lineNumbers.innerHTML += `${i}<br>`;
    }

    editorInfo.textContent =
        `${lines} Lines • ${codeInput.value.length} Characters`;

}

updateLineNumbers();

codeInput.addEventListener("input", updateLineNumbers);

codeInput.addEventListener("scroll", () => {
    lineNumbers.scrollTop = codeInput.scrollTop;
});


// ==============================
// Upload File
// ==============================

uploadBtn.addEventListener("click", () => {

    fileInput.click();

});

fileInput.addEventListener("change", (e) => {

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

        codeInput.value = reader.result;

        updateLineNumbers();

    };

    reader.readAsText(file);

});


// ==============================
// Copy Fixed Code
// ==============================

copyBtn.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(fixedCode.textContent);

        copyBtn.textContent = "Copied ✓";

        setTimeout(() => {

            copyBtn.textContent = "Copy";

        }, 1800);

    }

    catch {

        alert("Unable to copy.");

    }

});

/* =====================================================
   PART 2
   Loading + API Request
===================================================== */

function startLoading() {

    traceBtn.disabled = true;

    traceBtn.innerHTML = "⏳ Tracing...";

    summary.innerHTML = `
        <div class="loading">
            <div class="loader"></div>
            <p>Analyzing source code...</p>
        </div>
    `;

    issues.innerHTML = `
        <div class="loading">
            Waiting for analysis...
        </div>
    `;

    insights.innerHTML = `
        <div class="loading">
            Generating AI insights...
        </div>
    `;

    fixedCode.textContent = "";

}


function stopLoading() {

    traceBtn.disabled = false;

    traceBtn.innerHTML = "⚡ Trace Code";

}


// ==========================================
// Analyze Button
// ==========================================

traceBtn.addEventListener("click", analyzeCode);


async function analyzeCode() {

    const code = codeInput.value.trim();

    if (!code) {

        alert("Please paste some code first.");

        return;

    }

    startLoading();

    try {

        const response = await fetch("/api/analyze", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                code: code,

                language: language.value

            })

        });

        const json = await response.json();

        if (!json.success) {

            throw new Error(json.message || "Analysis failed.");

        }

        displayResults(json.data);

    }

    catch (err) {

        stopLoading();

        summary.innerHTML = `
            <div class="error-box">
                ❌ ${err.message}
            </div>
        `;

        issues.innerHTML = "";

        insights.innerHTML = "";

        fixedCode.textContent = "";

    }

}

/* =====================================================
   PART 3
   Display Results Controller
===================================================== */

function displayResults(data) {

    stopLoading();

    displaySummary(data);

    displayIssues(data);

    displayInsights(data);

    displayFixedCode(data);

    animateCards();

}
function displaySummary(data) {

    summary.innerHTML = `

        <div class="summary-box">

            <h3>📝 Summary</h3>

            <p>${data.summary || "Analysis completed successfully."}</p>

            <hr>

            <div class="summary-row">
                <span>🌐 Language</span>
                <span>${data.language || "-"}</span>
            </div>

            <div class="summary-row">
                <span>⭐ Quality</span>
                <span>${data.quality_score ?? "--"}/100</span>
            </div>

            <div class="summary-row">
                <span>🛠 Maintainability</span>
                <span>${data.maintainability ?? "-"}</span>
            </div>

            <div class="summary-row">
                <span>📊 Complexity</span>
                <span>${data.complexity ?? "-"}</span>
            </div>

        </div>

    `;

}
function displayIssues(data) {

    issues.innerHTML = "";

    if (!data.errors || data.errors.length === 0) {

        issues.innerHTML = `

            <div class="issue-card">

                <div class="issue-title">
                    ✅ No Issues Found
                </div>

                <div class="issue-message">
                    Your code looks good.
                </div>

            </div>

        `;

        return;

    }

    data.errors.forEach(error => {

        issues.innerHTML += `

            <div class="issue-card">

                <div class="issue-title">
                    ${error.type}
                </div>

                <div class="issue-line">
                    Line ${error.line}
                </div>

                <div class="issue-message">
                    ${error.message}
                </div>

                <div class="issue-severity">
                    ${error.severity}
                </div>

            </div>

        `;

    });

}
function displayInsights(data){

    let html = "";

    addInsightSection(
        html,
        "🧠 Explanation",
        data.explanation
    );

    html += renderListSection(
        "⚡ Performance",
        data.performance,
        ["issue","improvement"]
    );

    html += renderListSection(
        "🔒 Security",
        data.security,
        ["issue","risk","solution"]
    );

    html += renderListSection(
        "✅ Best Practices",
        data.best_practices
    );

    html += renderListSection(
        "💡 Suggestions",
        data.suggestions
    );

    insights.innerHTML =
        html || "<p>No AI insights available.</p>";

}
function displayFixedCode(data){

    fixedCode.textContent =
        data.fixed_code || "// No corrected code returned.";

}
function animateCards(){

    // We'll add animations later.
    // Empty function so JS doesn't crash.


}
function displayInsights(data){

    let html = "";

        html += addInsightSection(
        html,
        "🧠 Explanation",
        data.explanation
    );

    html += renderListSection(
        "⚡ Performance",
        data.performance,
        ["issue","improvement"]
    );

    html += renderListSection(
        "🔒 Security",
        data.security,
        ["issue","risk","solution"]
    );

    html += renderListSection(
        "✅ Best Practices",
        data.best_practices
    );

    html += renderListSection(
        "💡 Suggestions",
        data.suggestions
    );

    insights.innerHTML =
        html || "<p>No AI insights available.</p>";

}
function addInsightSection(html,title,text){

    if(!text)
        return "";

    return `

        <div class="insight-section">

            <h4>${title}</h4>

            <p>${text}</p>

        </div>

    `;

}
function capitalize(text){

    return text.charAt(0).toUpperCase()+text.slice(1);

}