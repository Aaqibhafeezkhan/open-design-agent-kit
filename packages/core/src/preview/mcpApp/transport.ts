/// <reference lib="dom" />
// The preview's third host transport (openspec add-mcp-app-preview): the
// browser preview talks to its server over fetch, the VS Code preview over
// postMessage, and the MCP App over the MCP Apps bridge, calling the
// server's app-only tools and posting messages into the chat.
import type { App } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ArtifactComment } from '../../workspace/artifactCommentTypes';
import { PREVIEW_STATE_TOOL, SAVE_COMMENT_TOOL, type PreviewAppState, type ShowTarget } from './protocol';

export interface McpAppTransport {
  /** The design, its comments and check screenshots, from get_open_design_preview_state. */
  loadState(target: ShowTarget): Promise<PreviewAppState>;
  /** Persists the comment controller's changes: one save_open_design_comment call per comment. */
  persist(entryPath: string, changed: ArtifactComment[], deletedIds: string[]): Promise<void>;
  /** Posts a message into the chat as the user. */
  sendToChat(text: string): Promise<void>;
}

function resultText(result: CallToolResult): string {
  return result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

async function callTool(app: App, name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) throw new Error(resultText(result) || `${name} failed.`);
  return result;
}

export function createMcpAppTransport(app: App): McpAppTransport {
  return {
    async loadState(target) {
      const args = target.view === 'artifact' ? { entryPath: target.entryPath } : { explorationId: target.explorationId };
      const result = await callTool(app, PREVIEW_STATE_TOOL, args);
      const state = (result.structuredContent ?? JSON.parse(resultText(result))) as unknown as PreviewAppState;
      if (!state || (state.view !== 'artifact' && state.view !== 'exploration')) throw new Error('The preview state was malformed.');
      return state;
    },
    async persist(entryPath, changed, deletedIds) {
      for (const comment of changed) await callTool(app, SAVE_COMMENT_TOOL, { entryPath, comment });
      for (const deleteId of deletedIds) await callTool(app, SAVE_COMMENT_TOOL, { entryPath, deleteId });
    },
    async sendToChat(text) {
      const result = await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
      if (result.isError) throw new Error('The chat refused the message.');
    },
  };
}
