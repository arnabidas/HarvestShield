# HarvestShield browser simulator

## Hosted Streamlit integration

This prototype is now available as **Machine Simulator** in the HarvestShield
Streamlit dashboard. The committed `dist/` runs as a custom component; real image
inference and the original-planner comparison travel over Streamlit's component
channel to the existing Python backend. No local service is needed by website users.
The hosted page uses demo review actions, not the standalone protected operator
service. See the repository README for rebuilding and embedded browser checks.

The following sections describe the original standalone package and its optional
Node/Python services. Their historical deployment and test statements concern that
package, rather than verification of the current website.

A working local prototype of the proposed post-storage, pre-dispatch inspection machine. Mechanical behavior and crate-demo observations are **SYNTHETIC_FIXTURE**. Uploaded tomato photos are **REAL_TOMATO_MODEL** observations from the original checkpoint. Bubble and resource decisions are **HEURISTIC**; local inspector actions are **HUMAN** demo inputs. The frontend calls the loopback Python adapter for uploaded photos, with no fixture fallback.

## Start

Requires Node.js 22.12 or newer and npm. From this directory:

```powershell
npm ci
npm run dev
```

Open the printed local URL and press **Watch the Complete Machine**. The judge fixture processes twelve synthetic 150g items through three layers. A2 stays visually GOOD in holding slot 12; B4's later defect flags A2 for SECONDARY_SCREENING. All ordinary sorting waits for crate reconciliation. Rear-side defect F04, secondary screening, a fixture inspector decision, rejection, repacking and an approved-only constrained planner follow.

Space pauses/resumes, Right Arrow steps an event, Escape exits the camera tour. Drag to orbit and scroll to zoom. Station buttons focus equipment; choose an item in the inspector or click its mesh. Play/pause, speed, reset, seed, lanes, truck capacity, imports, exports and local save/restore affect the actual engine. Use `?fallback=1` for the accessible 2D view.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests need no GPU or Python. The image browser tests require the local inference service; run SetupInference.cmd once and LaunchSimulator.cmd before them. Browser tests use installed Microsoft Edge; CI uses `windows-latest`. Evidence screenshots live in `../docs/evidence/`. Run `python scripts/verify_legacy.py` from the repository root to check preserved Python syntax, pure legacy modules and checkpoint availability. Use scripts/verify_inference.py in the isolated environment for direct-checkpoint/API parity. Full Streamlit runtime is separate.

For the production build:

```powershell
npm run build
npm run preview
```

Serve `dist/` over HTTP on any static host. Opening `index.html` through `file://` cannot load the module worker. After building, fixture mode needs no external network or Python service. No remote deployment was changed in this session.

The packaged ZIP also includes the built `dist/` and a dependency-free server. With Node installed, run `LaunchSimulator.cmd` at the repository root, then open `http://127.0.0.1:4173/`. No npm installation is needed for that packaged build. In a source checkout, build first, then run `node serve-build.mjs` here.

## Scenario and replay

Scenario JSON schema version is `1.1`; legacy `1.0` inputs receive safe defaults and remain accepted, validated by `src/domain/schema.ts`. The original supplied `0.1-proposed-fixture` files remain intact in `../docs/reference-fixtures/`; `src/data/scenarios.ts` adapts them into executable inputs. Export an executable scenario to see the exact contract. Scenario changes start new immutable runs. Negative values, duplicate/malformed IDs, unsupported commodities and missing provenance are rejected. Upload limit: 5 MB; engine scenario limit: 10,000 items, not a measured performance guarantee.

Run JSON contains scenario, engine/config version, cursor, complete ledger, event hash, snapshot and the human-decision journal. CSV includes causal IDs and evidence source. Local IndexedDB stores the current scenario/run/ledger/snapshot and decisions; restore reconstructs state rather than trusting saved outcomes. Manual decisions are enabled after processing ends, so the journal replays in a defined order.

Available presets: complete machine, clean three-layer crate, rear-side defect, overlapping bubbles, sanitation hold, failed pickup, tracking loss, undersized buffer, count mismatch, missing views, constrained truck, tomato/apple/potato multi-batch and human backlog.

