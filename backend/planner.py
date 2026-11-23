"""Schedule generation, model-response validation, and CSV export.

All scheduling calculations happen in Python. Durations use integer quarter-hours
internally so comparisons do not accumulate floating-point rounding errors.
"""
from __future__ import annotations

import csv
from datetime import date, datetime, timedelta, timezone
import io
import json
import math
import re

MAX_DAYS = 120


def parse_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def is_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def valid_hours(value, minimum, maximum):
    return is_number(value) and minimum <= value <= maximum and (value * 4) % 1 == 0


def validate_input(data):
    if not isinstance(data, dict):
        return ["Enter your study details."]
    errors = []
    start = parse_date(data.get("startDate"))
    if start is None:
        errors.append("Choose a valid start date.")
    availability = data.get("availability")
    if not isinstance(availability, list) or len(availability) != 7 or any(
        not valid_hours(h, 0, 12) for h in availability
    ):
        errors.append("Daily availability must be 0–12 hours in 15-minute increments, Monday through Sunday.")
    subjects = data.get("subjects")
    if not isinstance(subjects, list) or not 1 <= len(subjects) <= 12:
        errors.append("Add between 1 and 12 subjects.")
    ids, names = set(), set()
    for subject in subjects if isinstance(subjects, list) else []:
        if not isinstance(subject, dict):
            errors.append("Each subject needs valid details.")
            continue
        subject_id = subject.get("id")
        if not isinstance(subject_id, str) or not subject_id or len(subject_id) > 120 or subject_id in ids:
            errors.append("Each subject needs a unique identifier of 1–120 characters.")
        else:
            ids.add(subject_id)
        name = subject.get("name")
        name = name.strip() if isinstance(name, str) else ""
        if not name or len(name) > 60 or name.casefold() in names:
            errors.append("Subject names must be unique and between 1 and 60 characters.")
        names.add(name.casefold())
        exam = parse_date(subject.get("examDate"))
        if exam is None:
            errors.append(f"Choose a valid exam date for {name or 'each subject'}.")
        elif start is not None:
            days = (exam - start).days
            if days < 1:
                errors.append(f"{name}: the exam must be after the start date.")
            if days > MAX_DAYS:
                errors.append(f"{name}: choose an exam within {MAX_DAYS} days of the start date.")
        if not valid_hours(subject.get("hours"), 0.25, 200):
            errors.append(f"{name or 'Subject'}: study hours must be 0.25–200 in 15-minute increments.")
        if subject.get("priority") not in ("low", "medium", "high"):
            errors.append(f"{name or 'Subject'}: select a valid priority.")
    return list(dict.fromkeys(errors))


def plan_dates(data):
    start = parse_date(data["startDate"])
    end = max(parse_date(s["examDate"]) for s in data["subjects"])
    return [(start + timedelta(days=i)).isoformat() for i in range((end - start).days)]


def available_hours(data, day):
    return data["availability"][parse_date(day).weekday()]


def generate_plan(data):
    errors = validate_input(data)
    if errors:
        return {"ok": False, "errors": errors}
    remaining = {s["id"]: int(s["hours"] * 4) for s in data["subjects"]}
    subjects = {s["id"]: s for s in data["subjects"]}
    weights = {"high": 3, "medium": 2, "low": 1}
    days = []
    for day in plan_dates(data):
        allocations = {}
        for _ in range(int(available_hours(data, day) * 4)):
            candidates = [s for s in data["subjects"] if s["examDate"] > day and remaining[s["id"]] > 0]
            if not candidates:
                break
            subject = min(candidates, key=lambda s: (
                s["examDate"], allocations.get(s["id"], 0) / weights[s["priority"]],
                -remaining[s["id"]], s["id"],
            ))
            subject_id = subject["id"]
            allocations[subject_id] = allocations.get(subject_id, 0) + 1
            remaining[subject_id] -= 1
        sessions = []
        for subject_id, quarters in allocations.items():
            close_to_exam = (parse_date(subjects[subject_id]["examDate"]) - parse_date(day)).days <= 2
            sessions.append({"subjectId": subject_id, "hours": quarters / 4,
                "task": "Revise key ideas and practise exam questions" if close_to_exam
                else "Study concepts and practise recall"})
        days.append({"date": day, "sessions": sessions})
    plan = {"days": days}
    return {"ok": True, "plan": plan, "validation": check_plan(data, plan),
        "source": "local", "engine": "python", "generatedAt": datetime.now(timezone.utc).isoformat()}


