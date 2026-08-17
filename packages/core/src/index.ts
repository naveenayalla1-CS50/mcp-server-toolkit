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
      inputSchema: zodToJsonSchema(t.input) as {
        type: "object";
        properties?: Record<string, object>;
        required?: string[];
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(schema: ZodSchema): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  const typeName = def?.typeName;

  if (typeName === 'ZodObject') {
    const shape = def.shape();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const child = value as ZodSchema;

      properties[key] = zodToJsonSchema(child);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const childTypeName = (child as any)._def?.typeName;

      if (
        childTypeName !== 'ZodOptional' &&
        childTypeName !== 'ZodDefault'
      ) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (typeName === 'ZodString') {
    return {
      type: 'string',
      ...(schema.description
        ? { description: schema.description }
        : {}),
    };
  }

  if (typeName === 'ZodNumber') {
    return {
      type: 'number',
      ...(schema.description
        ? { description: schema.description }
        : {}),
    };
  }

  if (typeName === 'ZodBoolean') {
    return {
      type: 'boolean',
      ...(schema.description
        ? { description: schema.description }
        : {}),
    };
  }

  if (typeName === 'ZodEnum') {
    return {
      type: 'string',
      enum: def.values,
      ...(schema.description
        ? { description: schema.description }
        : {}),
    };
  }

  if (typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema(def.type),
      ...(schema.description
        ? { description: schema.description }
        : {}),
    };
  }

  if (
    typeName === 'ZodOptional' ||
    typeName === 'ZodNullable' ||
    typeName === 'ZodDefault'
  ) {
    const inner = def.innerType ?? def.schema;

    return {
      ...zodToJsonSchema(inner),
      ...(schema.description
        ? { description: schema.description }
        : {}),
    };
  }

  return {
    type: 'string',
    ...(schema.description
      ? { description: schema.description }
      : {}),
  };
}
