# StockPilot WMS — Premium UX refinement harness

This follow-up harness refines the existing app rather than replacing it. It targets a professional, premium but restrained UI for Indian e-commerce warehouses, FMCG distributors, wholesalers, and large retail stores. It includes explicit requirements for useful, real-data-backed charts and operational figures while prohibiting decorative or fabricated visuals.

## Run

Run only after all other agents that edit the same repository have finished. Open Terminal in the **actual WMS repository root**, then run:

```bash
bash "/path/to/stockpilot-wms-harness/run-wms-premium-ux.sh"
```

Replace `/path/to/` with the actual extracted harness folder path. Optional safer mode:

```bash
bash "/path/to/stockpilot-wms-harness/run-wms-premium-ux.sh" --safe
```

The default uses Antigravity's `--dangerously-skip-permissions` flag to minimize routine prompts. That gives the agent broad command authority. Use only in a dedicated project directory, inspect the script, and use `--safe` if you do not want to bypass permission checks. Do not run alongside the original builder or another redesign harness.

Logs and reports are written to `.stockpilot-harness/premium-ux/` inside the WMS repository.

The harness has not been run against the user's actual repository. It cannot guarantee a successful build, browser automation, external integration, or deployment. It should report blockers rather than invent success.
