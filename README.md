# AI for Engineering — Challenge Tools (v1.0, Youssef Ajra)

Static web tools (GitHub Pages + Firebase) that turn a course topic into an AI-integrated technical assessment.
Every tool follows the POWE445 robot pattern: **engineering sheets → MATLAB ML model → simulation challenge → marks, certificate, PDF report**.

## Folder structure
```
AI For Engineering/
├─ index.html                → redirects to portal/
├─ portal/                   → single entry page (portal/tools.js = list of tools)
├─ shared/                   → engine used by every generic tool
│  ├─ css/style.css  assets/favicon.svg
│  ├─ js/  common.js ui.js engine.js admin.js report.js backend.js config.js ml.js (in-browser ML)
│  └─ matlab/exportForWeb.m  → one export function for every tool
├─ programs/
│  ├─ 01-electrical-power-machines/  POWE445-robot-challenge/ (standalone copy of the live robot)
│  │                                 electric-circuits-thevenin-reverse-engineering/  electric-machines-motor-efficiency/
│  ├─ 02-communication-electronics/  channel-prediction-adaptive-modulation/
│  ├─ 03-biomedical/                 glucose-insulin-predictor/
│  ├─ 04-mechanical/                 vibration-fault-diagnosis/
│  ├─ 05-civil/                      traffic-signal-optimizer/
│  ├─ 06-chemical/                   process-control-pid-tuner/
│  └─ 07-industrial/                 job-time-prediction-scheduling/
└─ database.rules.json       → Firebase rules for the robot AND all generic tools
```
Each generic tool folder has only three files: `index.html` (student), `admin.html` (instructor), `tool.js` (the science).

## Tools
| # | Tool | ML task (MATLAB app) | Export mode | Conventional method beaten |
|---|------|----------------------|-------------|----------------------------|
| 01 | Circuit Reverse-Engineering (POWE211/212) | regression, **trained in the browser** (no MATLAB) | browser | two-point formula, standard fixture |
| 01 | Motor Efficiency | regression (Regression Learner) | grid | rated flux at all loads |
| 02 | Channel Prediction | regression | grid | last SNR report used as current |
| 03 | Glucose–Insulin Predictor | regression | grid | reactive pump on current glucose |
| 04 | Vibration Diagnosis | classification (Classification Learner) | predict | technician rule chart |
| 05 | Traffic Signal | regression | grid | Webster split |
| 06 | PID Tuning | regression | grid | fixed SIMC λ = θ |
| 07 | Job Scheduling | regression | predict | routing standard times |

## In-browser ML (first-year tools)
`ml.mode: 'browser'` tools (e.g. Electric Circuits) replace the MATLAB step with a lab inside the page: bench experiments → manual rows (≥ 3) → generated rows → train linear / polynomial / k-NN / tree / random-forest models → compare with the circuit-theory method (R², RMSE, MAE, MAPE, actual-vs-predicted, residual plots) → submit. The submitted model is stored as its recipe (rows + model type) in Firebase and re-trained identically on any computer.

## Student workflow
1. Sign in (three-part name, ID `20xxxxxxx`) → wait for instructor approval.
2. Solve the sheets (values generated from the student ID; 3 attempts, 2 % tolerance by default).
3. Download the dataset (CSV) and the spec file (JSON); train in MATLAB; run
   `exportForWeb(trainedModel, '<tool>_spec_<ID>.json')` → upload the `<tool>_model_<ID>.json`.
   *grid* tools: the model is sampled on a grid and interpolated in the browser; *predict* tools: the model predicts the rows listed in the spec file.
4. Run the challenge: Index = 100·(cost_conventional − cost_ML)/(cost_conventional − cost_ideal).
5. Results: marks, certificate, full PDF report.

## Instructor (admin.html)
Waiting room (approve/reject), students and marks (overrides), leaderboard, settings (marks per item, attempts, tolerance, dataset size, ML pass mark, minimum Index, challenge knobs), answer key per ID, CSV export, per-student PDF report. Live updates + Refresh.

## Firebase
`shared/js/config.js` holds the project config (same project as the robot). Each tool stores its data under `tools/<toolId>/…`, so one database serves every tool.
**Publish `database.rules.json`** (Realtime Database → Rules) — it keeps the robot rules and adds the `tools/$tool` branch.
Admins: `admins/<uid> = true` (already set for the robot account). With `apiKey: 'PASTE_…'` every tool runs in local demo mode (admin passcode `aieng-admin`).

## Adding a new tool
1. Copy any tool folder into `programs/<program>/<new-tool>/`.
2. Edit `tool.js`: `params(id)`, `sheets` (questions + answers + worked solution), `ml` (predictors, dataset, hiddenTest *or* predictSet), `challenge` (run → cost/metrics/trace, draw, plots).
3. Add one entry in `portal/tools.js`.

## Status of the pass marks
Pass marks (ML R²/accuracy and minimum Index) were calibrated with Python proxies of the MATLAB learners (linear, trees, ensembles, SVM, NN) on several IDs. They separate linear/weak models from good nonlinear ones, but should be confirmed with real MATLAB runs before the first class; all are editable from the instructor Settings tab.

## Deploying to GitHub Pages (recommended)
1. **Do not change the existing `powe445-challenge` repository** — it is the live robot that students already use; the portal links to it.
2. Create a new public repository (e.g. `ai-for-engineering`) and upload the **contents** of this folder (README, index.html, .nojekyll, portal/, shared/, programs/, database.rules.json) to its root.
3. Settings → Pages → Deploy from branch `main`, folder `/ (root)`. The portal is then at `https://usif-3jra.github.io/ai-for-engineering/`.
4. Firebase console → Realtime Database → Rules → paste `database.rules.json` → Publish (the robot part is unchanged; it only adds `tools/`).
5. Nothing else is needed in Firebase: the domain `usif-3jra.github.io` is already authorised, anonymous + email sign-in are already on, and your admin account (`admins/<uid>`) already works for every tool.

## Student data
All data is in Firebase, not in GitHub. The robot keeps using `students/` and `config/`; every new tool writes only under `tools/<toolId>/`. Uploading files to GitHub or publishing these rules does not delete or change existing student records.
