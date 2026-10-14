#!/usr/bin/env bash
set -Eeuo pipefail

# StockPilot WMS autonomous build/repair harness for Antigravity CLI.
# Run from the root of the target project: bash /path/to/run-wms-harness.sh
# Default mode enables Antigravity's non-interactive auto-approval so the loop
# does not stop for routine selections. Use --safe to respect existing policies.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(pwd -P)"
MAX_REPAIR_ROUNDS="${WMS_MAX_REPAIR_ROUNDS:-8}"
PRINT_TIMEOUT="${WMS_PRINT_TIMEOUT:-30m}"
AUTO_APPROVE=1

usage() {
  cat <<'USAGE'
StockPilot WMS autonomous harness

Usage:
  bash run-wms-harness.sh [--safe] [--rounds N]

Run it from the root of the repository you want Antigravity to build.

Options:
  --safe       Do not pass --dangerously-skip-permissions. Existing Antigravity
               permission rules apply; some commands may be soft-denied.
  --rounds N   Maximum repair/verification rounds (default: 8; max: 20).
  -h, --help   Show this help.

Environment:
  WMS_MAX_REPAIR_ROUNDS=8
  WMS_PRINT_TIMEOUT=30m

Logs and reports are written to .stockpilot-harness/ in the target repository.
USAGE
}

