# Studyflow

Timetable and study plan generator for Prompt Engineering problem **C20**. Enter subjects, exam dates, target hours and weekly availability; receive a checked day-wise timetable. Includes a prompt lab for real model experiments.

GitHub repository: https://github.com/saif2020azk-ux/studyflow

## Run locally

Requires **Python 3.10 or newer**. No pip packages, Node.js, or API keys are needed to run the application.

```sh
cd studyflow
python3 -m unittest discover -s tests -v
python3 -m backend.evaluate
python3 app.py
```

Open http://127.0.0.1:5173. `python3 app.py --port 5174` selects a different port. The server serves the frontend directly; no build step is needed. `python3 -m backend.evaluate` saves measured Python results to test-data/local-results.json.

The application now requires a running Python backend and cannot be served as a static-only site. The previously published Sites preview remains the earlier JavaScript version; this Python migration is local and has not been published.

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
backend/          Python HTTP API, scheduling engine, validator, CSV export and evaluation
code/             HTML/CSS and JavaScript browser interface (no scheduling algorithm)
prompts/          v1/, v2/, v3/, final/
test-data/        Cases and measured local outputs
tests/            Python unittest coverage for scheduling, validation, CSV and real HTTP endpoints
scripts/          Optional real-browser QA helper (requires Node.js and installed Chrome)
docs/             Workflow, report outline, supporting draft, reel script
CHANGELOG.md      Dated implementation changes
```

## Evidence still needed

Team ID/name, faculty/batch, members/enrollment numbers, agreed contribution percentages, Milestone 1 materials, actual AI runs and comparison, screenshots, final PDFs, presentation, LinkedIn post, and recorded videos. Documentation is a starter and must be completed with genuine evidence. No course submission or public social post has been made.

Verification: all 34 Python unit/API tests pass, covering the engine, malformed input and model responses, CSV safety, static-file boundaries, and HTTP endpoints. All 16 original scheduling scenarios pass with Python; migration checks also matched the prior JavaScript schedules. Real Chrome checks passed for the Python-backed app, themes, draft recovery, scheduling, response import and desktop/mobile views. Fixture imports are not AI evaluation evidence. Screenshots in docs/ show real local scheduler runs.

The earlier Sites deployment is owner-private; evaluator access must be arranged before using it as a submission link. The GitHub destination for the Python source is saif2020azk-ux/studyflow. Publishing source does not deploy the Python application.

## Privacy and limitations

Plans and experiment history are stored in localStorage in the current browser. Student inputs and imported AI responses are sent to the Python server for calculation/validation, but are not written to disk or forwarded to a model by the server. With the default localhost binding, that server runs on your own machine. External AI calls remain manual. Google Fonts is optional and falls back to system fonts. Use made-up student data for tests. The app does not model exact clock times, per-date availability exceptions, syllabus coverage, spaced repetition, or calendar sync. Availability must exclude breaks. Users review and adjust their own plans.

## Attribution

Problem and submission requirements: Bennett University Prompt Engineering Mini Project Guidelines 2026 and SCSE4041 Milestone 2 Student Guidelines supplied by the user. Prototype, prompts, tests and drafts were developed with Codex assistance on 23 November 2026. Exact tools/models used for assessed AI experiments must be added after running them.

## HTTP API

`GET /api/health`, `/api/prompts`, `/api/evaluation`; `POST /api/plan` and `/api/validate-input` accept `{"input": ...}`; `/api/check` and `/api/export` accept `{"input": ..., "plan": ...}`; `/api/validate-response` accepts `{"input": ..., "rawOutput": "actual model text"}`. POST bodies use application/json. Invalid schedule inputs return an errors list; malformed HTTP requests return a 4xx status. This is a local student prototype; public deployment requires a Python-capable host.
