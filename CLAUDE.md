# Agent Instructions

## Project Overview

auth is a Fastify authentication plugin for Clerk with permission management. Built with TypeScript.

- **Tier:** internal
- **Package:** `@palindrom-ai/auth`

## Quick Reference

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Lint | `pnpm lint` |
| Type check | `pnpm typecheck` |

## Architecture

```
src/
  context.ts       # Auth context utilities
  errors.ts        # Auth error types
  permissions.ts   # Permission definitions
  plugin.ts        # Fastify plugin registration
  token.ts         # Token handling
```

See `docs/` for detailed architecture documentation.

## Standards & Guidelines

This project uses [@standards-kit/conform](https://github.com/chrismlittle123/standards-kit) for coding standards.

- **Config:** `standards.toml` (extends `typescript-internal` from the standards registry)
- **Guidelines:** https://chrismlittle123.github.io/standards/

Use the MCP tools to query standards at any time:

| Tool | Purpose |
|------|---------|
| `get_standards` | Get guidelines matching a context (e.g., `typescript fastify auth`) |
| `list_guidelines` | List all available guidelines |
| `get_guideline` | Get a specific guideline by ID |
| `get_ruleset` | Get a tool configuration ruleset (e.g., `typescript-internal`) |

## Workflow

- **Branch:** Create feature branches from `main`
- **CI:** GitHub Actions runs build, test, lint on PRs
- **Deploy:** npm publish
- **Commits:** Use conventional commits (`feat:`, `fix:`, `chore:`, etc.)
