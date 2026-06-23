#!/usr/bin/env bash
# Local pre-commit gate (enforces the coding standards). Runs the ML checks via the project
# venv and the app checks when its deps are installed; each section skips cleanly if its
# toolchain is absent. Install as a git hook:
#   ln -sf ../../scripts/precommit.sh .git/hooks/pre-commit
set -euo pipefail
# Resolve the repo root robustly whether run directly or as a symlinked git hook ($0 = .git/hooks/..).
cd "$(git rev-parse --show-toplevel)"

fail=0

if [ -x ml/.venv/bin/ruff ]; then
  echo "==> ml: ruff"   ; (cd ml && .venv/bin/ruff check src tests) || fail=1
  echo "==> ml: mypy"   ; (cd ml && .venv/bin/mypy)                 || fail=1
  echo "==> ml: pytest" ; (cd ml && .venv/bin/pytest -q)            || fail=1
else
  echo "==> ml: skipped (python3 -m venv ml/.venv && ml/.venv/bin/pip install -e 'ml[dev]')"
fi

if [ -d app/node_modules ]; then
  echo "==> app: lint/types/tests"
  (cd app && npm run lint && npx tsc --noEmit && npm test -- --ci) || fail=1
else
  echo "==> app: skipped (cd app && npm install)"
fi

if [ "$fail" -ne 0 ]; then
  echo "precommit: FAILED" >&2
  exit 1
fi
echo "precommit: ok"
