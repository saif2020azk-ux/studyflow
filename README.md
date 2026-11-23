# Studyflow

Timetable and study plan generator for Prompt Engineering problem **C20**. Enter subjects, exam dates, target hours and weekly availability; receive a checked day-wise timetable. Includes a prompt lab for real model experiments.

GitHub repository: https://github.com/saif2020azk-ux/studyflow

Live website: https://studyflow-flax-tau.vercel.app

## Run locally

Requires **Python 3.10 or newer**. No pip packages, Node.js, or API keys are needed to run the application.

```sh
cd studyflow
python3 -m unittest discover -s tests -v
python3 -m backend.evaluate
python3 app.py
```

Open http://127.0.0.1:5173. `python3 app.py --port 5174` selects a different port. The server serves the frontend directly; no build step is needed. `python3 -m backend.evaluate` saves measured Python results to test-data/local-results.json.

The application requires a running Python backend. To host it online, use a Python-capable host; uploading the source to GitHub does not deploy the app.

## Vercel hosting

The project includes a dependency-free Python function entry point at `api/index.py`, a Python 3.12 selection in `.python-version`, and routing in `vercel.json`. The function reuses the local Python handler for the interface, scheduling, validation, prompt templates, and CSV export. Tests, report drafts, screenshots, and saved evaluation output are excluded from the function bundle; the evaluation inputs stay available because the app uses them.

Import `saif2020azk-ux/studyflow` in the intended Vercel account/team. Use the repository root, Framework Preset **Other**, and the default build/install settings. No API keys or environment variables are required. Connecting the Vercel GitHub integration to this repository enables deployments from GitHub commits. Verify the resulting deployment at `/` and `/api/health` before sharing its URL.

The current Vercel project is `studyflow` in **NEBULA LABS** (`nebula-labs1`), connected to this repository’s `main` branch. Pushes to `main` trigger production deployments. The explicit homepage rewrite serves the app at `/`; other routes use the same Python function.

References: [Vercel Python functions](https://vercel.com/docs/functions/runtimes/python/api-directory), [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github).

## Features

- Light/Dark theme buttons with a saved preference; first visit follows the device theme.
- Quick-start guide, clearly marked example, Start fresh, and one-click hours for every day.
- Clear field labels, a visible CSV download button and mobile-friendly navigation. Unfinished drafts survive a reload.
- Up to 12 subjects and a 120-day planning period, with 15-minute increments.
- Python earliest-exam-first local scheduler with explicit shortfall reporting.
- Six code-based constraint checks, plus target-completeness checks.
- Two final prompt templates: generation (P1, with v1/v2/v3) and conditional repair (P2).
- Manual external-AI workflow: copy prompt, run in your chosen AI tool, paste actual JSON, validate and apply.
- Repair instructions from observed violations, actual run logging and JSON export.
- Day and subject views, seven-day pagination, CSV export, print view and browser persistence.

The automatic default planner is deterministic code, not an LLM. AI model calls are manual; no model outputs or prompt improvement measurements are fabricated. A valid schedule can be incomplete; the interface reports the remaining hours. Model labels in logs are user supplied.

## Reproduce prompt experiments

1. Select a case from test-data/cases.json and enter the same details in the app (or substitute its JSON for {student_input} in the prompt file).
2. Run v1, v2, v3 with the same AI model and settings. Use fresh conversations to reduce carryover.
3. Record the exact model/tool, settings and date. Paste each original response without editing; non-JSON responses count as format failures.
4. Validate, save raw outputs and export the run log. Measure JSON validity, constraint pass rate, target coverage on feasible inputs, and faithful shortage handling on infeasible inputs.
5. Report first responses and repairs separately. Run repeated trials before making consistency claims. The bundled local results do not evaluate an AI model.

## Files

```text
app.py            Python application entry point
api/index.py      Vercel Python function entry point
vercel.json       Vercel routing and function-bundle configuration
backend/          Python HTTP API, scheduling engine, validator, CSV export and evaluation
code/             HTML/CSS and JavaScript browser interface (no scheduling algorithm)
prompts/          v1/, v2/, v3/, final/
test-data/        Cases and measured local outputs
tests/            Python unittest coverage for scheduling, validation, CSV and real HTTP endpoints
docs/             Workflow, report outline, supporting draft, reel script
CHANGELOG.md      Dated implementation changes
```

## Evidence still needed

Team ID/name, faculty/batch, members/enrollment numbers, agreed contribution percentages, Milestone 1 materials, actual AI runs and comparison, screenshots, final PDFs, presentation, LinkedIn post, and recorded videos. Documentation is a starter and must be completed with genuine evidence. No course submission or public social post has been made.

Verification: all 40 Python unit/API tests pass, covering the engine, malformed input and model responses, CSV safety, static-file boundaries, and HTTP endpoints. All 16 original scheduling scenarios pass with Python. Local scheduling tests do not evaluate AI prompt quality. The two desktop screenshots in docs/ show real local scheduler runs in light and dark themes.

## Privacy and limitations

Plans and experiment history are stored in localStorage in the current browser. Student inputs and imported AI responses are sent to the Python server for calculation/validation, but are not written to disk or forwarded to a model by the server. With the default localhost binding, that server runs on your own machine. External AI calls remain manual. Google Fonts is optional and falls back to system fonts. Use made-up student data for tests. The app does not model exact clock times, per-date availability exceptions, syllabus coverage, spaced repetition, or calendar sync. Availability must exclude breaks. Users review and adjust their own plans.

## Attribution

Problem and submission requirements: Bennett University Prompt Engineering Mini Project Guidelines 2026 and SCSE4041 Milestone 2 Student Guidelines supplied by the user. Prototype, prompts, tests and drafts were developed with Codex assistance on 23 November 2026. Exact tools/models used for assessed AI experiments must be added after running them.

## HTTP API

`GET /api/health`, `/api/prompts`, `/api/evaluation`; `POST /api/plan` and `/api/validate-input` accept `{"input": ...}`; `/api/check` and `/api/export` accept `{"input": ..., "plan": ...}`; `/api/validate-response` accepts `{"input": ..., "rawOutput": "actual model text"}`. POST bodies use application/json. Invalid schedule inputs return an errors list; malformed HTTP requests return a 4xx status. This is a local student prototype; public deployment requires a Python-capable host.
