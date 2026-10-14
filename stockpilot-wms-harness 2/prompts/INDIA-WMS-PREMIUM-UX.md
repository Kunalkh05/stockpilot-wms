# StockPilot WMS — Premium UI/UX Refinement for Indian Warehouse Operations

## Mission

Refine the existing StockPilot WMS into a polished, credible, premium-feeling B2B operations product for Indian e-commerce fulfillment centers, distributors, FMCG warehouses, wholesalers, and multi-branch retailers. The current UI is reportedly too complex. Reduce cognitive load while making the interface more visually composed, useful, and trustworthy.

This is an implementation task, not a concept exercise. Inspect the real repository and running application, then modify the actual UI. Do not ask the user to choose options. Make sound product decisions, test them, fix defects, and report evidence honestly.

The provided `https://dash.cloudflare.com/` URL is Cloudflare's dashboard, not proof of the StockPilot app's appearance. Inspect local source and, if available, the local app using browser automation. Never claim to have inspected a URL or screenshot you could not access.

## Non-negotiable guardrails

- Inspect `git status`, project structure, existing design system, routes, API contracts, and current implementation before edits.
- Preserve user changes, backend logic, database schema, working workflows, and API contracts. Do not start over or run destructive cleanup.
- Do not replace real API-backed data with fixtures or pretend integrations. Seed/demo data must be clearly marked as such.
- Keep Amazon/Flipkart-like operational familiarity in workflow patterns only; do not copy their proprietary interface or branding. No claim of actual marketplace integration unless one is implemented.
- Do not add AI chat, fake AI insights, decorative gradients, stock photography, arbitrary charts, fake counters, or features unrelated to warehouse work.
- Do not create empty routes or dead controls. Every visible primary action must do something real or be explicitly disabled with an explanation.
- Do not change backend business rules to make the UI easier. Preserve quantity reconciliation, reservation rules, and transaction safety.
- Work autonomously. Do not stop after planning or ask the user to approve visual options.

## Product personality

The product should feel like a serious, premium operations tool: precise, calm, efficient, and dependable. It should be visually distinctive through typography, alignment, restrained color, thoughtful density, and excellent interaction details—not through visual effects.

### Design system

First inspect the current stack. Reuse its existing components where sound; avoid adding duplicate libraries.

Recommended visual direction:
- Light theme: soft neutral app canvas (`#F6F7F8`-like), white working surfaces, charcoal text, cool grey borders.
- One restrained brand accent: deep indigo/navy or muted burnt orange. Use it for selected navigation, primary actions, and focused data—not every element.
- Semantic colors are consistent: green = completed/healthy, amber = needs attention, red = blocked/error, blue = informational. Always pair color with readable text/icon.
- Typography: modern sans-serif such as Inter; clear hierarchy; compact page titles; tabular numerals for quantities and currency.
- Spacing based on a consistent 4/8 px rhythm; small, consistent radii; fine borders; shadows only for floating overlays.
- Icons: Lucide, consistent 16/18/20 px sizing and stroke weight.
- Motion: brief, restrained transitions for menus, drawers, and status changes; respect reduced-motion preferences.
- Use INR formatting (`₹1,24,500`) and Indian number grouping when currency is actually present. Use `Asia/Kolkata` consistently for local display while storing timestamps correctly.

Avoid: generic SaaS gradient hero, glassmorphism, giant KPI tiles, oversized rounded cards, excessive pill badges, emoji icons, neon colors, decorative blobs, huge empty whitespace, meaningless illustrations, unnecessary animation, and an all-card layout.

## Information architecture

Keep the main navigation compact:
- Home
- Orders
- Inventory
- Inward
- Outward
- Locations
- Reports

Move Suppliers, Customers, Purchase Orders, Returns, Stock Adjustments, Users, Roles, Audit Log, and Settings under a secondary “More” or “Administration” area, according to what exists in the app. Use clear grouping and do not hide high-frequency actions in nested menus.

App shell:
- Compact, collapsible left sidebar with active item clearly visible.
- Top bar with current warehouse selector, contextual breadcrumbs, global search if functional, notifications only if backed by real events, and user menu.
- Clear page title + short task-oriented subtitle where needed.
- Page-specific primary action aligned consistently at the top right.
- Main content starts with the task or data users came to do, not decorative content.
- Avoid nested modal-on-modal flows. Prefer a detail page or side drawer for secondary detail.

## Page-by-page UX and visualization requirements

### 1. Home — “Today at the warehouse”

The dashboard must answer: what needs work, what is blocked, and what is happening today?

Top strip: no more than four compact, clickable operational metrics:
- Orders to process
- Inward pending
- Outward pending
- Low-stock items

