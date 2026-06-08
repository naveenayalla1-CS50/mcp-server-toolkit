import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool as MCPTool,
} from '@modelcontextprotocol/sdk/types.js';
import { z, ZodSchema } from 'zod';

export { z };

export interface ToolDefinition<T extends ZodSchema> {
  name: string;
  description: string;
  input: T;
  run: (args: z.infer<T>) => Promise<{ content: string } | { content: string; isError: true }>;
}

export function tool<T extends ZodSchema>(def: ToolDefinition<T>): ToolDefinition<T> {
  return def;
}

export interface ServerOptions {
  name: string;
  version: string;
}

export function createServer(options: ServerOptions) {
  const server = new Server(
    { name: options.name, version: options.version },
    { capabilities: { tools: {} } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: ToolDefinition<any>[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addTool<T extends ZodSchema>(def: ToolDefinition<T>) {
    tools.push(def);
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t): MCPTool => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object' as const,
        properties: zodToJsonSchema(t.input),
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const matched = tools.find((t) => t.name === req.params.name);
    if (!matched) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }

    const parsed = matched.input.safeParse(req.params.arguments);
    if (!parsed.success) {
      return {
        content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      };
    }

    const result = await matched.run(parsed.data);
    return {
      content: [{ type: 'text' as const, text: result.content }],
      isError: 'isError' in result ? result.isError : false,
    };
  });

  async function start() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`${options.name} v${options.version} running\n`);
  }

  return { addTool, start };
}

// minimal zod → JSON schema (covers the common cases)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(schema: ZodSchema): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (schema as any)._def?.shape?.();
  if (!shape) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = {};
  for (const [key, val] of Object.entries(shape)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = val as any;
    const typeName = v._def?.typeName;
    if (typeName === 'ZodString') props[key] = { type: 'string', description: v.description };
    else if (typeName === 'ZodNumber') props[key] = { type: 'number', description: v.description };
    else if (typeName === 'ZodBoolean') props[key] = { type: 'boolean', description: v.description };
    else if (typeName === 'ZodOptional') props[key] = { ...zodToJsonSchema(v._def.innerType), description: v.description };
    else props[key] = { type: 'string' };
  }
  return props;
}