## Architecture

`domain/engine.ts` owns a seeded virtual clock and stable min-heap. The worker updates an internal draft; immutable published snapshots cross the worker boundary. Scene components project the ledger through a live virtual-clock reference. Safety checks run at reconciliation, packaging and completion. A worker advances the engine; `policy.ts` contains crate gates, spatial priority, routing, resource allocation and invariants. R3F renders original low-poly procedural machinery and instanced produce. Labels are local canvas sprites and require no external fonts/assets. IndexedDB uses Dexie.

The illustrative field is `severity * exp(-alpha * XY_distance²) * exp(-beta * layer_distance) * position_confidence`. Overlaps combine as `1 - product(1 - influence)`. Commodity coefficients and threshold carry `heuristic-1`. It changes **review priority**, never the recorded visual label, and is not contamination probability.

Mass is integer grams. Source item IDs encode batch, crate, layer and index. Approved output lots preserve each source ID. Planner allocations reserve whole-item quantities and check the provenance-backed handling window, transit, buffer, suitable storage and remaining capacity. Rejected and unresolved quantities never enter the candidate list. The planner implements the original resource-aware objective with eligibility guards; the explicit comparison button also calls the preserved Python planner. Neither claims mathematical optimality.

## Completed extensions and external limits

Reserved lane groups, timed empty-lane changeovers, fair batch scheduling, upstream/downstream capacity, fault recovery, secondary retests, alternate-use segregation, optional conceptual rinse, exact 120 kg validation and environmental comparisons are implemented. Operator actions are journalled and replayed. Large jumps/comparisons run in the worker. Versions 1.0/1.1 and IndexedDB migration are supported.

`npm run benchmark` measures 100/500/1000 CPU runs. Browser evidence records actual R3F frame timing using `?benchmark=1`; that disables adaptive fallback for raw measurement. SwiftShader performance is below a general 30 FPS guarantee. Normal large runs switch to 2D after sustained slow graphics while keeping every ID/ledger record. The small judge demonstration stays in 3D.

Optional operator/viewer authentication, server-validated receipts, same-origin embedding and a container recipe are prepared. The website, hosting target and locked image dataset are unavailable. See ../docs/INTEGRATION_AND_DEPLOYMENT.md. Container build, native-GPU performance, manual screen-reader checks and physical/multi-view calibration remain unverified.

## Drag-and-drop image run and visual panels

The packaged launcher now starts both the page and real model API. On a fresh extraction, run `SetupInference.cmd` once, then `LaunchSimulator.cmd`. Photos stay local. Dropping on the machine or its input zone starts one image-linked run; the result stays hidden until a route output is reached. One photo retains unknown hidden-surface coverage, so a Fresh classification is not automatically approved for market dispatch. Model evidence and hashes are exported for deterministic replay, without storing image bytes.

Spatial map and Risk bubble are animated tabs beside the machine, driven by its virtual clock. Mapping shows original X/Y IDs and layer snapshots; the bubble panel shows configured distance/layer decay and review priority. Both freeze on pause. See ../docs/REAL_IMAGE_DEMO.md and ../docs/SAMPLE_PHOTO_CREDITS.md.

## New scenarios and evidence tools

Select **120 kg eligibility validation** or **Environmental risk comparison**, then finish processing. The 120 kg fixture uses synthetic 1 kg accounting units; 85 kg become eligible and 35 kg remain excluded. Environmental comparison holds visual findings constant while changing known tomato environment/age.

**Recovery and secondary retesting** requires actor/reason evidence; recovery also requires the exact original ID. Alternate use needs an explicit destination and never creates fresh-market dispatch. Conceptual rinse and profile permission are off by default.

Choose up to eight distinct views of one tomato. Individual predictions are retained; maximum Rotten score selects the conservative route. The photo map records visible manual positions; its export preserves pixel coordinates/image hash with unknown depth/layer/mass.

After building, `node test-access.mjs` starts isolated Node/Python services, uses temporary random credentials and shuts them down. HARVESTSHIELD_PYTHON can select another inference-capable runtime.