Below the metrics, create a deliberate two-column composition at desktop:
- Main column: “Work queue” with prioritized tasks, age/priority, short context, and a clear action.
- Secondary column: “Needs attention” with stock exceptions, delayed orders, receipts needing review, and system-backed alerts.

Include one useful operational figure only if real data supports it. Prefer a compact 7-day inbound vs outbound bar chart or a clear order-stage horizontal bar/funnel. It must have a meaningful title, units, date range, accessible tooltip/legend, and a no-data state. Avoid pie charts unless proportions are the actual question.

Include a compact recent activity table below or in a secondary tab. Remove duplicated metrics and any chart that does not change a decision. Clicking metrics should open a relevant filtered queue.

### 2. Orders — work queue first

Default view is a clean, fast table. Use simple views/tabs such as All, New, To Pick, To Pack, Dispatched, Exceptions only when status mapping exists.

Columns should prioritize: order ID, channel/source, created time, item count, fulfilment state, priority/age, and next action. Use readable state labels, not color alone. Provide search, sensible filters, sort, pagination, and a compact filter summary with a one-click clear action.

Detail view should show an order summary, item lines, reserved/picked quantities, event timeline, customer/ship-to details when available, and the next valid action. Make state transitions explicit. Never expose invalid actions just because a button can be hidden.

Do not use Amazon/Flipkart logos or imply a real marketplace connector unless the connector exists. Use a neutral channel label: Marketplace, Website, Store, Wholesale, or Manual only if supported by data.

### 3. Inventory — make stock lookup excellent

Inventory search is a primary product capability. Place one obvious search field at the top that searches SKU, product name, barcode, or location only if those fields exist and are actually searchable. Use a keyboard shortcut only if implemented and discoverable.

Default table columns:
- SKU
- Product name
- Available
- On hand
- Reserved
- Bin/location
- Status

Move category, warehouse, stock state, and other filters into a compact filter bar; advanced filters may collapse. Keep column alignment consistent: identifiers left aligned, quantities right aligned, dates consistent, numeric values tabular. Make row hover and selection states subtle but visible.

Product detail should use a clear header and tabs/sections for Overview, Stock by Location, Movement History, and Batch/Lot where applicable. Include a small stock composition visualization (On hand / Reserved / Available) only if the arithmetic is correct and the visualization adds value. Do not show the same quantity three times in decorative cards.

Low-stock rows should explain why they are flagged, including current available stock and reorder threshold if those fields exist. Do not invent reorder values or prices.

### 4. Inward — receiving wizard

Use a stepper or clearly staged workflow with progress:
1. Select purchase order/supplier or choose supported ad-hoc receipt.
2. Add/scan item and expected/received quantities.
3. Record accepted, damaged, or rejected units.
4. Select destination bin and record lot/expiry only when required.
5. Review totals and confirm receipt.

Keep only the current step's fields prominent. Preserve entered values when moving between steps. Validate totals and show inline errors near the relevant field. Include a visible summary panel with SKU count, received units, accepted units, damaged units, and destination summary. The summary must update from form state, not be hardcoded.

Confirmation should state exactly what will change. Show success only after the server confirms it. Protect against duplicate receipt submission and refresh/retry duplication.

### 5. Outward — picking, packing, dispatch

Use a simple queue and guided stages:
1. Choose an eligible order or picking batch.
2. Show a clear pick list with SKU, product, quantity, source bin, and confirmed quantity.
3. Confirm picked quantities and surface discrepancies.
4. Pack items and record package details if supported.
5. Record carrier/tracking information if supported.
6. Dispatch and show a durable confirmation/reference.

Make the source bin prominent; warehouse operators should not have to infer where to go. A pick-progress indicator is useful if calculated from real line counts. Do not allow dispatch before required workflow stages are complete. Support barcode scanning only if actual input handling is implemented; otherwise make manual SKU entry excellent.

### 6. Locations — warehouse clarity

Represent warehouse → zone → aisle/rack → bin with a compact hierarchy, breadcrumbs, or expandable table. Make location codes easy to scan. Show item count, unit count, and capacity/occupancy only if the underlying data exists.

A warehouse map or bin heatmap is allowed only if it is backed by actual location structure and values. It must answer a question such as “which bins are full?”; it must not be a decorative floorplan. If no real map data exists, use a clear hierarchy/table instead.

### 7. Reports — a few decision-useful views

Prioritize Stock on Hand, Low Stock, Stock Movement, Orders Pending, Inward/Outward Activity, and Inventory Aging only where supported by actual data.

Every report should have a title, short definition, relevant warehouse/date filters, clear units, and an export action where feasible. Charts must have correct axes, units, accessible legends/tooltips, and meaningful empty states. Tables remain available for exact values. Never make up data to fill a chart.

