#!/usr/bin/env node
import { createServer, tool, z } from '@mcp-toolkit/core';
import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { globSync } from 'glob';

const ROOT = process.argv[2] || process.cwd();

const server = createServer({ name: 'mcp-code-search', version: '1.0.0' });

// --- keyword search ---
server.addTool(
  tool({
    name: 'search_code',
    description: 'Search for a keyword or pattern across the codebase. Returns file path, line number, and surrounding context.',
    input: z.object({
      query: z.string().describe('Keyword, function name, or pattern to search for'),
      filePattern: z.string().optional().describe('Glob pattern to limit search, e.g. "**/*.ts"'),
      maxResults: z.number().optional().describe('Max results to return (default 20)'),
    }),
    run: async ({ query, filePattern = '**/*', maxResults = 20 }) => {
      const files = globSync(filePattern, {
        cwd: ROOT,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/*.lock'],
        nodir: true,
        absolute: true,
      });

      const results: string[] = [];
      const lowerQuery = query.toLowerCase();

      for (const file of files) {
        if (results.length >= maxResults) break;
        let content: string;
        try {
          content = readFileSync(file, 'utf-8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length - 1, i + 2);
            const ctx = lines.slice(start, end + 1).map((l, idx) => `${start + idx + 1}: ${l}`).join('\n');
            results.push(`📄 ${relative(ROOT, file)}:${i + 1}\n${ctx}`);
            if (results.length >= maxResults) break;
          }
        }
      }

      if (results.length === 0) return { content: `No results found for "${query}"` };
      return { content: `Found ${results.length} match(es) for "${query}":\n\n${results.join('\n\n---\n\n')}` };
    },
  })
);

// --- list files ---
server.addTool(
  tool({
    name: 'list_files',
    description: 'List files in the codebase matching a glob pattern.',
    input: z.object({
      pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
    }),
    run: async ({ pattern }) => {
      const files = globSync(pattern, {
        cwd: ROOT,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        nodir: true,
      });
      if (files.length === 0) return { content: `No files matched "${pattern}"` };
      return { content: files.join('\n') };
    },
  })
);

// --- read file ---
server.addTool(
  tool({
    name: 'read_file',
    description: 'Read the full contents of a file.',
    input: z.object({
      path: z.string().describe('File path relative to repo root'),
    }),
    run: async ({ path }) => {
      const abs = resolve(ROOT, path);
      if (!existsSync(abs)) return { content: `File not found: ${path}`, isError: true };
      const content = readFileSync(abs, 'utf-8');
      return { content };
    },
  })
);

server.start();
