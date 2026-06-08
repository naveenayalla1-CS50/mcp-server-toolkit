#!/usr/bin/env node
import { createServer, tool, z } from '@mcp-toolkit/core';
import { execSync } from 'child_process';

const ROOT = process.argv[2] || process.cwd();

function git(cmd: string): string {
  return execSync(`git -C "${ROOT}" ${cmd}`, { encoding: 'utf-8' });
}

const server = createServer({ name: 'mcp-git', version: '1.0.0' });

server.addTool(
  tool({
    name: 'git_log',
    description: 'Get recent commit history. Optionally filter by file path.',
    input: z.object({
      limit: z.number().optional().describe('Number of commits to return (default 20)'),
      file: z.string().optional().describe('Filter commits that touched this file'),
    }),
    run: async ({ limit = 20, file }) => {
      const filePart = file ? `-- "${file}"` : '';
      const log = git(`log --oneline -${limit} ${filePart}`);
      return { content: log || 'No commits found.' };
    },
  })
);

server.addTool(
  tool({
    name: 'git_diff',
    description: 'Show the diff for a commit hash, or the current working tree if no hash given.',
    input: z.object({
      commit: z.string().optional().describe('Commit hash to diff. Omit to diff working tree.'),
    }),
    run: async ({ commit }) => {
      const diff = commit ? git(`show ${commit}`) : git('diff HEAD');
      return { content: diff || 'No diff.' };
    },
  })
);

server.addTool(
  tool({
    name: 'git_blame',
    description: 'Show who last changed each line of a file.',
    input: z.object({
      file: z.string().describe('File path to blame'),
    }),
    run: async ({ file }) => {
      try {
        const blame = git(`blame --line-porcelain "${file}"`);
        // just return the summary — full porcelain is noisy
        const lines = blame.split('\n');
        const out: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('summary ')) out.push(lines[i].replace('summary ', ''));
        }
        return { content: out.join('\n') };
      } catch (err) {
        return { content: `git blame failed: ${(err as Error).message}`, isError: true };
      }
    },
  })
);

server.addTool(
  tool({
    name: 'git_branches',
    description: 'List all local and remote branches.',
    input: z.object({}),
    run: async () => {
      const branches = git('branch -a');
      return { content: branches };
    },
  })
);

server.start();
