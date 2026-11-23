"""Run the same coursework scenarios against the Python scheduling engine."""
from datetime import datetime, timezone
import json
from pathlib import Path
from .planner import generate_plan

ROOT = Path(__file__).resolve().parents[1]


def evaluate_cases():
    cases = json.loads((ROOT / "test-data/cases.json").read_text())
    results = []
    for case in cases:
        output = generate_plan(case["input"])
        if case["expect"] == "invalid":
            passed = not output["ok"] and bool(output.get("errors"))
            actual = "Input accepted" if output["ok"] else " ".join(output["errors"])
        elif not output["ok"]:
            passed, actual = False, " ".join(output["errors"])
        else:
            validation = output["validation"]
            passed = validation["valid"] and validation["complete"] == (case["expect"] == "complete")
            detail = "all targets covered" if validation["complete"] else ", ".join(
                f"{s['name']}: {s['remaining']:g}h short" for s in validation["coverage"] if s["remaining"]
            )
            actual = f"{validation['scheduledHours']:g}h scheduled; {sum(c['pass'] for c in validation['checks'])}/6 checks; {detail}"
        results.append({**{k: case[k] for k in ("id", "name", "type", "expected", "input")},
            "actual": actual, "pass": passed, "output": output})
    return {"suite": "Python deterministic scheduler; not AI evaluation", "engine": "python",
        "timestamp": datetime.now(timezone.utc).isoformat(), "results": results}


if __name__ == "__main__":
    report = evaluate_cases()
    target = ROOT / "test-data/local-results.json"
    target.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    count = sum(r["pass"] for r in report["results"])
    print(f"{count}/{len(report['results'])} Python scenarios passed. Saved {target.relative_to(ROOT)}.")
    raise SystemExit(0 if count == len(report["results"]) else 1)