while (($#)); do
  case "$1" in
    --safe) AUTO_APPROVE=0; shift ;;
    --rounds)
      [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || { echo "--rounds requires an integer" >&2; exit 2; }
      MAX_REPAIR_ROUNDS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

(( MAX_REPAIR_ROUNDS >= 1 && MAX_REPAIR_ROUNDS <= 20 )) || { echo "Repair rounds must be between 1 and 20." >&2; exit 2; }
[[ "$PROJECT_DIR" != "/" && "$PROJECT_DIR" != "$HOME" ]] || {
  echo "Refusing to run from / or your home directory. cd into the specific project repository first." >&2
  exit 2
}
command -v agy >/dev/null 2>&1 || {
  echo "Antigravity CLI (agy) was not found on PATH. Install it and authenticate first: https://www.antigravity.google/docs/cli/install/" >&2
  exit 127
}

HARNESS_DIR="$PROJECT_DIR/.stockpilot-harness"
mkdir -p "$HARNESS_DIR/logs"
chmod 700 "$HARNESS_DIR" "$HARNESS_DIR/logs" 2>/dev/null || true
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_LOG="$HARNESS_DIR/logs/run-$RUN_ID.log"
REPORT="$HARNESS_DIR/FINAL-REPORT-$RUN_ID.md"
STATE="$HARNESS_DIR/LAST-RUN.txt"

# Avoid accidentally adding harness logs/reports to Git history.
if [[ -d "$PROJECT_DIR/.git" ]]; then
  if ! grep -qxF '.stockpilot-harness/' "$PROJECT_DIR/.git/info/exclude" 2>/dev/null; then
    printf '\n# Local Antigravity autonomous harness output\n.stockpilot-harness/\n' >> "$PROJECT_DIR/.git/info/exclude"
  fi
fi

exec > >(tee -a "$RUN_LOG") 2>&1
trap 'rc=$?; printf "\nHarness exited with code %s at %s\n" "$rc" "$(date -Is 2>/dev/null || date)"; echo "See log: $RUN_LOG"; exit "$rc"' EXIT

printf 'StockPilot WMS harness started: %s\nProject: %s\nRun ID: %s\n' "$(date)" "$PROJECT_DIR" "$RUN_ID"
printf 'Repair rounds: %s | Timeout per agent turn: %s | Auto-approve: %s\n' "$MAX_REPAIR_ROUNDS" "$PRINT_TIMEOUT" "$AUTO_APPROVE"
agy --version

if [[ -d "$PROJECT_DIR/.git" ]]; then
  echo "Initial Git status (preserve all existing user changes):"
  git -C "$PROJECT_DIR" status --short || true
  git -C "$PROJECT_DIR" diff --stat || true
fi

printf 'RUN_ID=%s\nPROJECT_DIR=%s\nSTARTED_AT=%s\n' "$RUN_ID" "$PROJECT_DIR" "$(date -Is 2>/dev/null || date)" > "$STATE"

AGY_FLAGS=(--print-timeout "$PRINT_TIMEOUT")
if (( AUTO_APPROVE )); then
  AGY_FLAGS+=(--dangerously-skip-permissions)
fi

run_first_turn() {
  local prompt_file="$1"
  echo "\n===== INITIAL BUILD TURN: $prompt_file ====="
  if [[ ! -f "$prompt_file" ]]; then echo "Missing prompt file: $prompt_file"; return 2; fi
  agy -p "$(cat "$prompt_file")" "${AGY_FLAGS[@]}"
}

run_continue_turn() {
  local prompt="$1"
  echo "\n===== CONTINUED AGENT TURN ====="
  agy -p "$prompt" --continue "${AGY_FLAGS[@]}"
}

# One long-lived conversation: initial specification, then explicit build, QA,
# and repair turns. Every turn has a bounded timeout and is captured in the log.
run_first_turn "$SCRIPT_DIR/prompts/MASTER-WMS-BUILD.md"
run_continue_turn "Continue autonomously in this same repository and same project context. Do not ask me to choose between alternatives. Inspect the actual files and turn the plan into implemented code. Prioritize a complete, coherent vertical slice across frontend, API, database, authentication, and tests. Use reasonable defaults, preserve existing work, avoid unrelated changes, and do not claim unverified success. Run available commands and fix failures. Keep going until the product is substantially implemented. At the end, list exact completed work and remaining blockers."

for ((round=1; round<=MAX_REPAIR_ROUNDS; round++)); do
  echo "\n===== QUALITY / REPAIR ROUND $round OF $MAX_REPAIR_ROUNDS ====="
  PROMPT="Autonomous quality gate round $round of $MAX_REPAIR_ROUNDS for StockPilot WMS. Do not ask the user questions or request design selections. Inspect the real repository and current Git diff. Run all applicable install/typecheck/lint/unit/integration/build checks that are safe and configured. Start the app and exercise browser-based flows if the available environment supports it. Fix actual failures, not just describe them. Prioritize broken build, broken startup, API/database integration, auth/authorization, inventory transaction correctness, nonfunctional UI controls, console/network errors, responsive layout, and missing loading/error states. Never delete user work, expose secrets, disable tests to make them pass, fake test results, or claim a deployment that did not happen. If a check cannot run because of missing credentials/services/tools, document the exact blocker and continue with other checks. Update README.md and create/update IMPLEMENTATION_STATUS.md with evidence: commands run, pass/fail results, features implemented, known limitations, and next actions. Then inspect whether meaningful defects remain and fix them in this turn."
  if ! run_continue_turn "$PROMPT"; then
    echo "Agent turn returned a non-zero exit code. Continuing with another repair round; inspect log for the cause."
  fi
  # Never rely on the agent's narrative alone: run deterministic repository checks when scripts exist.
  if [[ -f "$PROJECT_DIR/package.json" ]] && command -v npm >/dev/null 2>&1; then
    node -e 'const p=require(process.argv[1]); console.log(JSON.stringify(p.scripts||{},null,2))' "$PROJECT_DIR/package.json" > "$HARNESS_DIR/package-scripts.json" 2>/dev/null || true
    for check in lint typecheck test build; do
      if node -e 'const p=require(process.argv[1]); process.exit(p.scripts && p.scripts[process.argv[2]] ? 0 : 1)' "$PROJECT_DIR/package.json" "$check" 2>/dev/null; then
        echo "\n===== DETERMINISTIC CHECK: npm run $check ====="
        (cd "$PROJECT_DIR" && npm run "$check") || echo "CHECK_FAILED: npm run $check (see log; agent will be asked to repair)"
      fi
    done
  fi
  if [[ -f "$PROJECT_DIR/IMPLEMENTATION_STATUS.md" ]]; then
    cp "$PROJECT_DIR/IMPLEMENTATION_STATUS.md" "$REPORT" || true
  fi
  printf 'LAST_ROUND=%s\nUPDATED_AT=%s\n' "$round" "$(date -Is 2>/dev/null || date)" >> "$STATE"
done

# Final independent handoff request; never accept unverified claims as proof.
run_continue_turn "Final handoff audit for StockPilot WMS. Do not make broad risky rewrites. Inspect current files, Git diff, project scripts, and available test output. Run final applicable checks one more time. Write a concise, truthful IMPLEMENTATION_STATUS.md and README section stating exactly how to start the frontend/backend/database, how to run migrations and seeds, test commands and their actual results, demo login details only if safely configured, features that genuinely work, and limitations/blockers. Never put secrets or production credentials in docs. If deployment was not performed, state that clearly. Do not ask me to select anything. Finish by reporting only evidence-backed outcomes."

if [[ -f "$PROJECT_DIR/IMPLEMENTATION_STATUS.md" ]]; then
  cp "$PROJECT_DIR/IMPLEMENTATION_STATUS.md" "$REPORT"
else
  cat > "$REPORT" <<'REPORT'
# StockPilot WMS — Harness Report

Antigravity did not create `IMPLEMENTATION_STATUS.md`. Review the run log and repository directly. This harness does not certify the product as complete merely because the agent process exited.
REPORT
fi

printf '\nFINISHED_AT=%s\nREPORT=%s\nLOG=%s\n' "$(date -Is 2>/dev/null || date)" "$REPORT" "$RUN_LOG" >> "$STATE"
echo "\nHarness finished."
echo "Report: $REPORT"
echo "Log: $RUN_LOG"
echo "State: $STATE"
echo "Review IMPLEMENTATION_STATUS.md and test results before using the system with real inventory."
