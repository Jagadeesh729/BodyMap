# 🏋️‍♂️ BodyMap — Personalized AI-Powered Fitness & Diet Planner

<div align="center">

![BodyMap Banner](https://img.shields.io/badge/BodyMap-Fitness%20Planner-00FF88?style=for-the-badge&logo=react&logoColor=black)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Passed%2087%2F87-00FF88?style=for-the-badge&logo=vitest&logoColor=black)](https://vitest.dev/)






<p align="center">
  <b>Tailored workouts and nutrition based on your unique biometrics, fitness level, and equipment availability. Powered by Google Gemini AI with secure backend proxying.</b>
</p>

</div>

---

## 🌟 Overview

**BodyMap** is a high-performance React web application that generates hyper-personalized 7-day home workout routines and structured nutritional meal plans using Google Gemini Flash AI. By capturing user biometrics, fitness targets, equipment availability, and dietary preferences through a 5-step wizard, BodyMap creates an adaptable, step-by-step roadmap to help individuals achieve their wellness goals.

---

## ✨ Key Features

- 🎯 **5-Step Custom Plan Wizard**:
  1. **Personal Details**: Age, gender, height, weight, baseline fitness level, and live real-time BMI indicator badge.
  2. **Goals**: Muscle building, weight loss, endurance, or maintenance with targeted body focus.
  3. **Health & Equipment**: Medical considerations, push-up baseline capacity, equipment checklist (bodyweight, dumbbells, bands, etc.).
  4. **Diet & Nutrition**: Dietary preferences (omnivore, vegan, keto, etc.), allergies, and special meal requests.
  5. **Recovery & Lifestyle**: Sleep schedule, stress level, and rest day customization.

- 🤖 **Secure Google Gemini Flash AI Integration**: Domain-engineered prompts proxied through `/api/generate-plan` keeping API keys strictly server-side (configurable via `GEMINI_MODEL`, default `gemini-3.7-flash`).
- 📐 **Strict Zod Runtime Validation**: Dual-layer schema validation for user form inputs (`stepSchemas`) and AI plan outputs (`WeeklyPlanSchema`).
- 📅 **Interactive 7-Day Plan Viewer**: Collapsible daily routines, workout completion tracking checkmarks with progress bar, and raw AI output view toggle.
- 📊 **Analytics Dashboard**: Interactive weight logger with dynamic Recharts line chart visualization, customizable profile, and measurement tracker.
- ✏️ **Plan Editor & Customizer**: Modify goals and preferences on the fly and regenerate plans with AI.
- 📥 **Export & Sharing Suite**: Download plans as Markdown (.md), native print/PDF formatting, Web Share API, and mailto: email dispatch.
- 🎨 **Sleek Cyber-Dark UI**: Built with a modern dark theme (#121212) accenting neon-green (#00FF88) and electric-purple (#9B5DE5) highlights.

---

## 🛠️ Tech Stack & Version Architecture

BodyMap intentionally pins stable, battle-tested dependency versions that have been verified compatible with its core architecture:

- **Frontend Framework**: [React 18.3.1](https://react.dev/) *(Intentionally pinned stable release)* + [TypeScript (Strict Mode)](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6.4.3](https://vitejs.dev/) *(Updated with SWC compiler & 0 dev vulnerabilities)*

- **Styling**: [Tailwind CSS 3.4.17](https://tailwindcss.com/) *(Intentionally pinned)* & `tailwindcss-animate`
- **AI Backend Proxy**: `/api/generate-plan` (Serverless Edge Handler / Dev Middleware)
- **AI Model**: [Google Gemini Flash REST API](https://ai.google.dev/) *(Active GA default: `gemini-3.7-flash`, configurable via `GEMINI_MODEL`)*
- **State Management**: React Context API (`PlanContext`) + pure `planReducer` with automatic `localStorage` synchronization
- **Validation**: [Zod 3.23.8](https://zod.dev/) *(Intentionally pinned runtime schema validation for forms & AI contracts)*
- **Data Visualization**: [Recharts 2.13.0](https://recharts.org/) *(Intentionally pinned)*
- **Routing**: [React Router DOM 7.18.2](https://reactrouter.com/) *(Current release with `React.lazy()` code splitting)*
- **Testing**: [Vitest 4.1.11](https://vitest.dev/) + React Testing Library + jsdom (39 unit tests)
- **Icons**: [Lucide React 0.462.0](https://lucide.dev/)



---

## 📁 Project Structure

```text
BodyMap/
├── api/                     # Serverless backend handlers (generate-plan.ts with rate-limiting)
├── public/                  # Static assets, robots.txt, and favicon
├── src/
│   ├── components/          # Reusable UI components (Navbar, ErrorBoundary, ContactForm)
│   │   └── ui/              # 10 Active UI primitives (Button, Checkbox, Select, Toast, etc.)
│   ├── context/             # State management (PlanContext, planReducer, planStorage)
│   ├── hooks/               # Custom hooks (use-toast.ts)
│   ├── lib/                 # Pure domain utilities:
│   │   ├── bmi.ts           # Pure BMI formula & classification math
│   │   ├── gemini.ts        # AI prompt builder & client fetcher
│   │   ├── planSchema.ts    # Zod AI response schema & parser
│   │   ├── validation.ts    # 5-step Zod wizard form schemas
│   │   └── utils.ts         # Tailwind className merger (clsx + tailwind-merge)
│   ├── pages/               # Lazy-loaded route views:
│   │   ├── HomePage.tsx          # Landing page with hero, features & reviews
│   │   ├── CreatePlanPage.tsx    # 5-step plan creation wizard
│   │   ├── WeeklyPlanPage.tsx    # 7-day interactive workout & nutrition schedule
│   │   ├── EditPlanPage.tsx      # Interactive plan adjustment & AI regeneration
│   │   ├── DownloadPlanPage.tsx  # Markdown export, print & share hub
│   │   ├── DashboardPage.tsx     # Progress dashboard with Recharts weight tracking
│   │   ├── AboutContactPage.tsx  # Mission, tech stack & contact form
│   │   └── NotFound.tsx          # Themed 404 handler
│   ├── __tests__/           # 7 Vitest unit test suites (39 tests)
│   ├── App.tsx              # Root router, Suspense, ErrorBoundary & providers
│   ├── index.css            # Custom theme variables & responsive styles
│   └── main.tsx             # Application entry point with StrictMode
├── tailwind.config.ts       # Tailwind theme colors & animations
├── vite.config.ts           # Vite build configuration with API proxy plugin
├── vitest.config.ts         # Vitest test runner configuration
└── package.json             # 16 clean runtime dependencies
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
| `npm run test` | Executes 87 automated Vitest unit tests across 16 test suites |
| `npm run preview` | Serves production build locally for verification |



---

## 🔒 Security & Verification Posture

- **Production / Runtime**: **0 vulnerabilities** (`npm audit --omit=dev`).
- **Client Secret Isolation**: **0 API keys** in browser code or `dist/` bundle; Google Gemini API calls are strictly routed through the `/api/generate-plan` serverless backend proxy with 16 KB payload limits and sliding-window rate limiting.
- **Development Tooling**: **0 vulnerabilities** (`npm audit` exits with 0 vulnerabilities after updating to Vite 6 & esbuild 0.25+).



---

## 📄 License

This project is licensed under the [MIT License](LICENSE).


