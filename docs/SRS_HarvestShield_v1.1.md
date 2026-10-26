# HarvestShield — Software Requirements Specification (SRS)

**Version:** 1.1  
**Date:** 27 October 2026  
**Status:** Draft baseline; implementation verification required  
**Tagline:** Know what to save, before it spoils.  
**Live prototype:** https://harvestshield.streamlit.app/  
**Repository:** https://github.com/arnabidas/HarvestShield

## 1. Purpose and scope

HarvestShield is a tomato-focused, AI-assisted post-harvest decision-support prototype. It combines visible-condition classification from a tomato image with batch context to estimate an operational risk score and help users prioritize intervention when cold-storage or transport capacity is limited.

The product addresses two distinct questions: (1) what visible condition does the image model detect, and (2) given the risk assessment and available resources, which batch should receive attention first?

HarvestShield is a decision-support prototype, not a food-safety certification system, a guaranteed spoilage forecast, or a physical machine controller. It does not claim exact remaining shelf life or proven reduction in real-world losses.

### Objectives
- Classify visible tomato condition as Fresh or Rotten using the existing image model.
- Combine model output with temperature, humidity, days since harvest, and batch quantity.
- Produce an explainable operational risk score and intervention priority.
- Let users explore cold-storage and transport constraints.
- Demonstrate a traceable inspection/sorting workflow through the embedded Machine Simulator.
- Communicate assumptions, test metrics, and limitations clearly.
- Establish a testable foundation for future field validation.

### Intended users
- Demo visitors and evaluators.
- Operations users at FPOs, collection centres, packhouses, and fresh-produce aggregators.
- Project maintainers and developers.
- Future pilot administrators, if authentication and persistent records are added.

## 2. Product overview and architecture

### 2.1 Logical components

| Component | Responsibility | Baseline status |
|---|---|---|
| Streamlit dashboard | Overview, batch analysis, batch intelligence, resource planning, capacity comparison, methodology, and navigation | Present in repository |
| Image inference | Load the MobileNetV3-Small checkpoint, preprocess a tomato image, and return class/confidence outputs | Present in repository |
| Risk engine | Produce a prototype 0–100 operational score, LOW/MEDIUM/HIGH band, reasons, and cautions | Present in repository |
| Python decision engine | Rank batches and propose transport/cold-storage interventions under capacity limits | Present in repository |
| Embedded Machine Simulator | React/Three.js simulation embedded as a Streamlit component | Documented in repository |
| Simulator scenario engine | Scenario validation, inspection flow, traceable item state, replay/export, and approved-only allocation | Documented in simulator README |
| Persistent server database and production accounts | Multi-user history, access control, and operational record management | Not assumed to exist |

The Streamlit app and simulator expose two different planning workflows. The Python planner prioritizes intervention across batches. The simulator’s approved-only warehouse planner allocates only eligible output lots. Neither is claimed to be mathematically optimal or field-validated.

### 2.2 Dashboard workflows

The dashboard navigation includes Overview, Analyze Batch, Batch Intelligence, Resource Planner, Capacity Simulator, Machine Simulator, How HarvestShield Works, and Validation.

The Streamlit batch list and planner state are session-oriented. Simulator browser save/restore uses local simulator storage and does not persist dashboard batches. Do not describe either as a central production database.

## 3. Functional requirements

Priority: **MUST** means required for the defined workflow; **SHOULD** means important; **COULD** means future/optional. “Present” means documented or visible in the repository baseline; acceptance testing is still required.

