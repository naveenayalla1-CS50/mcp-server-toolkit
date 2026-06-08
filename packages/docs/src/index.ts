#!/usr/bin/env node
import { createServer, tool, z } from '@mcp-toolkit/core';
import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { globSync } from 'glob';

const SOURCE = process.env.DOCS_SOURCE
  || process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
  || './docs';

const server = createServer({ name: 'mcp-docs', version: '1.0.0' });

function loadDocs(root: string): Array<{ path: string; content: string }> {
  const files = globSync('**/*.{md,mdx,txt}', {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });
  return files.map(f => ({
    path: relative(root, f),
    content: readFileSync(f, 'utf-8'),
  }));
}

server.addTool(
  tool({
    name: 'search_docs',
    description: 'Search documentation files for a keyword or phrase. Returns matching sections with context.',
    input: z.object({
      query: z.string().describe('What to search for'),
      maxResults: z.number().optional().describe('Max results (default 10)'),
    }),
    run: async ({ query, maxResults = 10 }) => {
      const root = resolve(SOURCE);
      if (!existsSync(root)) {
        return { content: `Docs source not found: ${root}`, isError: true };
      }

      const docs = loadDocs(root);
      const lowerQuery = query.toLowerCase();
      const results: string[] = [];

      for (const doc of docs) {
        if (results.length >= maxResults) break;
        const lines = doc.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            const start = Math.max(0, i - 3);
            const end = Math.min(lines.length - 1, i + 5);
            const ctx = lines.slice(start, end + 1).join('\n');
            results.push(`📄 ${doc.path} (line ${i + 1}):\n\n${ctx}`);
            break;
          }
        }
      }

      if (results.length === 0) return { content: `Nothing found for "${query}"` };
      return { content: results.join('\n\n---\n\n') };
    },
  })
);

server.addTool(
  tool({
    name: 'read_doc',
    description: 'Read the full content of a documentation file.',
    input: z.object({
      path: z.string().describe('Path to the doc file, relative to the docs source directory'),
    }),
    run: async ({ path }) => {
      const abs = resolve(SOURCE, path);
      if (!existsSync(abs)) return { content: `File not found: ${path}`, isError: true };
      return { content: readFileSync(abs, 'utf-8') };
    },
  })
);

server.addTool(
  tool({
    name: 'list_docs',
    description: 'List all available documentation files.',
    input: z.object({}),
    run: async () => {
      const root = resolve(SOURCE);
      if (!existsSync(root)) return { content: `Docs source not found: ${root}`, isError: true };
      const docs = loadDocs(root);
      if (docs.length === 0) return { content: 'No docs found.' };
      return { content: docs.map(d => d.path).join('\n') };
    },
  })
);

server.start();
