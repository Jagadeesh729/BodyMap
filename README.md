# 🏋️‍♂️ BodyMap — Personalized AI-Powered Fitness & Diet Planner

<div align="center">

![BodyMap Banner](https://img.shields.io/badge/BodyMap-Fitness%20Planner-00FF88?style=for-the-badge&logo=react&logoColor=black)
[![Production](https://img.shields.io/badge/Production-bodymap--ai.vercel.app-00FF88?style=for-the-badge&logo=vercel&logoColor=white)](https://bodymap-ai.vercel.app/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Passed%201023%2F1023-00FF88?style=for-the-badge&logo=vitest&logoColor=black)](https://vitest.dev/)

<p align="center">
  <b>Tailored workouts and nutrition based on your unique biometrics, fitness level, and equipment availability. Powered by Google Gemini AI with secure backend proxying and local-first data sovereignty.</b>
</p>

</div>

---

## 🌟 Overview

**BodyMap** is a high-performance, local-first React web application that generates hyper-personalized 7-day home and gym workout routines alongside structured nutritional meal plans using Google Gemini Flash AI. By capturing user biometrics, fitness targets, equipment availability, and dietary preferences through a 5-step wizard, BodyMap creates an adaptable, step-by-step roadmap to help individuals achieve their wellness goals.

---

## ✨ Key Features & Domain Engines

- 🎯 **5-Step Custom Plan Wizard**:
  1. **Personal Details**: Age, gender, height, weight, baseline fitness level, and live real-time BMI indicator badge.
  2. **Goals**: Muscle building, weight loss, endurance, or maintenance with targeted body focus.
  3. **Health & Equipment**: Medical considerations, push-up baseline capacity, equipment checklist (bodyweight, dumbbells, bands, etc.).
  4. **Diet & Nutrition**: Dietary preferences (omnivore, vegan, keto, etc.), allergies, and special meal requests.
  5. **Recovery & Lifestyle**: Sleep schedule, stress level, and rest day customization.

- 🏋️ **Active Gym Mode (`/gym-mode`)**:
  - Live session tracker with active stopwatch, rest interval countdown timer, and set completion checkboxes.
  - **Verified Weight, Rep & PR Persistence (V12.0)**: Zero confirmed silent data loss write path capturing authentic per-exercise `peakWeightKg`, `avgCompletedReps`, and rep-aware personal records into local workout history.
  - Interactive Olympic plate loading calculator with 20kg/15kg bar support and collar offsets.
  - Real-time tempo pacing cues (eccentric, isometric, concentric) and RPE/RIR intensity logging.
  - Post-session debriefing modal capturing perceived exertion, energy, fatigue, and custom reflection tags.
  - Crash-safe session checkpointing with seamless reload recovery (`workoutCheckpointEngine.ts`).

- 📊 **Athlete Analytics & Trajectory Engine (`/dashboard`)**:
  - Multi-window time filtering (7D, 14D, 30D, All Time) with volume distribution and workout streak tracking.
  - **Goal Progress Engine (`goalProgressEngine.ts`)**: Real-time target completion percentage and remaining delta metrics.
  - **Goal Trajectory Engine (`goalTrajectoryEngine.ts`)**: Deterministic 25%, 50%, 75%, and 100% milestone checkpoints.
  - **Exercise Progression Trajectory Engine (`exerciseProgressionTrajectory.ts`)**: Multi-session progressive overload load delta and rep trajectory.
  - **Cross-Session Movement Aggregator (`exerciseCrossSessionEngine.ts`)**: Movement consistency, frequency, and peak load tracking.
  - **Personal Records (PR) Vault (`personalRecords.ts`)**: All-time peak weight achievements with rep-aware dynamic estimated 1RM calculations (Epley formula).

- 📚 **Multi-Plan Library & Comparison (`planComparisonEngine.ts`)**:
  - Save, duplicate, name, and activate multiple routines.
  - Side-by-side comparative analysis detailing daily duration differentials, shared vs unique equipment, and goal alignment.

- 💾 **Data Vault & Local Sovereignty (`/download-plan`)**:
  - High-resolution printable PDF generation and markdown export (.md).
  - **Data Vault Manifest Engine (`vaultManifestEngine.ts`)**: Partition indexing and storage density health monitoring.
  - **Data Vault Integrity Engine (`vaultIntegrityEngine.ts`)**: Deep multi-partition health scoring and schema verification.
  - **Unified V1/V2 Backup Integrity Engine (`backupIntegrity.ts` & `backupDiagnostics.ts`)**: Atomic validation and non-destructive restore rollback.

- 🤖 **Secure Google Gemini AI Proxy**: Serverless edge handler (`/api/generate-plan`) isolating API keys server-side with rate limiting, Zod schema validation, and 16 KB payload limits.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework**: [React 18.3.1](https://react.dev/) + [TypeScript (Strict Mode)](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6.4.3](https://vitejs.dev/) with SWC compiler & SPA routing fallback
- **Styling**: [Tailwind CSS 3.4.17](https://tailwindcss.com/) & `tailwindcss-animate`
- **State & Persistence**: React Context API (`PlanContext`) with unified `localStorage` & `sessionStorage` synchronization
- **Validation**: [Zod 3.23.8](https://zod.dev/) runtime contracts for user inputs and AI plan schemas
- **Data Visualization**: [Recharts 2.13.0](https://recharts.org/)
- **Routing**: [React Router DOM 7.18.2](https://reactrouter.com/) with lazy loading
- **Testing**: [Vitest 4.1.11](https://vitest.dev/) + React Testing Library (1023 unit tests across 99 suites)
- **Icons**: [Lucide React 0.462.0](https://lucide.dev/)

---

## 📁 Project Structure

```text
BodyMap/
├── api/                     # Serverless backend handlers (generate-plan.ts with rate-limiting)
├── public/                  # Static assets, robots.txt, and favicon
├── src/
│   ├── components/          # Reusable UI components (Navbar, ErrorBoundary, ContactForm)
│   │   └── ui/              # Active UI primitives (Button, Checkbox, Select, Toast, etc.)
│   ├── context/             # State management (PlanContext, planReducer, planStorage)
│   ├── hooks/               # Custom hooks (use-toast.ts)
│   ├── lib/                 # Pure domain & calculation engines:
│   │   ├── contraindicationGuard.ts     # Deterministic contraindication safety firewall
│   │   ├── clinicalPolicyOracleCases.ts # 170 clinical-policy test scenarios
│   │   ├── canonicalExerciseParser.ts   # Grammar-based canonical compound exercise parser
│   │   ├── medicalIntakeParser.ts       # Semantic medical-intake classifier
│   │   ├── vaultIntegrityEngine.ts      # Multi-partition vault health scoring & audit
│   │   ├── workoutCheckpointEngine.ts   # Crash-safe active session checkpoint manager
│   │   ├── goalTrajectoryEngine.ts      # Milestone check-in & progression trajectory
│   │   ├── vaultManifestEngine.ts       # Data Vault partition indexing & health status
│   │   ├── exerciseCrossSessionEngine.ts# Multi-session movement frequency aggregator
│   │   ├── goalProgressEngine.ts        # Target achievement percentage & remaining delta
│   │   ├── planComparisonEngine.ts      # Multi-plan comparative analysis
│   │   ├── analyticsTimeWindow.ts       # Time-window filtered load analytics
│   │   ├── backupIntegrity.ts           # Unified V1/V2 schema validator & rollback
│   │   ├── backupDiagnostics.ts         # Local storage partition diagnostics
│   │   ├── personalRecords.ts           # All-time PR vault & lift extraction
│   │   ├── oneRepMax.ts                 # Brzycki/Epley 1RM estimation math
│   │   ├── planSchema.ts                # Zod AI response schema & parser
│   │   └── validation.ts                # 5-step Zod wizard form schemas
│   ├── pages/               # Lazy-loaded route views:
│   │   ├── HomePage.tsx          # Landing page with hero, features & reviews
│   │   ├── CreatePlanPage.tsx    # 5-step plan creation wizard
│   │   ├── WeeklyPlanPage.tsx    # 7-day interactive workout & nutrition schedule
│   │   ├── GymModePage.tsx       # Active workout tracker, timer, and plate calculator
│   │   ├── DashboardPage.tsx     # Progress analytics, PR vault, and goal trajectory
│   │   ├── EditPlanPage.tsx      # Interactive plan adjustment & AI regeneration
│   │   ├── DownloadPlanPage.tsx  # Data Vault export, backup restore & PDF share hub
│   │   ├── AboutContactPage.tsx  # Mission, tech stack & contact form
│   │   └── NotFound.tsx          # Themed 404 handler
│   ├── __tests__/           # 99 Vitest unit test suites (1023 tests)
│   ├── App.tsx              # Root router, Suspense, ErrorBoundary & providers
│   ├── index.css            # Custom theme variables & responsive styles
│   └── main.tsx             # Application entry point with StrictMode
├── tailwind.config.ts       # Tailwind theme colors & animations
├── vite.config.ts           # Vite build configuration with API proxy plugin
├── vitest.config.ts         # Vitest test runner configuration
└── package.json             # Runtime & dev dependencies
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have **Node.js (>= 18)** installed:
- [Node.js](https://nodejs.org/)

### 1. Clone the Repository

```bash
git clone https://github.com/Jagadeesh729/BodyMap.git
cd BodyMap
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```
*(Note: `GEMINI_API_KEY` is kept server-side and never exposed to the client bundle. If no API key is provided, BodyMap gracefully falls back to a curated demo plan.)*

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 📜 Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Runs Vite development server with API proxy on port 8080 |
| `npm run build` | Compiles TypeScript and builds production bundle |
| `npm run typecheck` | Validates TypeScript types across all files (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint to check for code quality and syntax rules |
| `npm run test` | Executes 1016 automated Vitest unit tests across 98 suites |
| `npm run preview` | Serves production build locally for verification |

---

## 🔒 Security & Verification Posture

- **Production / Runtime**: **0 vulnerabilities** (`npm audit --omit=dev`).
- **Client Secret Isolation**: **0 API keys** in browser code or `dist/` bundle; Google Gemini API calls are strictly routed through the `/api/generate-plan` serverless backend proxy with 16 KB payload limits and sliding-window rate limiting.
- **Development Tooling**: **0 vulnerabilities** (`npm audit` exits with 0 vulnerabilities after updating to Vite 6 & esbuild 0.25+).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