Recommended chart choices:
- Time series: line chart for trend over time.
- Inbound vs outbound: grouped/stacked bars only if comparison is useful and categories are clear.
- Order stages: horizontal bars for stage counts.
- Stock composition: small stacked bar, not an oversized donut, unless the proportion is the key insight.
- Warehouse utilization: bars by warehouse/location when capacity data exists.

Do not add charts solely to make a page look impressive. If the data is insufficient, show a helpful empty state explaining what data is required.

## Interaction and UX quality bar

- Search, filters, sorting, pagination, tabs, and clear-filter controls must actually work.
- Every form has visible labels, validation, pending state, server error handling, and success feedback.
- Destructive or irreversible actions require a specific confirmation dialog explaining the consequence.
- Preserve focus when dialogs close and support keyboard navigation.
- Provide loading skeletons for major data regions, not full-screen spinners for every request.
- Empty states should explain what the user can do next and provide one relevant action where possible.
- Error states should be actionable and never silently fall back to demo data.
- Avoid toast-only feedback for important transactions; provide a persistent reference/status on the resulting page.
- Avoid overloading a page with helper text. Use inline hints only for ambiguous or high-risk fields.
- Make table density adjustable only if the existing app benefits from it; do not add settings without need.
- Respect reduced-motion settings and keyboard focus. Target WCAG 2.2 AA where practical.
- Desktop at 1440px/1280px should feel composed; tablet at 768px should remain usable; mobile at 390px should prioritize task completion over forcing a wide desktop table onto a tiny screen.

## Figures and visual evidence required during implementation

If browser automation or screenshot tooling is available:
- Capture the existing UI before changing it, then capture Home, Orders, Inventory, Inward, Outward, and Locations after changes.
- Inspect desktop 1440px and mobile 390px, plus tablet 768px where possible.
- Use screenshots to identify alignment, density, overflow, weak hierarchy, and inconsistent states; fix issues rather than only listing them.
- Save screenshots only inside a documented project artifact folder if the available tool supports it.
- Never claim a screenshot was captured if it was not.

If browser automation is unavailable, inspect source and styles, run the app if possible, and state clearly that visual browser verification could not be performed.

## Technical implementation constraints

- Keep existing framework, API client, data fetching strategy, and design-system conventions unless there is a strong reason to change them.
- Reuse existing shared components and extract new ones where repetition is real.
- Do not add multiple chart/table/form libraries that duplicate existing capabilities.
- Keep chart data derived from API responses. If backend aggregates are needed, use existing endpoints first; add endpoints only when justified and maintain API compatibility.
- Preserve API-backed mutations and server validation. Never put critical business logic solely in the frontend.
- Do not log secrets or customer personal data.
- Do not alter the database schema just for cosmetic UI changes.

## Execution loop

1. Inspect Git status, repository structure, routes, components, API calls, and current implementation.
2. Inspect the current running UI using browser tools if available. Identify the top five causes of complexity and visual inconsistency.
3. Create `WMS-PREMIUM-UX-PLAN.md` with a short checklist, then immediately implement.
4. Refine design tokens and the app shell before individual pages so the product feels consistent.
5. Implement Home, Inventory, Orders, Inward, Outward, and Locations first. Refine Reports and secondary navigation afterward.
6. Ensure charts/figures are meaningful, real-data-backed, correctly labeled, and accessible—or remove them.
7. Run existing lint, typecheck, tests, and production build scripts where available. Do not invent script names or claim unavailable checks passed.
8. Use browser screenshots and test the major flows if browser automation is available. Fix visible defects.
9. Inspect Git diff and ensure no unrelated work was removed or overwritten.
10. Write/update `IMPLEMENTATION_STATUS.md` with exact changes, commands, actual pass/fail results, screenshot/browser verification performed, and unresolved issues.

## Acceptance criteria

- The app feels premium through consistency and restraint, not visual gimmicks.
- The main workflow is immediately understandable to an Indian warehouse operator.
- Home is action-oriented and not cluttered with giant cards.
- Inventory search and quantity semantics are clear.
- Inward and Outward workflows are staged and understandable.
- Charts/figures appear only when they answer a real operational question and use real data.
- Indian currency and local time are formatted correctly when applicable.
- The UI is responsive and accessible; tables/forms handle loading, empty, error, and success states.
- Existing backend functionality and inventory integrity remain intact.
- Every primary action is functional and no fake marketplace integration is implied.
- The build and tests pass, or blockers are documented with evidence.

Now execute autonomously. Inspect, implement, test, fix, and report. Do not ask the user to select a design.
