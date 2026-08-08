import { randomUUID } from 'crypto';
import { readFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { z } from 'zod';

export const MEMORY_CATEGORIES = [
  'architecture',
  'pattern',
  'constraint',
  'general',
] as const;

export const MemoryCategorySchema = z.enum(MEMORY_CATEGORIES);

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

export const MemoryEntrySchema = z.object({
  id: z.string().uuid(),
  category: MemoryCategorySchema,
  title: z.string().min(1),
  details: z.string().min(1),
  date: z.string().datetime(),
  tags: z.array(z.string()).optional(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

const MemoryDatabaseSchema = z.array(MemoryEntrySchema);
const MEMORY_FILENAME = '.mcp-memory.json';

export interface CreateMemoryInput {
  category: MemoryCategory;
  title: string;
  details: string;
  tags?: string[];
}

export interface SearchMemoryInput {
  query: string;
  category?: MemoryCategory;
  limit?: number;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
}

let mutationQueue: Promise<void> = Promise.resolve();

export function getMemoryFilePath(root: string): string {
  return join(root, MEMORY_FILENAME);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function normalizeTags(tags?: string[]): string[] | undefined {
  if (!tags) return undefined;

  const normalized = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return normalized.length > 0 ? normalized : undefined;
}

async function serializedMutation<T>(operation: () => Promise<T>): Promise<T> {
  const previous = mutationQueue;

  let release: () => void = () => undefined;

  mutationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}

export async function readMemories(root: string): Promise<MemoryEntry[]> {
  const filePath = getMemoryFilePath(root);

  let raw: string;

  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw new Error(
      `Unable to read memory database "${filePath}": ${errorMessage(error)}`,
    );
  }

  if (!raw.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(
      `Memory database "${filePath}" contains invalid JSON: ${errorMessage(error)}`,
    );
  }

  const result = MemoryDatabaseSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Memory database "${filePath}" contains invalid entries: ${result.error.message}`,
    );
  }

  return result.data;
}

export async function writeMemories(
  root: string,
  entries: readonly MemoryEntry[],
): Promise<void> {
  const filePath = getMemoryFilePath(root);
  const validated = MemoryDatabaseSchema.parse(entries);

  const tempPath = join(
    dirname(filePath),
    `${MEMORY_FILENAME}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(
      tempPath,
      `${JSON.stringify(validated, null, 2)}\n`,
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );

    await rename(tempPath, filePath);
  } catch (error: unknown) {
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors.
    }

    throw new Error(
      `Unable to write memory database "${filePath}": ${errorMessage(error)}`,
    );
  }
}

export async function insertMemory(
  root: string,
  input: CreateMemoryInput,
): Promise<MemoryEntry> {
  return serializedMutation(async () => {
    const title = input.title.trim();
    const details = input.details.trim();

    if (!title) {
      throw new Error('Memory title cannot be empty.');
    }

    if (!details) {
      throw new Error('Memory details cannot be empty.');
    }

    const entries = await readMemories(root);

    const entry: MemoryEntry = {
      id: randomUUID(),
      category: input.category,
      title,
      details,
      date: new Date().toISOString(),
      tags: normalizeTags(input.tags),
    };

    entries.push(entry);

    await writeMemories(root, entries);

    return entry;
  });
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreEntry(entry: MemoryEntry, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const tokens = Array.from(new Set(tokenize(normalizedQuery)));

  const title = entry.title.toLowerCase();
  const details = entry.details.toLowerCase();
  const category = entry.category.toLowerCase();
  const tags = (entry.tags ?? []).map((tag) => tag.toLowerCase());

  let score = 0;

  if (title === normalizedQuery) {
    score += 100;
  } else if (title.includes(normalizedQuery)) {
    score += 50;
  }

  if (tags.some((tag) => tag === normalizedQuery)) {
    score += 40;
  } else if (tags.some((tag) => tag.includes(normalizedQuery))) {
    score += 25;
  }

  if (details.includes(normalizedQuery)) {
    score += 20;
  }

  if (category === normalizedQuery) {
    score += 15;
  }

  for (const token of tokens) {
    if (title === token) {
      score += 20;
    } else if (title.includes(token)) {
      score += 12;
    }

    if (tags.some((tag) => tag === token)) {
      score += 15;
    } else if (tags.some((tag) => tag.includes(token))) {
      score += 8;
    }

    if (details.includes(token)) {
      score += 4;
    }

    if (category.includes(token)) {
      score += 3;
    }
  }

  return score;
}

export async function searchMemories(
  root: string,
  input: SearchMemoryInput,
): Promise<SearchResult[]> {
  const query = input.query.trim();

  if (!query) {
    return [];
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const entries = await readMemories(root);

  return entries
    .filter(
      (entry) =>
        input.category === undefined ||
        entry.category === input.category,
    )
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, query),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return Date.parse(b.entry.date) - Date.parse(a.entry.date);
    })
    .slice(0, limit);
}

export async function listMemories(
  root: string,
  category?: MemoryCategory,
): Promise<MemoryEntry[]> {
  const entries = await readMemories(root);

  return entries
    .filter(
      (entry) =>
        category === undefined || entry.category === category,
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export async function deleteMemory(
  root: string,
  identifier: {
    id?: string;
    title?: string;
  },
): Promise<{
  deleted: MemoryEntry[];
  remaining: number;
}> {
  return serializedMutation(async () => {
    const id = identifier.id?.trim();
    const title = identifier.title?.trim();

    if (!id && !title) {
      throw new Error('Provide either a memory id or title.');
    }

    const entries = await readMemories(root);

    const deleted = id
      ? entries.filter((entry) => entry.id === id)
      : entries.filter(
          (entry) =>
            entry.title.toLowerCase() === title!.toLowerCase(),
        );

    if (deleted.length === 0) {
      return {
        deleted: [],
        remaining: entries.length,
      };
    }

    const deletedIds = new Set(deleted.map((entry) => entry.id));
    const remaining = entries.filter(
      (entry) => !deletedIds.has(entry.id),
    );

    await writeMemories(root, remaining);

    return {
      deleted,
      remaining: remaining.length,
    };
  });
}

export async function groupedMemories(
  root: string,
): Promise<Record<MemoryCategory, MemoryEntry[]>> {
  const entries = await listMemories(root);

  const grouped: Record<MemoryCategory, MemoryEntry[]> = {
    architecture: [],
    pattern: [],
    constraint: [],
    general: [],
  };

  for (const entry of entries) {
    grouped[entry.category].push(entry);
  }

  return grouped;
}