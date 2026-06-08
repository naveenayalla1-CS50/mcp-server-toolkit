#!/usr/bin/env node
// mcp new <name> — scaffolds a new MCP server package

const { mkdirSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const name = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));

if (!name) {
  console.error('Usage: npm run new-server -- --name <server-name>');
  process.exit(1);
}

const dir = resolve(__dirname, '..', 'packages', name);

if (existsSync(dir)) {
  console.error(`Package already exists: packages/${name}`);
  process.exit(1);
}

mkdirSync(`${dir}/src`, { recursive: true });

writeFileSync(`${dir}/package.json`, JSON.stringify({
  name: `@mcp-toolkit/${name}`,
  version: '1.0.0',
  description: `MCP server — ${name}`,
  main: 'dist/index.js',
  bin: { [`mcp-${name}`]: 'dist/index.js' },
  scripts: { build: 'tsc', dev: 'tsc --watch', start: 'node dist/index.js', test: 'vitest run' },
  dependencies: { '@mcp-toolkit/core': '*' },
  devDependencies: { typescript: '^5.4.0', vitest: '^1.6.0', '@types/node': '^20.0.0' },
  license: 'MIT',
}, null, 2));

writeFileSync(`${dir}/src/index.ts`, `#!/usr/bin/env node
import { createServer, tool, z } from '@mcp-toolkit/core';

const server = createServer({ name: 'mcp-${name}', version: '1.0.0' });

server.addTool(
  tool({
    name: 'example_tool',
    description: 'An example tool — replace this with your real logic.',
    input: z.object({
      input: z.string().describe('Input to process'),
    }),
    run: async ({ input }) => {
      return { content: \`You passed: \${input}\` };
    },
  })
);

server.start();
`);

writeFileSync(`${dir}/README.md`, `# mcp-${name}

One-line description of what this server does.

## Install

\`\`\`bash
npx mcp-${name}
\`\`\`

## Tools

| Tool | Description |
|------|-------------|
| \`example_tool\` | Replace with your tools |

## Config (Claude Code)

\`\`\`json
{
  "servers": {
    "${name}": {
      "command": "mcp-${name}"
    }
  }
}
\`\`\`

## License

MIT
`);

console.log(`\nScaffolded packages/${name}/\n`);
console.log('Next steps:');
console.log(`  1. Edit packages/${name}/src/index.ts`);
console.log(`  2. npm run build`);
console.log(`  3. Add it to the table in the root README.md\n`);
