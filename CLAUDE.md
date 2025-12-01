# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenTakeOff is a self-hostable web application for performing take-offs on construction/electrical plans. A "take-off" is the process of counting symbols/devices on floorplans to generate quantity estimates.

## Project Rules
- Don't reinvent the wheel - use popular modules/packages/etc where applicable while maintaining consistency
- Use your 'context7' mcp tool for finding the correct implementation for various languages, packges, and modules

## Core Functionality

### PDF Plan Management
- Users upload PDF floorplans
- Plans are displayed in a web interface for annotation

### Symbol/Device Management
- Users define a table of devices/symbols they need to count
- Each row in the table gets a corresponding "stamp" tool
- Stamps auto-increment quantity when placed on the plan
- Overall quantities are tracked for each symbol type

### Location Management
- Users define locations (rooms/areas) on the plan
- Locations are drawn using:
  - Rectangle tool (for rectangular rooms)
  - Line tool (for non-rectangular rooms/areas)
- When a stamp is placed within a location's bounds, that quantity is tracked separately for that location
- This allows both overall counts AND per-location breakdowns

## Design Principles
- **Modern 2025 tech stack** - use current best practices for both frontend and backend that top designers/developers are deploying in 2025
- **Simple and fast to use** - prioritize UX and performance
- **Self-hosted** - deployed via Docker
- **No authentication** (v0.x/1.0) - authentication and scaling are planned for v2.0
- Focus on core take-off functionality first

## Project Status

The project is actively under development with a functional core take-off system. The tech stack has been established and core features are implemented.

## Development Approach

For version 0.x and 1.0:
- Focus on core take-off functionality
- Single-user deployment via Docker
- Web UI access
- No authentication or multi-tenancy
- Modern, polished UI/UX

Future v2.0 will include:
- Authentication
- Scaling/multi-user support
- Additional enterprise features

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9.15.0+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker 20.10+ with Compose V2 (for containerized development)

### Installation
```bash
pnpm install          # Install all dependencies
```

### Development Commands (Root)
```bash
pnpm dev              # Run all dev servers in parallel (frontend:3000, backend:3001)
pnpm build            # Build all workspaces
pnpm lint             # Lint all workspaces
pnpm typecheck        # Type check all workspaces
pnpm test             # Run tests in all workspaces
pnpm format           # Format code with Prettier
pnpm clean            # Remove dist folders and node_modules
```

**Targeting specific packages:** Use `--filter` to run commands in a specific workspace:
```bash
pnpm --filter @opentakeoff/frontend dev      # Run only frontend dev server
pnpm --filter @opentakeoff/backend test      # Run only backend tests
pnpm --filter @opentakeoff/frontend build    # Build only frontend
```

### Backend Commands (`apps/backend`)
```bash
pnpm dev              # Run with tsx watch (hot reload)
pnpm start            # Run compiled production build
pnpm build            # Build TypeScript
pnpm test             # Run Vitest tests
pnpm test:watch       # Vitest watch mode
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push          # Apply migrations to database
pnpm db:studio        # Open Drizzle Studio (database GUI)
```

### Frontend Commands (`apps/frontend`)
```bash
pnpm dev              # Vite dev server with hot reload
pnpm build            # TypeScript check + Vite production build
pnpm preview          # Preview production build locally
pnpm test             # Run Vitest tests
pnpm test:watch       # Vitest watch mode
```

### Docker Commands
```bash
docker compose up -d                  # Start production containers
docker compose --profile dev up       # Start development containers
docker compose logs -f backend        # View backend logs
docker compose down                   # Stop services
docker compose down -v                # Stop and remove volumes (DATA LOSS!)
```

### Docker Test Commands
```bash
pnpm docker:test:build    # Build Docker test containers
pnpm docker:test:up       # Start test containers
pnpm docker:test:down     # Stop test containers
pnpm docker:test:logs     # View test container logs
pnpm docker:test:full     # Full Docker test workflow
```

### E2E Testing
```bash
cd e2e
pnpm test                 # Run Playwright E2E tests
```

### Environment Variables
Create `.env` from `.env.docker.example`:
```
BACKEND_PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/sqlite/db.sqlite
PDF_MAX_SIZE_MB=50
ENABLE_METRICS=false
FRONTEND_PORT=5173
```

