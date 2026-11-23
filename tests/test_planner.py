import copy
from datetime import timedelta
import json
from pathlib import Path
import unittest

from backend.planner import (available_hours, check_plan, export_csv, generate_plan,
    parse_date, parse_model_output, strict_json, validate_input)

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "test-data/cases.json").read_text())
BASE = CASES[0]["input"]


class ScenarioTests(unittest.TestCase):
    """Each supplied normal, edge and invalid scenario is a separate test."""


def scenario_test(case):
    def run(self):
        result = generate_plan(case["input"])
        if case["expect"] == "invalid":
            self.assertFalse(result["ok"])
            self.assertTrue(result["errors"])
            return
        self.assertTrue(result["ok"])
        self.assertEqual(result["engine"], "python")
        self.assertTrue(result["validation"]["valid"])
        self.assertEqual(result["validation"]["complete"], case["expect"] == "complete")
        # Independently verify deadlines, hour limits and date coverage.
        totals, seen = {}, set()
        start = parse_date(case["input"]["startDate"])
        last = max(parse_date(s["examDate"]) for s in case["input"]["subjects"])
        for day in result["plan"]["days"]:
            self.assertNotIn(day["date"], seen)
            seen.add(day["date"])
            total = 0
            for session in day["sessions"]:
                subject = next(s for s in case["input"]["subjects"] if s["id"] == session["subjectId"])
                self.assertLess(day["date"], subject["examDate"])
                self.assertGreater(session["hours"], 0)
                self.assertEqual(session["hours"] * 4 % 1, 0)
                total += session["hours"]
                totals[subject["id"]] = totals.get(subject["id"], 0) + session["hours"]
            self.assertLessEqual(total, available_hours(case["input"], day["date"]))
        self.assertEqual(seen, {(start + timedelta(days=i)).isoformat() for i in range((last-start).days)})
        for subject in case["input"]["subjects"]:
            self.assertLessEqual(totals.get(subject["id"], 0), subject["hours"])
    return run


for case in CASES:
    setattr(ScenarioTests, "test_" + case["id"], scenario_test(case))


class PlannerTests(unittest.TestCase):
    def plan(self):
        return generate_plan(BASE)["plan"]

    def test_calendar_dates_and_rollover(self):
        for value in ("2026-02-30", "20261123", "2026-1-01", None, [], True):
            self.assertIsNone(parse_date(value))
        self.assertEqual((parse_date("2026-12-31") + timedelta(days=1)).isoformat(), "2027-01-01")
        self.assertIsNotNone(parse_date("2028-02-29"))

    def test_weekday_mapping(self):
        data = {**BASE, "availability": list(range(1, 8))}
        for i in range(7):
            self.assertEqual(available_hours(data, (parse_date("2026-11-23") + timedelta(days=i)).isoformat()), i+1)

    def test_generation_is_deterministic_without_mutation(self):
        before = copy.deepcopy(BASE)
        self.assertEqual(self.plan(), self.plan())
        self.assertEqual(BASE, before)

    def test_study_on_exam_day_is_rejected(self):
        plan = self.plan()
        day = next(d for d in plan["days"] if d["date"] == BASE["subjects"][0]["examDate"])
        day["sessions"] = [{"subjectId": "math", "hours": .25, "task": "Study"}]
        checks = {c["name"]: c["pass"] for c in check_plan(BASE, plan)["checks"]}
        self.assertFalse(checks["Study before exam dates"])

    def test_overbooking_and_target_overflow(self):
        plan = self.plan()
        plan["days"][0]["sessions"] = [{"subjectId": "math", "hours": 12, "task": "Study"}]
        checks = {c["name"]: c["pass"] for c in check_plan(BASE, plan)["checks"]}
        self.assertFalse(checks["Within daily availability"])
        self.assertFalse(checks["Within study-hour targets"])

    def test_unknown_subjects(self):
        for subject_id in ("unknown", "__proto__", "toString", [], None):
            with self.subTest(subject_id=subject_id):
                plan = self.plan()
                plan["days"][0]["sessions"] = [{"subjectId": subject_id, "hours": 1, "task": "Study"}]
                self.assertFalse(check_plan(BASE, plan)["valid"])

    def test_duplicate_and_missing_days(self):
        plan = self.plan()
        plan["days"].append(copy.deepcopy(plan["days"][0]))
        self.assertFalse(check_plan(BASE, plan)["valid"])
        plan = self.plan()
        plan["days"].pop()
        self.assertFalse(check_plan(BASE, plan)["valid"])

    def test_malformed_hours_and_tasks(self):
        for hours in (-1, 0, .1, "1", None, True, float("nan"), float("inf")):
            with self.subTest(hours=hours):
                plan = self.plan()
                plan["days"][0]["sessions"][0]["hours"] = hours
                self.assertFalse(check_plan(BASE, plan)["valid"])
        plan = self.plan()
        plan["days"][0]["sessions"][0]["task"] = " "
        self.assertFalse(check_plan(BASE, plan)["valid"])

    def test_malformed_input_never_crashes(self):
        for data in (None, [], True, {}, {**BASE, "subjects": [None]}, {**BASE, "subjects": [{"id": []}]}):
            self.assertTrue(validate_input(data))
        for value in (True, float("nan"), float("inf"), 10**400):
            self.assertTrue(validate_input({**BASE, "availability": [value]*7}))

    def test_malformed_plan_never_crashes(self):
        for plan in (None, {}, [], {"days": None}, {"days": [None]},
                     {"days": [{"date": BASE["startDate"], "sessions": [None]}]}):
            self.assertFalse(check_plan(BASE, plan)["valid"])

    def test_model_json_and_size_limits(self):
        self.assertEqual(parse_model_output('```json\n{"days":[]}\n```'), {"days": []})
        for raw in ("Here is your plan", "x"*200001, '{"hours":NaN}', '{"hours":1e999}', None):
            with self.assertRaises(ValueError):
                parse_model_output(raw)
        with self.assertRaises(ValueError):
            strict_json('{"hours":Infinity}')

    def test_csv_escaping_and_validation(self):
        data = copy.deepcopy(BASE)
        data["subjects"][0]["name"] = '=HYPERLINK("example")'
        output = export_csv(data, generate_plan(data)["plan"])
        self.assertIn('"\'=HYPERLINK(""example"")"', output)
        self.assertTrue(output.startswith('"Date","Subject","Hours","Task"'))
        with self.assertRaises(ValueError):
            export_csv(BASE, {"days": []})


if __name__ == "__main__":
    unittest.main()