### 3.1 Python dashboard and batch decision support

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The application shall present a clear dashboard and navigation to all documented workflows. | MUST |
| FR-02 | Analyze Batch shall accept a tomato image in a supported format and display a preview before analysis. | MUST |
| FR-03 | The app shall validate required fields and handle invalid/corrupt images without leaving stale results visible. | MUST |
| FR-04 | The image model shall return a Fresh or Rotten class, model confidence, and the configured visual-condition label. | MUST |
| FR-05 | Model confidence shall be labelled as classification confidence and shall not be presented as probability of future spoilage. | MUST |
| FR-06 | Batch analysis shall accept Batch ID, temperature in °C, humidity in %, days since harvest, and quantity in kg. | MUST |
| FR-07 | Inputs shall be validated for required values and supported ranges by the UI and backend. | MUST |
| FR-08 | The risk engine shall return a score, risk band, component scores, reasons, cautions, and a prototype-assumption notice. | MUST |
| FR-09 | The UI shall distinguish visual condition, model confidence, operational risk, and preliminary action. | MUST |
| FR-10 | Batch Intelligence shall rank batches using the documented heuristic and identify that the ranking is not an optimized allocation. | MUST |
| FR-11 | Resource Planner shall generate an intervention plan using available cold-storage and transport capacity, with actions and explanations. | MUST |
| FR-12 | Capacity Simulator shall compare current capacity with a proposed cold-storage/transport scenario using the Python decision engine. | SHOULD |
| FR-13 | Overview shall summarize current session batches, risk distribution, quantity, configured capacity, and the current priority queue. | SHOULD |
| FR-14 | Validation shall explain the model scope, evaluation results, assumptions, and known limitations. | MUST |
| FR-15 | Clear-all/reset actions shall clear active demo batches, plans, and related simulation state as documented. | MUST |
| FR-16 | The system shall fail safely if model loading or inference fails and shall not silently show a previous batch’s result as the new result. | MUST |

### 3.2 Machine Simulator

| ID | Requirement | Priority |
|---|---|---|
| SIM-01 | Machine Simulator shall run embedded in Streamlit; website users shall not need to start a separate Node server. | MUST |
| SIM-02 | The simulator shall support scenario-driven inspection/sorting, whole-crate gates, spatial maps, risk bubbles, recovery/retesting workflows, traceable output lots, replay/export, and approved-only warehouse planning as exposed by the current prototype. | MUST |
| SIM-03 | Synthetic fixture observations, real-image model outputs, heuristic decisions, and human demo inputs shall be clearly distinguished. | MUST |
| SIM-04 | Uploaded tomato photos shall use the existing tomato checkpoint; a simulator fixture must not silently replace failed real-image inference. | MUST |
| SIM-05 | Scenario import shall validate schema, identifiers, provenance, numeric values, and supported commodities. Malformed scenarios shall be rejected with a useful message. | MUST |
| SIM-06 | Current scenario schema is version 1.1. Valid legacy 1.0 inputs shall receive documented safe defaults where supported. | MUST |
| SIM-07 | The engine shall preserve source-item identifiers through inspection, rejection, repacking, and approved output lots. | MUST |
| SIM-08 | Rejected or unresolved items shall not enter the approved-only planner candidate set or approved output lots. | MUST |
| SIM-09 | A run/export shall preserve scenario/configuration version, ledger/event evidence, snapshot, and human-decision journal as supported by the engine. | MUST |
| SIM-10 | Exported evidence shall not include raw uploaded image bytes; it may include hashes, predictions, identifiers, and documented metadata. | MUST |
| SIM-11 | Browser save/restore shall be labelled as local simulator state and shall not imply that dashboard batches are saved. | MUST |
| SIM-12 | The simulator shall offer a 2D fallback where provided, preserving logical item/ledger state when the 3D view is unsuitable or slow. | SHOULD |
| SIM-13 | The embedded simulator shall communicate with the Python backend through the Streamlit component channel. | MUST |
| SIM-14 | Simulator human review/recovery actions are demo inputs, not authenticated production operator receipts. | MUST |

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 Reliability | Invalid input, model errors, and scenario errors shall produce recoverable feedback rather than an unhandled crash. |
| NFR-02 Explainability | Results shall separate classifier output, risk score, decision priority, and resource allocation. |
| NFR-03 Transparency | The score, component weights, thresholds, and prioritization rules shall be documented as prototype heuristics. |
| NFR-04 Reproducibility | Given the same inputs and configuration, Python risk and ranking functions shall return deterministic results. Seeded simulator scenarios should replay consistently within a defined version/configuration. |
| NFR-05 Privacy | The UI and documentation shall accurately state whether each data type is session-only, stored locally in the browser, or persisted remotely. |
| NFR-06 Security | Secrets shall not be committed. Uploaded files and imported scenario JSON shall be validated before processing. |
| NFR-07 Usability | Inputs shall show explicit units. Risk states shall not rely on colour alone; explanations and labels must remain readable. |
| NFR-08 Performance | Measure inference, scenario-engine CPU time, and browser rendering separately. Do not promise a universal FPS or response-time target without deployment evidence. |
| NFR-09 Maintainability | Keep UI, inference, risk scoring, Python decision logic, and simulator engine modular and independently testable. |
| NFR-10 Compatibility | The Streamlit app should work in current desktop browsers; test responsive behaviour and the simulator fallback. |
| NFR-11 Data integrity | Every simulator output lot shall retain traceability to source IDs; exports must not silently omit unresolved quantities. |
| NFR-12 Availability | The public hosted demo is best-effort unless a hosting SLA is established. |