def check_plan(data, plan):
    errors = validate_input(data)
    if errors:
        return {"valid": False, "violations": errors, "complete": False,
            "scheduledHours": 0, "coverage": [], "checks": []}
    violations = []
    expected = set(plan_dates(data))
    subjects = {s["id"]: s for s in data["subjects"]}
    totals = {s["id"]: 0 for s in data["subjects"]}
    seen = set()
    flags = dict.fromkeys(("format", "dates", "capacity", "deadlines", "subjects", "targets"), True)

    def fail(key, message):
        flags[key] = False
        violations.append(message)

    if not isinstance(plan, dict) or not isinstance(plan.get("days"), list):
        fail("format", "The response must contain a days array.")
    else:
        if len(plan["days"]) > MAX_DAYS:
            fail("dates", f"The schedule cannot exceed {MAX_DAYS} days.")
        for day in plan["days"][:MAX_DAYS + 1]:
            value = day.get("date") if isinstance(day, dict) else None
            if parse_date(value) is None or value not in expected or value in seen:
                fail("dates", "The schedule contains a duplicate, invalid, or out-of-range date.")
                continue
            seen.add(value)
            sessions = day.get("sessions")
            if not isinstance(sessions, list) or len(sessions) > 48:
                fail("format", f"{value}: use a sessions array with at most 48 sessions.")
                continue
            day_quarters = 0
            for session in sessions:
                subject_id = session.get("subjectId") if isinstance(session, dict) else None
                if not isinstance(subject_id, str) or subject_id not in subjects:
                    fail("subjects", f"{value}: a session references an unknown subject.")
                    continue
                hours, task = session.get("hours"), session.get("task")
                if not valid_hours(hours, 0.25, 12) or not isinstance(task, str) or not task.strip() or len(task) > 300:
                    fail("format", f"{value}: sessions need positive 15-minute hours and a task of 1–300 characters.")
                    continue
                quarters = int(hours * 4)
                day_quarters += quarters
                totals[subject_id] += quarters
                if value >= subjects[subject_id]["examDate"]:
                    fail("deadlines", f"{value}: {subjects[subject_id]['name']} is scheduled on or after its exam.")
            if day_quarters > available_hours(data, value) * 4:
                fail("capacity", f"{value}: scheduled {day_quarters / 4:g}h with only {available_hours(data, value):g}h available.")
        if seen != expected:
            fail("dates", "Include every date in the planning period, using empty sessions for rest days.")
    coverage = [{"subjectId": s["id"], "name": s["name"], "required": s["hours"],
        "scheduled": totals[s["id"]] / 4, "remaining": max(0, s["hours"] - totals[s["id"]] / 4)}
        for s in data["subjects"]]
    for subject in coverage:
        if subject["scheduled"] > subject["required"]:
            fail("targets", f"{subject['name']}: the schedule exceeds the requested study hours.")
    labels = [("format", "Valid session format"), ("dates", "Complete, unique dates"),
        ("capacity", "Within daily availability"), ("deadlines", "Study before exam dates"),
        ("subjects", "Known subjects only"), ("targets", "Within study-hour targets")]
    return {"valid": not violations, "violations": list(dict.fromkeys(violations)),
        "complete": all(s["remaining"] == 0 for s in coverage),
        "scheduledHours": sum(totals.values()) / 4, "coverage": coverage,
        "checks": [{"name": name, "pass": flags[key]} for key, name in labels]}


def strict_json(text):
    def reject(value):
        raise ValueError(f"Non-JSON numeric constant: {value}")
    def finite_float(value):
        result = float(value)
        if not math.isfinite(result):
            raise ValueError("JSON numbers must be finite.")
        return result
    return json.loads(text, parse_constant=reject, parse_float=finite_float)


def parse_model_output(text):
    if not isinstance(text, str) or len(text.encode("utf-8")) > 200_000:
        raise ValueError("Paste a JSON response smaller than 200 KB.")
    clean = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean)
    try:
        return strict_json(clean)
    except (ValueError, RecursionError) as exc:
        raise ValueError("The response is not valid JSON. Copy the complete JSON object from your AI tool.") from exc


def export_csv(data, plan):
    validation = check_plan(data, plan)
    if not validation["valid"]:
        raise ValueError("Only a valid checked plan can be exported.")
    names = {s["id"]: s["name"] for s in data["subjects"]}
    output = io.StringIO(newline="")
    writer = csv.writer(output, quoting=csv.QUOTE_ALL, lineterminator="\r\n")

    def row(values):
        writer.writerow(["'" + str(value) if re.match(r"^\s*[=+@-]", str(value)) else value for value in values])

    row(["Date", "Subject", "Hours", "Task"])
    for day in plan["days"]:
        if not day["sessions"]:
            row([day["date"], "Rest / free time", 0, ""])
        for session in day["sessions"]:
            row([day["date"], names[session["subjectId"]], f"{session['hours']:g}", session["task"]])
    return output.getvalue()
