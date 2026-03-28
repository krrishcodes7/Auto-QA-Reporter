# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Browser automation**: Playwright (Chromium headless)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (QA engine backend)
│   └── qa-inspector/       # React + Vite frontend (dark industrial UI)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── screenshots/            # Auto-created at runtime by scan jobs
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
└── package.json            # Root package
```

## Autonomous QA Inspector

A self-driven web QA system. Enter a URL → it crawls the site, checks links, inspects UI, tests forms, and generates a comprehensive bug report with screenshots.

### Features
- **Playwright-based crawler**: Crawls all internal pages up to configurable max
- **Link checker**: Detects 404s, 5xx errors, timeouts
- **UI Inspector**: Missing alt text, empty buttons/links, missing labels, heading hierarchy, viewport overflow, overlapping elements
- **Form tester**: Empty submit validation, SQL injection, XSS input, email validation, password policy
- **AI classification**: Heuristic (built-in) or OpenAI GPT-4o (optional via env) — includes fix suggestions
- **OWASP mapping**: Every issue tagged with an OWASP Top 10 (2021) category via `owasp-mapper.ts`
- **Critical severity**: New 4th severity level (above High) for SQL injection, XSS, and similar critical exploits
- **Bounding boxes**: Screenshots capture element bounding boxes (x/y/width/height) stored on every issue
- **AI fix suggestions**: Each issue carries a code-level fix suggestion (heuristic or OpenAI-generated)
- **Reports**: JSON + self-contained HTML (dark themed, includes Critical badge + OWASP bar), screenshot gallery
- **Live progress**: Polled scan status with animated step indicators
- **Severity breakdown bar**: SummaryCards shows Critical/High/Medium/Low pill counts
- **OWASP badge in UI**: Expanded issue rows show OWASP category tag + blue "Suggested Fix" panel

### Backend QA Engine Files
- `artifacts/api-server/src/qa/crawler.ts` — Playwright crawler
- `artifacts/api-server/src/qa/link-checker.ts` — HTTP link validation
- `artifacts/api-server/src/qa/ui-inspector.ts` — Accessibility & UI checks (with bounding box capture)
- `artifacts/api-server/src/qa/form-tester.ts` — Form security/validation testing (with bounding box capture)
- `artifacts/api-server/src/qa/screenshot-utils.ts` — Screenshot capture returning `{ filename, boundingBox? }`
- `artifacts/api-server/src/qa/owasp-mapper.ts` — Maps issue types to OWASP Top 10 categories + fix suggestions
- `artifacts/api-server/src/qa/ai-classifier.ts` — Bug classification (heuristic + OpenAI, includes fixSuggestion)
- `artifacts/api-server/src/qa/report-generator.ts` — JSON + HTML report builder (Critical severity, OWASP bar)
- `artifacts/api-server/src/qa/scan-engine.ts` — Orchestrates all QA steps (applies OWASP + severity escalation)
- `artifacts/api-server/src/routes/scan.ts` — API routes for scan lifecycle

### API Endpoints
- `POST /api/scan` — Start a scan job
- `GET /api/scan/{jobId}/status` — Live progress polling
- `GET /api/scan/{jobId}/report` — Full JSON report
- `GET /api/scan/{jobId}/screenshots` — Screenshot list
- `GET /api/scan/{jobId}/export/html` — Download HTML report
- `GET /api/screenshots/{filename}` — Serve screenshot images

### Environment Variables (Optional)
- `OPENAI_API_KEY` — Enable AI classification
- `ENABLE_AI_CLASSIFICATION=true` — Enable AI classification
- `AI_MODEL` — OpenAI model (default: gpt-4o)

### System Dependencies
Playwright/Chromium requires these Nix packages (already installed):
- glib, nss, nspr, dbus, atk, cups
- xorg.libX11, xorg.libxcb, xorg.libXcomposite, xorg.libXdamage, xorg.libXext, xorg.libXfixes, xorg.libXrandr
- pango, cairo, alsa-lib, libxkbcommon, libdrm, mesa

The `LD_LIBRARY_PATH` for libgbm is set at `chromium.launch()` time in each QA module.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with full QA engine. Routes in `src/routes/`, QA logic in `src/qa/`.

### `artifacts/qa-inspector` (`@workspace/qa-inspector`)

React + Vite frontend with dark industrial theme. Three-state app: IDLE → SCANNING → RESULTS.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec (`openapi.yaml`) and Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
