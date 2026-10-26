from __future__ import annotations

import compileall
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    print("[1/2] Compiling backend modules")
    if not compileall.compile_dir(ROOT / "app", quiet=1):
        print("Compilation failed.", file=sys.stderr)
        return 1

    print("[2/2] Running backend test suite")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=ROOT,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
