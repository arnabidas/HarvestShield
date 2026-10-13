# HarvestShield V0.1

Tomato post-harvest decision-support prototype.

Condition → Risk → Decision → Intervention Priority

Built for Tata Imagination Challenge 2026.

## Machine Simulator on the dashboard

Open **Machine Simulator** in the sidebar. The uploaded React/Three.js prototype
is embedded as a Streamlit component, alongside the original seven pages.
Inspection lanes, whole-crate gates, spatial maps, risk bubbles, recovery,
traceable output lots, replay/export and the approved-only warehouse planner
use the prototype's existing engine. Sample photos or uploaded images use the
same preserved tomato checkpoint as Analyze Batch, including multi-view evidence.

The component communicates with Python through Streamlit; users do not need to
run a local Node server or open another website. The original Python planner
comparison uses the existing risk and decision engines. The two planners retain
their different purposes: intervention priority versus approved-only allocation.

The machine remains a simulation. Hosted review actions are demo inputs, not
authenticated production operator receipts. Photos stay in the current inference
request; exported evidence contains hashes and predictions rather than image bytes.
Browser save/restore is local to the simulator and does not persist dashboard batches.

`simulator/dist/` is committed so Streamlit Cloud can serve the component without
an npm build during deployment. To change the simulator frontend:

```sh
cd simulator
npm ci
npm run build
npm test
HARVESTSHIELD_CHROMIUM=/usr/bin/chromium npx playwright test -c playwright.streamlit.config.ts
```

Run the last command with the Streamlit app already running on port 8501, or set
`HARVESTSHIELD_STREAMLIT_URL` to the deployed site. `HARVESTSHIELD_CHROMIUM` is optional
when Playwright's own Chromium is installed. Commit the rebuilt dist alongside source
changes. From the repository root, run `python -m unittest discover -s tests -v`
in the prepared Python environment. Photo credits are in
`docs/SAMPLE_PHOTO_CREDITS.md`. The standalone prototype can still be run separately;
see `simulator/README.md`.

### Dashboard design integration

The machine workspace shares `assets/harvestshield_theme.json` with the Python
dashboard: charcoal surfaces, lime actions, semantic amber/red status colors,
Source Sans typography and consistent card radii. The native Streamlit theme is
configured in `.streamlit/config.toml`. Embedded mode uses focused workspace tabs,
retains run state across those tabs, and removes standalone branding/navigation
duplication. Photo analysis opens from the workspace toolbar. The font is bundled
locally with its SIL Open Font License; no external font service is required.

## Important limitations

- Tomato-only prototype
- Risk score is not a probability of spoilage
- No exact remaining shelf-life prediction
- Resource allocation is an explainable heuristic
