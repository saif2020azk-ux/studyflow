# Studyflow: Constraint-Checked Exam Study Planning

Supporting technical report draft. Add team details and actual AI measurements before final PDF export.

Studyflow addresses C20: students supply subjects, exam dates, target study hours and weekly availability to obtain a daily revision timetable. The prototype separates schedule validity from target completeness so an overloaded request produces a visible shortfall instead of additional invented study time.

The application uses a Python standard-library HTTP server with an HTML/CSS/JavaScript browser interface. The Python local scheduler assigns 15-minute units by earliest exam deadline; subjects sharing a deadline are balanced using priority. A separate Python validator checks response structure, unique date coverage, daily capacity, exam cutoffs, known subject IDs and maximum target hours. Coverage per subject is reported separately. Plans can be exported as CSV or printed, and are stored in the browser.

The prompt workflow has three authored versions: a basic instruction, a JSON-and-constraints version, and a final version with a worked infeasible example, explicit handling of shortages and a data/instruction boundary. Students run the prompt in their selected AI tool and import the actual JSON result. Invalid responses receive a repair instruction. The application records the prompt, model label, input, raw response and validation result for export.

Actual Python local test outputs are saved in test-data/local-results.json, including normal, edge and invalid scenarios. These measure the deterministic implementation only. AI prompt comparison results, exact external model and measured consistency are pending actual runs; no AI improvement claim is made. Insert measured v1/v2/v3 outcomes here after completing experiments.

Limits include daily rather than clock-time sessions, repeating weekly availability, manual AI interaction and device-local storage. Users must reserve break time themselves and review study-hour estimates. No grades or guaranteed academic outcomes are predicted. Use synthetic input for demonstrations and acknowledge tools and AI-assisted development according to course requirements.
