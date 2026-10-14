#!/usr/bin/env bash
set -Eeuo pipefail

# Run from the actual StockPilot WMS repository root, only after other build/edit agents finish.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(pwd -P)"
SAFE=0
ROUNDS="${WMS_PREMIUM_UX_ROUNDS:-4}"
TIMEOUT="${WMS_PREMIUM_UX_TIMEOUT:-30m}"

usage() {
  cat <<'USAGE'
StockPilot India Premium UX harness

Run from the WMS repository root:
  bash /path/to/stockpilot-wms-harness/run-wms-premium-ux.sh

Options:
  --safe       Respect Antigravity permission checks
  --rounds N   Verification/repair rounds (1-10; default 4)
  -h, --help   Show help

Do not run concurrently with the builder, redesign runner, or any agent editing this repository.
USAGE
}
while (($#)); do
  case "$1" in
    --safe) SAFE=1; shift ;;
    --rounds) [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || { echo '--rounds requires an integer' >&2; exit 2; }; ROUNDS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done
(( ROUNDS >= 1 && ROUNDS <= 10 )) || { echo 'Rounds must be between 1 and 10.' >&2; exit 2; }
[[ "$PROJECT_DIR" != "/" && "$PROJECT_DIR" != "$HOME" ]] || { echo 'Run from the specific WMS repository root.' >&2; exit 2; }
command -v agy >/dev/null 2>&1 || { echo 'Antigravity CLI (agy) not found on PATH.' >&2; exit 127; }
[[ -f "$SCRIPT_DIR/prompts/INDIA-WMS-PREMIUM-UX.md" ]] || { echo 'Missing premium UX specification.' >&2; exit 2; }

# Conservative guard: refuse when an obvious Antigravity process is active.
if pgrep -f '[a]gy .*--print-timeout' >/dev/null 2>&1; then
  echo 'An Antigravity harness-style process appears to be running. Refusing to edit the same project concurrently.'
  echo 'Wait until the other harness has finished, then rerun this script.'
  exit 3
fi

OUT="$PROJECT_DIR/.stockpilot-harness/premium-ux"
mkdir -p "$OUT/logs"
chmod 700 "$OUT" "$OUT/logs" 2>/dev/null || true
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG="$OUT/logs/premium-ux-$RUN_ID.log"
REPORT="$OUT/PREMIUM-UX-REPORT-$RUN_ID.md"
exec > >(tee -a "$LOG") 2>&1
trap 'rc=$?; echo "Premium UX harness exited with code $rc at $(date)"; exit "$rc"' EXIT

printf 'StockPilot India Premium UX refinement\nProject: %s\nRun ID: %s\nRounds: %s\n' "$PROJECT_DIR" "$RUN_ID" "$ROUNDS"
agy --version
if [[ -d "$PROJECT_DIR/.git" ]]; then
  echo 'Initial Git status (existing changes will be preserved):'
  git -C "$PROJECT_DIR" status --short || true
fi

FLAGS=(--print-timeout "$TIMEOUT")
if (( ! SAFE )); then FLAGS+=(--dangerously-skip-permissions); fi

agy -p "$(cat "$SCRIPT_DIR/prompts/INDIA-WMS-PREMIUM-UX.md")" "${FLAGS[@]}"
for ((i=1; i<=ROUNDS; i++)); do
  PROMPT="Premium UX verification and repair round $i/$ROUNDS. Inspect the actual repository and current diff. Follow prompts/INDIA-WMS-PREMIUM-UX.md as the controlling specification. Improve visual hierarchy, typography, spacing, responsive behavior, Indian warehouse workflows, and only data-backed useful charts/figures. Inspect real browser output if browser automation is available. Fix actual defects, not just report them. Preserve existing user changes, API contracts, backend logic, and inventory invariants. Run available lint/typecheck/tests/build and report only commands actually executed. Never fabricate screenshot evidence or test success. Update IMPLEMENTATION_STATUS.md with evidence and unresolved blockers. Do not ask the user to choose anything."
  if ! agy -p "$PROMPT" --continue "${FLAGS[@]}"; then echo "Agent returned non-zero in round $i; inspect log and continue if possible."; fi
  if [[ -f "$PROJECT_DIR/package.json" ]] && command -v npm >/dev/null 2>&1; then
    for check in lint typecheck test build; do
      if node -e 'const p=require(process.argv[1]);process.exit(p.scripts&&p.scripts[process.argv[2]]?0:1)' "$PROJECT_DIR/package.json" "$check" 2>/dev/null; then
        echo "===== npm run $check ====="
        (cd "$PROJECT_DIR" && npm run "$check") || echo "CHECK_FAILED: npm run $check"
      fi
    done
  fi
done

agy -p "Final StockPilot premium UX handoff. Inspect current files and Git diff. Do not do a broad rewrite. Confirm the main navigation is simple, Home is actionable, inventory lookup is fast, Inward/Outward are guided, and all charts/figures are meaningful and backed by real data. Run final available checks and update IMPLEMENTATION_STATUS.md with actual changes, commands, test results, browser checks actually performed, and unresolved blockers. Do not ask the user to choose anything." --continue "${FLAGS[@]}"
if [[ -f "$PROJECT_DIR/IMPLEMENTATION_STATUS.md" ]]; then cp "$PROJECT_DIR/IMPLEMENTATION_STATUS.md" "$REPORT"; else printf '# Report unavailable\n\nThe agent did not create IMPLEMENTATION_STATUS.md. See the log for details.\n' > "$REPORT"; fi
printf '\nFinished at %s\nReport: %s\nLog: %s\n' "$(date)" "$REPORT" "$LOG"
