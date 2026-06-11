<div align="center">

# 🔌 MCP Server Toolkit

### Build plug-and-play MCP servers for any dev workflow — code search, docs, databases, and more.

[![npm version](https://img.shields.io/npm/v/mcp-server-toolkit?color=7F77DD&label=npm&style=flat-square)](https://www.npmjs.com/package/mcp-server-toolkit)
[![License: MIT](https://img.shields.io/badge/license-MIT-5DCAA5?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-378ADD?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Works with Claude Code](https://img.shields.io/badge/Claude%20Code-ready-AFA9EC?style=flat-square)](https://docs.anthropic.com/claude-code)
[![Works with Cursor](https://img.shields.io/badge/Cursor-ready-AFA9EC?style=flat-square)](https://cursor.sh)
[![Works with Windsurf](https://img.shields.io/badge/Windsurf-ready-AFA9EC?style=flat-square)](https://codeium.com/windsurf)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-0F6E56?style=flat-square)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/naveenayalla1-CS50/mcp-server-toolkit?style=flat-square&color=EF9F27)](https://github.com/naveenayalla1-CS50/mcp-server-toolkit/stargazers)

**Give any AI coding agent a direct line into your codebase, docs, or database — in under 60 seconds.**

[Quick Start](#-quick-start) · [Servers](#-included-servers) · [Build Your Own](#-build-your-own-server) · [Discord](https://discord.gg/your-invite) · [Changelog](CHANGELOG.md)

---

![Demo: Claude Code querying a codebase via MCP Server Toolkit](https://naveenayalla1-CS50.github.io/mcp-server-toolkit/demo.gif)

</div>

---

## Why this exists

When you ask Claude Code `"where do we handle Stripe webhooks?"` it has two bad options:

- **Option A** — Read every file in the repo. Slow, expensive, blows the context window on any real codebase.
- **Option B** — Guess based on the first few files it sees. Wrong half the time.

**MCP Server Toolkit gives agents a third option: ask the right tool directly.** Semantic code search, live database queries, doc lookups, API introspection — all surfaced through the [Model Context Protocol](https://modelcontextprotocol.io) standard, so any MCP-compatible client can use them without any changes to your existing code.

---

## ✨ Features

- **🔍 Semantic code search** — Find the right function, file, or pattern across your entire repo in milliseconds. Powered by vector embeddings, no Elasticsearch required.
- **📚 Docs server** — Give your agent instant access to any documentation site, local Markdown files, or Notion workspace.
- **🗄️ Database server** — Natural language → SQL for PostgreSQL, MySQL, and SQLite. Read-only by default, writable with an explicit flag.
- **🌐 API introspection server** — Load any OpenAPI/Swagger spec and let your agent browse and call endpoints with type safety.
- **⚡ One-command setup** — Every server ships as a standalone CLI. `npx` and `pip` install paths included.
- **🔒 Zero-config secrets** — Reads from your existing `.env` file or environment variables. Nothing new to learn.
- **🧩 Works everywhere** — Claude Code, Cursor, Windsurf, Cline, VS Code Copilot, Codex CLI, Gemini CLI, and every other MCP-compatible client.
- **🛠️ Extensible** — The `createServer()` helper reduces a new tool to ~15 lines of TypeScript. Scaffold a custom server in 30 seconds.

---

## 🚀 Quick Start

**Requirements:** Node.js 18+ or Python 3.10+

### Option A — npx (no install)

```bash
npx mcp-server-toolkit@latest init
```

This runs the interactive setup wizard. Pick your servers, paste your credentials, and get a ready-to-paste config block for Claude Code / Cursor.

---

### Option B — npm global install

```bash
npm install -g mcp-server-toolkit
mcp init
```

---

### Option C — pip (Python environments)

```bash
pip install mcp-server-toolkit
mcp init
```

---

### Add to Claude Code

After `mcp init`, copy the generated block into your `.claude/mcp.json`:

```json
{
  "servers": {
    "code-search": {
      "command": "mcp-code-search",
      "args": ["--root", "."],
      "env": { "OPENAI_API_KEY": "${OPENAI_API_KEY}" }
    },
    "database": {
      "command": "mcp-database",
      "args": ["--read-only"],
      "env": { "DATABASE_URL": "${DATABASE_URL}" }
    },
    "docs": {
      "command": "mcp-docs",
      "args": ["--source", "./docs"]
    }
  }
}
```

That's it. Restart Claude Code and your agent now has full access to all three.

---

## 📦 Included Servers

| Server | Install | What it does |
|--------|---------|-------------|
| `mcp-code-search` | `npx mcp-code-search` | Semantic + keyword search across your codebase |
| `mcp-database` | `npx mcp-database` | Natural language queries for Postgres, MySQL, SQLite |
| `mcp-docs` | `npx mcp-docs` | Index and query local Markdown, Notion, or any URL |
| `mcp-openapi` | `npx mcp-openapi` | Browse and call endpoints from any OpenAPI spec |
| `mcp-git` | `npx mcp-git` | Query commits, diffs, blame, and branches |
| `mcp-shell` | `npx mcp-shell` | Sandboxed shell execution with allowlist controls |

All servers are independently installable — use one or all of them.

---

## 🛠️ Usage Example

Once installed, your AI agent can use natural language to interact with your entire dev environment:

```
You:  "Find all places where we validate user input before inserting into the DB"

Agent uses mcp-code-search →
  Found 7 matches in: auth/validators.ts, api/users.ts, api/orders.ts...

You:  "How many users signed up in the last 7 days?"

Agent uses mcp-database →
  SELECT count(*) FROM users WHERE created_at > now() - interval '7 days';
  → 1,432 new users

You:  "What does our docs say about rate limiting?"

Agent uses mcp-docs →
  Found in docs/api/rate-limits.md: "All endpoints are limited to 100 req/min per API key..."
```

No copy-pasting. No context switching. The agent just knows.

---

## 🔧 Build Your Own Server

Scaffold a new server in 30 seconds:

```bash
mcp new my-server --template typescript
```

This generates:

```
my-server/
├── src/
│   ├── index.ts        # Entry point — register your tools here
│   └── tools/
│       └── example.ts  # Your first tool
├── package.json
└── README.md
```

A minimal tool looks like this:

```typescript
import { createServer, tool, z } from 'mcp-server-toolkit';

const server = createServer({ name: 'my-server', version: '1.0.0' });

server.addTool(
  tool({
    name: 'get_weather',
    description: 'Get current weather for a city',
    input: z.object({ city: z.string() }),
    run: async ({ city }) => {
      const data = await fetchWeather(city);
      return { content: `${city}: ${data.temp}°C, ${data.condition}` };
    },
  })
);

server.start();
```

That's the whole thing. Ship it.

---

## 📁 Project Structure

```
mcp-server-toolkit/
├── packages/
│   ├── core/           # createServer(), tool(), z helpers
│   ├── code-search/    # Semantic codebase search server
│   ├── database/       # Natural language DB query server
│   ├── docs/           # Documentation indexing server
│   ├── openapi/        # OpenAPI spec introspection server
│   ├── git/            # Git history and diff server
│   └── shell/          # Sandboxed shell server
├── examples/
│   ├── claude-code/    # Drop-in config for Claude Code
│   ├── cursor/         # Drop-in config for Cursor
│   └── custom-server/  # Starter template for custom tools
├── docs/               # Full documentation
└── CONTRIBUTING.md
```

---

## 🗺️ Roadmap

- [x] Code search (semantic + keyword)
- [x] PostgreSQL / MySQL / SQLite server
- [x] Docs server (Markdown + URL crawl)
- [x] OpenAPI introspection server
- [ ] Notion server
- [ ] Linear / Jira server
- [ ] Supabase + PlanetScale managed DB support
- [ ] Web UI for browsing registered tools
- [ ] Auto-generated tool descriptions from schema

Want something on this list prioritised? [Open an issue](https://github.com/naveenayalla1-CS50/mcp-server-toolkit/issues/new?template=feature_request.md) and add a 👍.

---

## 🤝 Contributing

Contributions are what make this project worth starring. Here's how to get involved:

### First time?

1. Look for issues labelled [`good first issue`](https://github.com/naveenayalla1-CS50/mcp-server-toolkit/labels/good%20first%20issue) — these are scoped small on purpose.
2. Comment on the issue to claim it before starting.
3. Fork the repo, make your changes, open a PR.

### Adding a new server

The fastest path to a merged PR:

```bash
# Clone and install deps
git clone https://github.com/naveenayalla1-CS50/mcp-server-toolkit
cd mcp-server-toolkit
npm install

# Scaffold your server
npm run new-server -- --name my-awesome-server

# Run tests
npm test

# Submit your PR
```

Each new server needs:
- A `README.md` explaining what it does and the one-line install command
- At least one test in `__tests__/`
- An example config block for Claude Code / Cursor

### Guidelines

- Keep each tool focused on doing **one thing well** — resist scope creep.
- Never store credentials in code — always read from env vars.
- Add your server to the table in the main README and to the `packages/` list.

### Code of Conduct

Be excellent to each other. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 🔐 Security

- All servers are **read-only by default**. Write access requires an explicit `--writable` flag.
- Credentials are read from environment variables only — never hardcoded or logged.
- The shell server uses an allowlist (`mcp-shell.config.json`) — no arbitrary command execution.
- Found a vulnerability? Please email **security@naveenayalla1-CS50.dev** instead of opening a public issue.

---

## 📄 License

MIT © 2026 [naveenayalla1-CS50](https://github.com/naveenayalla1-CS50)

You're free to use this in personal projects, commercial products, and anything in between. Attribution appreciated but not required.

---

<div align="center">

[Share on Twitter](https://twitter.com/intent/tweet?text=MCP%20Server%20Toolkit%20gives%20AI%20agents%20direct%20access%20to%20your%20codebase%2C%20docs%2C%20and%20DB.%20Zero%20config.%20Works%20with%20Claude%20Code%2C%20Cursor%2C%20and%20more.%20https%3A%2F%2Fgithub.com%2Fnaveenayalla1-CS50%2Fmcp-server-toolkit) · [Open an issue](https://github.com/naveenayalla1-CS50/mcp-server-toolkit/issues)

Built with ❤️ for the agent era.

</div>

## MCP server usage

This repository contains a TypeScript/Node.js toolkit of MCP servers.

### Install

```bash
npm install
npm run build
npm run build --workspace=@mcp-toolkit/core
npm run build --workspace=@mcp-toolkit/code-search
node packages/code-search/dist/index.js



## MCP server usage

This repository contains a TypeScript/Node.js toolkit of MCP servers.

### Install

```bash
npm install
npm run build
