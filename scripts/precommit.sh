#!/usr/bin/env bash
# Fast local quality gate (enforces design/CODING-STANDARDS.md).
# Each check is skipped (not faked) if its toolchain/deps are not installed yet, so this is
# safe to run before `npm install`. Wire it as a git hook after `git init`:
#   ln -sf ../../scripts/precommit.sh .git/hooks/pre-commit
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

if [ -d app/node_modules ]; then
  echo "==> app: lint"        && (cd app && npm run lint)        || fail=1
  echo "==> app: type-check"  && (cd app && npx tsc --noEmit)    || fail=1
  echo "==> app: tests"       && (cd app && npm test -- --ci)    || fail=1
else
  echo "==> app: skipped (run 'cd app && npm install' first)"
fi

if command -v ruff >/dev/null 2>&1; then
  echo "==> ml: ruff"  && ruff check ml || fail=1
else
  echo "==> ml: ruff skipped (pip install ruff)"
fi
if command -v mypy >/dev/null 2>&1; then
  echo "==> ml: mypy"  && mypy ml || fail=1
else
  echo "==> ml: mypy skipped (pip install mypy)"
fi

if [ "$fail" -ne 0 ]; then
  echo "precommit: checks failed" >&2
  exit 1
fi
echo "precommit: ok"