## 5. Data and business rules

### 5.1 Main data objects
- **Batch input:** batch ID, image, temperature (°C), relative humidity (%), days since harvest, quantity (kg).
- **Image result:** visual-condition label, source class, model confidence, fresh score, deterioration score, disclaimer.
- **Risk result:** 0–100 score, LOW/MEDIUM/HIGH band, component scores, reasons, cautions, preliminary action, prototype-assumption notice.
- **Action plan:** batch ID, priority, risk, score, quantity, proposed action, resource used, remaining capacities, and reasons.
- **Simulator run:** scenario and configuration version, source IDs, ledger/events, snapshot, cursor, decision journal, and export metadata as supported by the implementation.

### 5.2 Business rules
1. The image classifier reports visible-condition evidence only; it is not a food-safety test.
2. The model’s classification confidence is not a probability of spoilage.
3. The risk score is a **prototype operational prioritization score**, not a calibrated biological model or remaining-shelf-life estimate.
4. Component weights, score bands, and age/temperature/humidity thresholds are prototype assumptions and must remain documented.
5. Python batch ranking uses risk category, risk score, days since harvest, and quantity as tie-break inputs, with higher values ranked first.
6. The Python resource planner uses a heuristic for intervention allocation. It does not claim global optimization or minimum economic loss.
7. Simulator spatial bubbles and fixture decisions are heuristic review-priority signals, not contamination probability.
8. The approved-only simulator planner may allocate only eligible approved output lots; rejected and unresolved quantities remain excluded.
9. Human users retain final responsibility for handling, dispatch, storage, food safety, and rejection decisions.
10. The system shall not claim exact remaining shelf life or proven loss reduction without suitable evidence.

## 6. Interface and limits

### 6.1 Batch input ranges

The current Analyze Batch UI documents JPG/JPEG/PNG uploads, temperature from -5°C to 50°C, humidity from 0% to 100%, days since harvest from 0 to 30, and batch quantity from 1 to 100,000 kg. Backend validation may impose additional constraints; the UI and backend ranges should remain consistent.

### 6.2 Simulator constraints documented in the repository

- Scenario schema: 1.1, with legacy 1.0 support where documented.
- Image upload limit: 5 MB in the simulator documentation.
- Scenario engine limit: 10,000 items. This is a configured limit, not a measured performance guarantee.
- Browser save/restore: local simulator storage.
- Dashboard batch state: session-oriented; not persisted by simulator browser save/restore.
- Uploaded photos remain in the current inference request; exports contain hashes/predictions rather than image bytes, according to the repository documentation.

Any stronger privacy, performance, or production-readiness claim requires verification of the deployed hosting environment and runtime logs.

## 7. Use cases

