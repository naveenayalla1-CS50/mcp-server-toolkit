# Changelog

All notable changes will be documented here.

## [1.0.0] — 2026-06-08

Initial release.

### Servers shipped
- `mcp-code-search` — semantic + keyword codebase search
- `mcp-database` — natural language SQL for Postgres and SQLite
- `mcp-docs` — index and query local Markdown documentation
- `mcp-git` — query commits, diffs, blame, and branches

### Core
- `createServer()` helper
- `tool()` + Zod input validation
- Read-only by default for database server
- Works with Claude Code, Cursor, Windsurf, Cline, Codex CLI, Gemini CLI
