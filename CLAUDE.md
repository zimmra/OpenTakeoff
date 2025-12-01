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

This repository is currently in early initialization. The technology stack and architecture are being established.

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

**Note:** Development commands will be added once the project structure is established.

## Architecture

**Note:** Architecture documentation will be added as the codebase develops.

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