### UC-01 — Analyze a batch
1. User opens Analyze Batch.
2. User uploads a tomato image and enters batch ID and metadata.
3. The app validates the file and values.
4. The model returns visible-condition classification.
5. The risk engine calculates the prototype score and explanations.
6. The app shows condition, model confidence, operational risk, reasons/cautions, and a preliminary action separately.
7. If analysis fails, the app reports the failure and does not reuse stale output.

### UC-02 — Prioritize batches with limited resources
1. User analyzes one or more batches.
2. User opens Resource Planner and configures cold-storage/transport capacity.
3. The Python decision engine ranks batches and assigns heuristic actions.
4. The UI shows the priority, action, resource use, and remaining capacity.
5. User retains final decision authority.

### UC-03 — Run the Machine Simulator
1. User selects a scenario or supported image input.
2. The simulator validates scenario data and provenance.
3. The engine runs inspection and sorting events.
4. User reviews spatial/risk views and traceable output lots.
5. User may use replay/export and supported demo review actions.
6. Approved-only planning excludes rejected or unresolved quantities.
7. The interface clearly distinguishes synthetic fixtures, real model outputs, heuristic decisions, and human demo inputs.

### UC-04 — Review methodology
User opens Validation and reviews dataset composition, held-out metrics, class mapping, limitations, and the distinction between image-model performance and real-world system impact.

## 8. Verification and acceptance tests

| ID | Test | Pass condition |
|---|---|---|
| AT-01 | Valid image | Supported image returns a new result without crashing. |
| AT-02 | Invalid/corrupt image | Clear error; no stale result is shown. |
| AT-03 | Missing batch ID/metadata | Required fields are identified; invalid data is not silently accepted. |
| AT-04 | Input boundaries | UI and backend accept/reject values consistently. |
| AT-05 | Output separation | Visual class/confidence, risk score, and action priority are separately labelled. |
| AT-06 | Risk determinism | Same inputs/config return the same score, band, and reasons. |
| AT-07 | Ranking | Test batches are ordered by the documented priority key. |
| AT-08 | Capacity | Allocations do not exceed configured cold-storage/transport capacity. |
| AT-09 | Scenario schema | Valid schema 1.1 and supported legacy 1.0 scenarios behave as documented; malformed inputs are rejected. |
| AT-10 | Traceability | Every approved output lot can be traced to source IDs; rejected/unresolved quantities are excluded. |
| AT-11 | Replay/export | Exported run can be reconstructed according to documented schema; raw image bytes are absent. |
| AT-12 | Local save/restore | Simulator state restores locally and does not imply dashboard batch persistence. |
| AT-13 | Fallback | 2D fallback retains logical item and ledger state. |
| AT-14 | Reset | Clear/reset removes the intended active session/demo state. |
| AT-15 | Deployment smoke test | Hosted app loads, model loads, navigation works, and one batch scenario completes. |
| AT-16 | Methodology consistency | Displayed dataset counts, class mapping, metrics, and confusion matrix match the evaluation record. |

## 9. Test and build commands

Run from a prepared development environment:

- Python unit tests: python -m unittest discover -s tests -v
- Simulator type checking: npm run typecheck
- Simulator unit tests: npm test
- Simulator build: npm run build
- Simulator end-to-end tests: npm run test:e2e
- Streamlit embedded-component checks: npx playwright test -c playwright.streamlit.config.ts with Streamlit running or the documented hosted URL configured.
- The repository README also documents a legacy/checkpoint verification script and direct inference parity checks; run these in their documented environments.

The full suite was not executed while preparing this SRS. Test outcomes must be recorded separately.

## 10. Reported model evaluation snapshot

The project’s supplied evaluation record reports:

- Model: MobileNetV3-Small.
- Class mapping: Fresh = 0; Rotten = 1.
- Dataset: 1,986 images (1,350 Fresh; 636 Rotten).
- Split: train 1,390; validation 298; test 298.
- Held-out test accuracy: 95.64%.
- Held-out test macro-F1: 94.90%.
- Confusion matrix, true rows/predicted columns: [[199, 4], [9, 86]].

