#!/usr/bin/env node

import { resolve } from 'path';
import { createServer, tool, z } from '@mcp-toolkit/core';

import {
  deleteMemory,
  getMemoryFilePath,
  groupedMemories,
  insertMemory,
  listMemories,
  MEMORY_CATEGORIES,
  searchMemories,
} from './db';

const VERSION = '1.0.0';

interface CliOptions {
  root: string;
  writable: boolean;
}

function parseCliOptions(argv: readonly string[]): CliOptions {
  let root = process.cwd();
  let writable = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--writable') {
      writable = true;
      continue;
    }

    if (argument === '--root' || argument === '-r') {
      const value = argv[index + 1];

      if (!value || value.startsWith('-')) {
        throw new Error(`${argument} requires a directory path.`);
      }

      root = resolve(value);
      index += 1;
      continue;
    }

    if (!argument.startsWith('-')) {
      root = resolve(argument);
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return {
    root,
    writable,
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeDisabledMessage(): string {
  return [
    'Memory writes are disabled.',
    'Restart mcp-memory with --writable to use save_memory or delete_memory.',
  ].join(' ');
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));

  const server = createServer({
    name: 'mcp-memory',
    version: VERSION,
  });

  server.addTool(
    tool({
      name: 'save_memory',

      description:
        'Save a persistent project memory such as an architectural decision, development pattern, constraint, rule, or other important context.',

      input: z.object({
        category: z
          .enum(MEMORY_CATEGORIES)
          .describe(
            'Memory category: architecture, pattern, constraint, or general',
          ),

        title: z
          .string()
          .min(1)
          .describe('Short descriptive title for this memory'),

        details: z
          .string()
          .min(1)
          .describe(
            'Complete details that should be remembered for future work',
          ),

        tags: z
          .array(z.string())
          .optional()
          .describe(
            'Optional searchable tags such as authentication, database, API, or security',
          ),
      }),

      run: async ({
        category,
        title,
        details,
        tags,
      }) => {
        if (!options.writable) {
          return {
            content: writeDisabledMessage(),
            isError: true,
          };
        }

        try {
          const entry = await insertMemory(options.root, {
            category,
            title,
            details,
            tags,
          });

          return {
            content: [
              'Memory saved successfully.',
              '',
              json(entry),
            ].join('\n'),
          };
        } catch (error: unknown) {
          return {
            content: `Failed to save memory: ${errorMessage(error)}`,
            isError: true,
          };
        }
      },
    }),
  );

  server.addTool(
    tool({
      name: 'query_memory',

      description:
        'Search persistent project memories by keyword or tag. Results are case-insensitive and ranked by relevance.',

      input: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            'Keyword, phrase, decision, technology, rule, or tag to search for',
          ),

        category: z
          .enum(MEMORY_CATEGORIES)
          .optional()
          .describe(
            'Optionally restrict results to one memory category',
          ),

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            'Maximum number of results to return. Default: 20',
          ),
      }),

      run: async ({
        query,
        category,
        limit,
      }) => {
        try {
          const results = await searchMemories(options.root, {
            query,
            category,
            limit,
          });

          if (results.length === 0) {
            return {
              content: `No memories found for "${query}".`,
            };
          }

          return {
            content: json({
              query,
              count: results.length,
              results: results.map((result) => ({
                score: result.score,
                ...result.entry,
              })),
            }),
          };
        } catch (error: unknown) {
          return {
            content: `Failed to query memories: ${errorMessage(error)}`,
            isError: true,
          };
        }
      },
    }),
  );

  server.addTool(
    tool({
      name: 'list_memories',

      description:
        'List persistent project memories. Optionally filter by category. Without a category, memories are grouped by category.',

      input: z.object({
        category: z
          .enum(MEMORY_CATEGORIES)
          .optional()
          .describe('Optional category filter'),
      }),

      run: async ({ category }) => {
        try {
          if (category) {
            const memories = await listMemories(
              options.root,
              category,
            );

            return {
              content: json({
                category,
                count: memories.length,
                memories,
              }),
            };
          }

          const memories = await groupedMemories(options.root);

          const count = Object.values(memories).reduce(
            (total, entries) => total + entries.length,
            0,
          );

          return {
            content: json({
              count,
              memories,
            }),
          };
        } catch (error: unknown) {
          return {
            content: `Failed to list memories: ${errorMessage(error)}`,
            isError: true,
          };
        }
      },
    }),
  );

  server.addTool(
    tool({
      name: 'delete_memory',

      description:
        'Delete a persistent project memory by its exact ID or exact title. Requires the server to be started with --writable.',

      input: z.object({
        id: z
          .string()
          .optional()
          .describe('Exact memory UUID to delete'),

        title: z
          .string()
          .optional()
          .describe(
            'Exact memory title to delete. Matching is case-insensitive.',
          ),
      }),

      run: async ({ id, title }) => {
        if (!options.writable) {
          return {
            content: writeDisabledMessage(),
            isError: true,
          };
        }

        if (!id && !title) {
          return {
            content:
              'delete_memory requires either id or title.',
            isError: true,
          };
        }

        try {
          const result = await deleteMemory(options.root, {
            id,
            title,
          });

          if (result.deleted.length === 0) {
            return {
              content:
                'No matching memory was found. Nothing was deleted.',
            };
          }

          return {
            content: json({
              deletedCount: result.deleted.length,
              deleted: result.deleted,
              remaining: result.remaining,
            }),
          };
        } catch (error: unknown) {
          return {
            content: `Failed to delete memory: ${errorMessage(error)}`,
            isError: true,
          };
        }
      },
    }),
  );

  process.stderr.write(
    [
      `Memory database: ${getMemoryFilePath(options.root)}`,
      `Write access: ${options.writable ? 'enabled' : 'disabled'}`,
      '',
    ].join('\n'),
  );

  await server.start();
}

main().catch((error: unknown) => {
  process.stderr.write(
    `mcp-memory failed to start: ${errorMessage(error)}\n`,
  );

  process.exitCode = 1;
});