import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forHost, renderPromptBody } from '../localPrompts.mjs';

const body = 'Do it.\n\n<!-- claude-only -->\nPublish the artifact preview.\n<!-- /claude-only -->\n\nThen report.';

test('claude-only blocks reach claude and mcp, and are removed for codex and vscode', () => {
  for (const host of ['claude', 'mcp']) assert.match(forHost(body, host), /artifact preview/);
  for (const host of ['codex', 'vscode']) assert.equal(forHost(body, host), 'Do it.\n\nThen report.');
});

test('a block at the end leaves no trailing blank lines', () => {
  assert.equal(forHost('Last step.\n\n<!-- claude-only -->\nx\n<!-- /claude-only -->\n', 'codex'), 'Last step.\n');
});

test('renderPromptBody fills the brief and applies the host', () => {
  assert.equal(renderPromptBody({ body: `Brief: {{brief}}\n${body}` }, 'a poster', 'codex'), 'Brief: a poster\nDo it.\n\nThen report.');
});