These metrics describe the image-classification component on its held-out test set. They do **not** establish that the risk score is calibrated, the resource planner is optimal, or the overall system has reduced real-world losses. Confirm figures against the saved model manifest/evaluation output before publication.

## 11. Implementation roadmap

### P0 — Verify the baseline
- Map each requirement to the current source file and UI workflow.
- Confirm all dashboard navigation options and the simulator embed.
- Record what state is session-only, browser-local, or remotely persisted.
- Record current tests and run results.

### P1 — Correctness and regression
- Run Python unit tests and simulator tests.
- Add/verify tests for input validation, risk score boundaries, ranking order, capacity constraints, scenario validation, traceability, replay, and reset.
- Confirm UI/backend range consistency and unit labels.
- Ensure failed inference never falls back silently to synthetic fixture output.

### P2 — Explainability and demo quality
- Keep model output, operational risk, and resource allocation distinct.
- Show reasons and cautions beside the score and recommendations.
- Make all sample/synthetic data labels prominent.
- Keep methodology metrics and disclaimers synchronized with the evaluation record.

### P3 — Operational validation
- Define a pilot with intended users.
- Compare system rankings with experienced human judgement.
- Record false alarms, missed visible deterioration, capacity feasibility, and usability feedback.
- Only measure loss reduction after an appropriate real-world study.

### P4 — Productization, if justified
- Evaluate persistent database, authentication, role-based access, audit logging, backups, retention, monitoring, and multi-user scaling.
- Validate each additional produce type with separate data and evaluation.
- Do not treat the demo simulator as a certified physical inspection machine.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Model generalizes poorly to new varieties, lighting, or camera conditions | Test on diverse external images and disclose limitations. |
| Risk score is mistaken for spoilage probability | Label it as a prototype operational score in the UI and reports. |
| Users misunderstand the priority heuristic as optimal | Document ordering and allocation rules; test constrained scenarios. |
| Quantity/capacity units become inconsistent | Use kg consistently in the Python planner and explicit units in all inputs/exports. |
| Synthetic simulator events are mistaken for real-world evidence | Label fixture/model/heuristic/human evidence separately. |
| Rejected/unresolved items enter approved output | Add invariant tests and traceability checks. |
| User assumes the demo has authenticated operator records or remote persistence | Explain that hosted review actions are demo inputs and browser state is local. |
| Deployment/runtime differences cause failures | Run smoke and component tests against the actual hosted environment. |

## 13. Open decisions

- Confirm whether any data is persisted by the hosted application beyond session state and browser-local simulator state.
- Confirm the exact model version and evaluation artefacts used in deployment.
- Confirm simulator scenario import/export schema and the exact set of supported scenario versions.
- Define the first real-world pilot user and the evidence needed to judge operational usefulness.
- Decide whether export of Python batch results is needed in the next release.
- Decide whether production authentication and persistent records are in scope; they are not assumed in this baseline.

## 14. Source references

- Live prototype: https://harvestshield.streamlit.app/
- Repository: https://github.com/arnabidas/HarvestShield
- Repository README: product overview, simulator integration, limitations, and test commands.
- backend/harvestshield_backend.py: batch analysis and Python planner integration.
- backend/risk_engine.py: operational risk score, component weights, reasons, cautions, and explicit prototype assumptions.
- backend/decision_engine.py: ranking and capacity-aware intervention heuristic.
- ml/inference.py: image preprocessing, MobileNetV3-Small inference, class mapping, and confidence disclaimer.
- simulator/README.md: scenario engine, state persistence, traceability, planner limits, exports, and simulator verification guidance.

---

**Definition of done:** the next release is ready for demonstration when the applicable MUST requirements have been mapped to code, acceptance tests pass or documented exceptions are disclosed, the hosted workflow has been smoke-tested, and no unverified real-world impact claim is presented as a result.
