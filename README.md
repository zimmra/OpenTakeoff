# OpenTakeOff

Self-Hostable Plan Take-Off Web App

A modern web application for performing take-offs on construction and electrical plans. OpenTakeOff allows you to upload PDF floorplans, define devices/symbols, place stamps, track quantities, and generate reports - all self-hosted via Docker.

## Quick Start

### Prerequisites

- Docker 20.10+ with Compose V2
- 2GB+ available disk space
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Production Deployment

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/opentakeoff.git
cd opentakeoff

# 2. Configure environment (optional)
cp .env.docker.example .env.docker
# Edit .env.docker if you need custom ports or settings

# 3. Start the application
docker compose up -d

# 4. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
```

### Development Mode

For development with hot-reload:

```bash
# Start with development profile
docker compose --profile dev up

# Source code changes will automatically reload
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

## Configuration

Environment variables can be configured in `.env.docker`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `3001` | Backend API port |
| `FRONTEND_PORT` | `5173` | Frontend web UI port |
| `NODE_ENV` | `production` | Environment mode |
| `DATABASE_PATH` | `/data/sqlite/db.sqlite` | SQLite database location |
| `PDF_MAX_SIZE_MB` | `50` | Maximum PDF upload size |
| `ENABLE_METRICS` | `false` | Enable Prometheus metrics |

## Data Persistence

Your data is stored in Docker volumes and local directories:

- **PDFs**: `./data/uploads` (bind mount) + `data-uploads` (named volume)
- **Database**: `./data/sqlite` (bind mount) + `data-sqlite` (named volume)

To backup your data:

```bash
# Stop containers
docker compose down

# Backup data directory
tar -czf opentakeoff-backup-$(date +%Y%m%d).tar.gz ./data

# Restart
docker compose up -d
```

## Management Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild containers
docker compose build --no-cache
docker compose up -d

# Check service health
docker compose ps

# Stop services
docker compose down

# Remove everything including volumes (⚠️ DATA LOSS!)
docker compose down -v
```

## Architecture

OpenTakeOff is a monorepo built with:

- **Frontend**: React + Vite + TypeScript (Task 11)
- **Backend**: Fastify + TypeScript (Task 3)
- **Database**: SQLite with Drizzle ORM (Task 4)
- **Package Manager**: pnpm workspaces
- **Container Runtime**: Docker + Compose

## Development

### Local Development (without Docker)

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm dev

# Run tests
pnpm test

# Lint and type check
pnpm lint
pnpm typecheck

# Build for production
pnpm build
```

### Project Structure

```
opentakeoff/
├── apps/
│   ├── backend/           # Fastify API server
│   └── frontend/          # React web UI
├── packages/
│   ├── config/            # Shared configuration
│   └── ui/                # Shared UI components
├── data/                  # Persistent data (gitignored)
├── docker-compose.yml     # Container orchestration
└── .env.docker.example    # Environment template
```

## Troubleshooting

### Containers won't start

```bash
# Check Docker daemon is running
docker info

# View detailed logs
docker compose logs

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up
```

### Port conflicts

If ports 3001 or 5173 are already in use:

```bash
# Edit .env.docker
BACKEND_PORT=3002
FRONTEND_PORT=5174

# Restart
docker compose down && docker compose up -d
```

### Permission errors on data directory

```bash
# Fix permissions (Linux/Mac)
sudo chown -R $(id -u):$(id -g) ./data

# Recreate volumes
docker compose down -v
docker compose up -d
```

## License

See [LICENSE](./LICENSE) file for details.

## Status

**Version**: 0.1.0 (Early Development)

Current focus: Core containerization and infrastructure (Task 2).

Coming soon:
- Backend API with Fastify (Task 3)
- Database schema with SQLite (Task 4)
- PDF upload handling (Task 5)
- Frontend with React + Vite (Task 11)
