# Milestone 2 submission outline — complete before exporting to PDF

This is a working outline, not a completed submission. Do not submit placeholders.

## 1. Cover page
Enter the existing Team ID, team name, approved project title, batch, faculty name, member names and enrollment numbers. Add prototype, source repository and reel links. The Sites preview is private; arrange evaluator-accessible hosting/sharing before submission.

## 2. Prompt and solution design
Describe the student scheduling problem, inputs/outputs, one generation prompt plus any repair prompt actually used, chosen external AI tool/model, settings, and real changes since Milestone 1. Include the workflow, task decomposition, input–output flow, and architecture from workflow.md as rendered diagrams. No Milestone 1 work has been provided, so historical claims are pending.

Prompt sheet P1 — Study plan generation; purpose: convert constraints to a daily timetable; system prompt: none; user prompt: prompts/final/P1-study-plan.txt; variable {student_input}: validated student JSON; examples: one in v3/final; settings: external tool defaults; exact tool/model: fill after actual runs. Include actual input/output.

Prompt sheet P2 — Conditional schedule repair; purpose: correct observed failures in the same conversation; system prompt: none; user prompt: prompts/final/P2-repair.txt; variable {issues}: observed violations/shortfalls; examples: none; settings/model: same as P1. Include actual repair input/output. There are two final templates; P1 has three authored versions. Count only demonstrated final prompts and clearly explain per-prompt version counts in the form/report.

## 3. Implementation
Working: Python HTTP backend, student input, weekly availability, Python local planner, Python constraint validator, subject coverage, CSV/print export, browser persistence, versioned prompt builder, manual AI-response import, repair text generation, experiment history export, local evaluation display.

Not implemented: automatic model API calls, clock-time scheduling, calendar sync, authentication, cross-device persistence, automated AI benchmark runner.

Iteration log: v1 basic instructions → v2 hard constraints and JSON → v3 worked example, explicit feasibility policy, 15-minute granularity, untrusted-input rule. These changes have been authored; AI outcomes have not been measured. Record observed results after running the same cases on the same model/settings. Include full prompt text for each version.

## 4. Demonstration and testing
Use test-data/cases.json and actual local outputs in local-results.json for code validation. Clearly label them local scheduler results. Run each prompt version on at least ten distinct inputs with at least three edge cases; save raw AI outputs and actual checks. Record model/tool/version, time, settings, expected/actual output, and pass/fail. Repeat cases for consistency if making reliability claims. Do not treat local scheduler passes as proof of model prompt quality.

Add 2–3 real screenshots labelled with test numbers. Limitations: daily totals rather than start/end times; manual external AI interaction; weekly rather than per-date availability; no guarantee of a feasible plan when input demand exceeds capacity.

## 5. Repository
Add an actual repository screenshot and 3–5 lines describing verified changes since Milestone 1. This checkout was started on 23 November 2026; do not backdate commits or invent progress history.

## 6. Supporting document
Complete technical-report.md with actual model details and AI results, export to a 1–2 page PDF, include here and separately as TeamName_TechnicalReport.pdf.

## 7. Team contribution
Use columns: member name, enrollment number, role, tasks done, evidence path/commit/prompt ID, percentage. Fill from real work, total 100%, and obtain each member’s agreement. Team details and ownership are not yet supplied.

Final filename: M2_TeamID_ProjectTitle.pdf, maximum 10 MB. Supporting PDF maximum 10 MB. Record actual counts consistently in report and form. Only the team leader submits; no form submission is performed by this application. Confirm current deadline/access requirements through the official LMS.
