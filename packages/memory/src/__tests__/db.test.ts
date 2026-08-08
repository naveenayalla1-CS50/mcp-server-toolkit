import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  deleteMemory,
  getMemoryFilePath,
  groupedMemories,
  insertMemory,
  listMemories,
  readMemories,
  searchMemories,
} from '../db';

describe('memory database', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mcp-memory-test-'));
  });

  afterEach(async () => {
    await rm(root, {
      recursive: true,
      force: true,
    });
  });

  it('returns an empty array when the database does not exist', async () => {
    await expect(readMemories(root)).resolves.toEqual([]);
  });

  it('saves a memory to .mcp-memory.json', async () => {
    const saved = await insertMemory(root, {
      category: 'architecture',
      title: 'Use PostgreSQL',
      details: 'PostgreSQL is the primary persistence layer.',
      tags: ['database', 'postgres'],
    });

    expect(saved.id).toBeTruthy();

    const entries = await readMemories(root);

    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Use PostgreSQL');

    const raw = await readFile(
      getMemoryFilePath(root),
      'utf8',
    );

    expect(raw).toContain('Use PostgreSQL');
  });

  it('performs case-insensitive search', async () => {
    await insertMemory(root, {
      category: 'constraint',
      title: 'Authentication requirement',
      details: 'All API routes must validate JWT tokens.',
      tags: ['security', 'jwt'],
    });

    const results = await searchMemories(root, {
      query: 'JWT',
    });

    expect(results).toHaveLength(1);
    expect(results[0].entry.title).toBe(
      'Authentication requirement',
    );
  });

  it('filters memories by category', async () => {
    await insertMemory(root, {
      category: 'architecture',
      title: 'Architecture decision',
      details: 'Use event-driven architecture.',
    });

    await insertMemory(root, {
      category: 'constraint',
      title: 'Runtime requirement',
      details: 'Node.js 20 is required.',
    });

    const results = await listMemories(
      root,
      'constraint',
    );

    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('constraint');
  });

  it('groups memories by category', async () => {
    await insertMemory(root, {
      category: 'architecture',
      title: 'Architecture',
      details: 'Architecture memory.',
    });

    await insertMemory(root, {
      category: 'pattern',
      title: 'Pattern',
      details: 'Pattern memory.',
    });

    const grouped = await groupedMemories(root);

    expect(grouped.architecture).toHaveLength(1);
    expect(grouped.pattern).toHaveLength(1);
    expect(grouped.constraint).toEqual([]);
    expect(grouped.general).toEqual([]);
  });

  it('deletes a memory by id', async () => {
    const saved = await insertMemory(root, {
      category: 'general',
      title: 'Temporary memory',
      details: 'Delete me.',
    });

    const result = await deleteMemory(root, {
      id: saved.id,
    });

    expect(result.deleted).toHaveLength(1);
    expect(result.remaining).toBe(0);
    await expect(readMemories(root)).resolves.toEqual([]);
  });
});
