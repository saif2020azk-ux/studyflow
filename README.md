# Studyflow

Timetable and study plan generator for Prompt Engineering problem **C20**. Enter subjects, exam dates, target hours and weekly availability; receive a checked day-wise timetable. Includes a prompt lab for real model experiments.

## Run locally

Requires Node.js 20 or newer. No dependencies or API keys are required.

```sh
cd studyflow
npm test
npm run evaluate
npm run dev
```

Open http://127.0.0.1:5173. For static hosting, run `npm run build` and serve `dist/`. `npm run evaluate` refreshes the measured local results included in builds.

## Features

- Up to 12 subjects and a 120-day planning period, with 15-minute increments.
- Earliest-exam-first local scheduler with explicit shortfall reporting.
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
code/             HTML, CSS and JavaScript app, scheduling engine and validator
prompts/          v1/, v2/, v3/, final/
test-data/        Cases and measured local outputs
tests/            Node tests for schedules, validation and CSV safety
scripts/          Build, evaluation and local server
docs/             Workflow, report outline, supporting draft, reel script
CHANGELOG.md      Dated implementation changes
```

## Evidence still needed

Team ID/name, faculty/batch, members/enrollment numbers, agreed contribution percentages, Milestone 1 materials, actual AI runs and comparison, screenshots, final PDFs, presentation, LinkedIn post, and recorded videos. Documentation is a starter and must be completed with genuine evidence. No course submission or public social post has been made.

Verification: 26 Node tests and 16 saved local scenarios pass. Real Chrome smoke checks cover the initial plan, adding/removing subjects, overload handling, prompt generation, JSON rejection, response import with an explicitly synthetic fixture, and desktop/mobile layout. The fixture import is not model evaluation evidence. Screenshots in docs/local-planner-desktop.png and docs/local-planner-mobile.png show real local scheduler runs.

The Sites deployment starts owner-private; evaluator access must be arranged before using it as a submission link. Local Git is connected to Sites source storage; this is not automatically a public GitHub repository.

## Privacy and limitations

Data is stored in localStorage on the current browser. AI text is transferred only when you copy it into an external tool. Google Fonts is optional and falls back to system fonts. Use made-up student data for tests. The app does not model exact clock times, per-date availability exceptions, syllabus coverage, spaced repetition, or calendar sync. Availability must exclude breaks. Users review and adjust their own plans.

## Attribution

Problem and submission requirements: Bennett University Prompt Engineering Mini Project Guidelines 2026 and SCSE4041 Milestone 2 Student Guidelines supplied by the user. Prototype, prompts, tests and drafts were developed with Codex assistance on 23 November 2026. Exact tools/models used for assessed AI experiments must be added after running them.
