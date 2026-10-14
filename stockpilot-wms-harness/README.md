# StockPilot WMS — Antigravity autonomous build harness

This harness repeatedly instructs Antigravity CLI to implement, verify, and repair a Warehouse Management System. Run it from the **root of the repository you want to build**. It is not a prebuilt WMS and cannot guarantee success; it automates agent turns and captures evidence/logs.

## Requirements

- macOS/Linux shell with Bash
- Antigravity CLI (`agy`) installed and authenticated
- A target project directory (existing repo or empty project directory)
- Node/npm and Docker/PostgreSQL if the chosen app stack requires them

Official CLI installation: https://www.antigravity.google/docs/cli/install/

## Run it

1. Extract this folder somewhere stable.
2. Open Terminal and `cd` into your target WMS project directory.
3. Run:

```bash
bash /path/to/stockpilot-wms-harness/run-wms-harness.sh
```

Default mode passes `--dangerously-skip-permissions` to Antigravity so routine tool approvals do not interrupt the run. This grants broad permission to the agent and is risky. Run only in a dedicated project directory with no sensitive files, review the script first, and do not use it against a production repo or data. For permission-policy mode instead:

```bash
bash /path/to/stockpilot-wms-harness/run-wms-harness.sh --safe
```

The safe mode may stop making progress when a tool requires approval; Antigravity headless mode can soft-deny such tools under its policy.

To adjust the repair loop:

```bash
WMS_MAX_REPAIR_ROUNDS=10 WMS_PRINT_TIMEOUT=45m bash /path/to/stockpilot-wms-harness/run-wms-harness.sh
```

or `--rounds 10`. Allowed repair rounds: 1–20.

## Outputs

The target repository gets `.stockpilot-harness/` containing logs, run state, and a report snapshot. The harness also asks the agent to maintain:

- `IMPLEMENTATION_PLAN.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_STATUS.md`
- `README.md`

The harness does not infer success from agent prose. Review the actual test results and status report before using real inventory.

## Limitations

The harness can automate agent turns but cannot guarantee a finished product, unlimited model credits, working network access, installed browser tools, database availability, credentials, or external deployment. It deliberately does not deploy to external services. Missing dependencies or permissions must be resolved if they block a check. It does not replace a human security review before handling real business data.
