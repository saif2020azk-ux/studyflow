"""Start Studyflow: python3 app.py (no third-party packages required)."""
import argparse
import os
from backend.server import create_server


def main():
    parser = argparse.ArgumentParser(description="Studyflow Python study planner")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5173")))
    args = parser.parse_args()
    try:
        server = create_server(args.host, args.port)
    except OSError as exc:
        parser.exit(1, f"Could not start Studyflow: {exc}. Try --port 5174.\n")
    print(f"Studyflow (Python): http://{args.host}:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStudyflow stopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
