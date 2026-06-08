#!/usr/bin/env node
/**
 * Example: a custom MCP server that checks a weather API.
 * Use this as a starting point for your own tool.
 *
 * 1. Copy this folder: cp -r examples/custom-server packages/my-server
 * 2. Rename and edit src/index.ts
 * 3. npm run build
 */
import { createServer, tool, z } from '@mcp-toolkit/core';

const server = createServer({ name: 'mcp-weather', version: '1.0.0' });

server.addTool(
  tool({
    name: 'get_weather',
    description: 'Get current weather for a city using wttr.in (no API key needed).',
    input: z.object({
      city: z.string().describe('City name, e.g. "San Francisco"'),
    }),
    run: async ({ city }) => {
      const encoded = encodeURIComponent(city);
      const res = await fetch(`https://wttr.in/${encoded}?format=3`);
      if (!res.ok) return { content: `Failed to fetch weather for ${city}`, isError: true };
      const text = await res.text();
      return { content: text.trim() };
    },
  })
);

server.start();
