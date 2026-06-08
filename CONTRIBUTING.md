# Contributing

Thanks for wanting to help. Here's everything you need to know.

## What's worth contributing

- New servers (check the roadmap in README first — if it's there, it's wanted)
- Bug fixes with a test that covers the fix
- Performance improvements with before/after numbers
- Docs improvements (typos, clarity, better examples)

What's probably not worth a PR without discussion first: large refactors, changing the core API, adding optional dependencies that double the install size.

## Setup

```bash
git clone https://github.com/naveenayalla1-CS50/mcp-server-toolkit
cd mcp-server-toolkit
npm install
npm run build
```

## Adding a new server

```bash
npm run new-server -- my-server-name
```

This scaffolds `packages/my-server-name/` with the right structure. Then:

1. Edit `packages/my-server-name/src/index.ts` — add your tools
2. Add a `README.md` in the package folder — at minimum: what it does, install command, tools table, and config block for Claude Code
3. Add at least one test in `packages/my-server-name/src/__tests__/`
4. Add your server to the table in the root `README.md`
5. Run `npm run build && npm test` — both need to pass

## Tests

```bash
npm test               # run all tests
npm test --workspace packages/code-search  # run one package
```

Tests use [Vitest](https://vitest.dev). Keep them fast and focused. No real network calls in tests — mock external dependencies.

## Code style

- TypeScript strict mode, always
- No `any` unless genuinely unavoidable (add a comment explaining why)
- Read from env vars for credentials, never hardcode
- Servers default to read-only; write access requires an explicit `--writable` flag
- Each tool should do one thing — if you need more, add more tools

## PR checklist

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] New server has a README with at minimum: description, install, tools table, config example
- [ ] New server is added to the table in root README
- [ ] No credentials hardcoded anywhere

## Issues

If you're fixing a bug, mention the issue number in your PR. If there's no issue, a sentence explaining the bug is fine.

For new servers, open an issue first if you're unsure whether it fits. For obvious stuff (the roadmap, clear bugs), just open the PR.