## Architecture

### Monorepo Structure
```
OpenTakeoff/
├── apps/
│   ├── backend/          # Fastify API server (port 3001)
│   └── frontend/         # React SPA with Vite (port 3000 dev, 5173 prod)
├── packages/
│   ├── config/           # Shared configuration (placeholder)
│   └── ui/               # Shared UI components (placeholder)
├── e2e/                  # Playwright E2E tests
├── data/                 # Persistent data (uploads, sqlite)
└── docker-compose.yml    # Production container setup
```

### Tech Stack

**Frontend:**
- React 19 + Vite 7
- React Router v7 (routing)
- Zustand (state management)
- TanStack React Query v5 (data fetching)
- TanStack React Table v8 (data tables)
- Konva + react-konva (canvas drawing/annotations)
- pdfjs-dist (PDF rendering)
- Tailwind CSS (styling)
- React Hook Form + Zod (forms/validation)
- Radix UI + Headless UI (accessible components)

**Backend:**
- Fastify 5 (web framework)
- SQLite + Drizzle ORM (database)
- Zod (validation)
- pdf-lib + pdfmake (PDF processing/generation)
- fast-csv (CSV export)
- Pino (logging)
- WebSocket support (@fastify/websocket)

**Infrastructure:**
- Docker with multi-stage builds
- Caddy (reverse proxy + static serving in production)
- pnpm workspaces (monorepo management)

### Database Schema
Key tables in SQLite via Drizzle ORM:
- `projects` - Top-level project containers
- `plans` - PDF floorplans (with page info, dimensions)
- `devices` - Symbol/device definitions (name, color, icon)
- `locations` - Rooms/areas (rectangles or polygons)
- `location_vertices` - Polygon vertex coordinates
- `stamps` - Device placements on plans (position, scale)
- `counts` - Pre-aggregated counts for fast queries
- `exports` - Generated export file tracking
- `*_revisions` - Change history for undo/redo

### API Structure
All API routes prefixed with `/api`:
- `/projects` - Project CRUD
- `/plans` - Plan management + PDF uploads
- `/devices` - Device/symbol definitions
- `/locations` - Location/room management
- `/stamps` - Stamp placement
- `/counts` - Count aggregation queries
- `/exports` - Export generation (CSV, JSON, PDF)
- `/history` - Change history
- `/healthz` - Health check endpoint

### Frontend Module Organization
Feature-based modules in `apps/frontend/src/modules/`:
- `projects/` - Project management (pages, components, api, types)
- `devices/` - Device/symbol management
- `locations/` - Location/room definitions
- `stamps/` - Stamp placement and tracking
- `counts/` - Count aggregation and display
- `exports/` - Export functionality
- `pdf/` - PDF viewing and handling
- `canvas/` - Drawing tools (Konva-based)
- `history/` - Undo/redo functionality

### Key Routes
- `/projects` - Project list
- `/projects/:projectId` - Project detail
- `/projects/:projectId/plans/:planId/takeoff` - Main takeoff workspace

### Data Persistence
- Database: `./data/sqlite/db.sqlite`
- PDF uploads: `./data/uploads/`
- Docker volumes: `data-uploads`, `data-sqlite`

## Testing

### Unit Tests
- Framework: Vitest
- Run from root: `pnpm test`
- Run with coverage: `pnpm test -- --coverage`
- Watch mode: `pnpm test:watch` (in apps/backend or apps/frontend)

### E2E Tests
- Framework: Playwright
- Location: `e2e/` directory
- Browsers: Chromium, Firefox
- Run: `cd e2e && pnpm test`

### Test Files
- Unit tests: `*.test.ts` or `*.spec.ts` alongside source files
- E2E tests: `e2e/*.spec.ts`

## Code Quality

### Linting & Formatting
- ESLint 9 with TypeScript (strict, zero warnings policy)
- Prettier for formatting (single quotes, semicolons, 100 char width)
- Pre-commit hooks via Husky + lint-staged
- Commitlint enforces conventional commits

### TypeScript
- Strict mode enabled across all packages
- ES2022 target
- Type checking: `pnpm typecheck`

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
