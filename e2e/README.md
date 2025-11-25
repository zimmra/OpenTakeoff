# E2E Testing Documentation

## Overview

This directory contains end-to-end tests for OpenTakeoff using Playwright. The tests validate the complete user journey from project creation to export, including accessibility compliance and cross-browser compatibility.

## Test Coverage Summary

- **Unit Tests (Vitest)**: 115+ coordinate math tests, 17+ PDF/Canvas integration tests
- **E2E Tests (Playwright)**: 5+ comprehensive workflow scenarios with a11y validation
- **Coverage Goal**: >80% for utils/hooks modules

## Running Tests

```bash
# All E2E tests
pnpm exec playwright test

# Specific test file
pnpm exec playwright test comprehensive-takeoff-workflow

# With accessibility checks
pnpm exec playwright test --grep @a11y

# Specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
```

## Performance Budgets

- **Takeoff Workspace Load**: <5 seconds
- **DOM Ready**: <3 seconds
- **Accessibility**: <3 critical/serious violations per page

## Test Tags

- `@fullstack` - Full-stack integration tests
- `@a11y` - Accessibility validation tests

For complete documentation, see individual test files.
