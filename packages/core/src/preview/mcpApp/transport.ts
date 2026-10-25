/// <reference lib="dom" />
// The preview's third host transport (openspec add-mcp-app-preview): the
// browser preview talks to its server over fetch, the VS Code preview over
// postMessage, and the MCP App over the MCP Apps bridge, calling the
// server's app-only tools and posting messages into the chat.
import type { App } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ArtifactComment } from '../../workspace/artifactCommentTypes';
import { PREVIEW_APP_VIEWS, PREVIEW_STATE_TOOL, SAVE_COMMENT_TOOL, type PreviewAppAskImage, type PreviewAppDesignSystemPreview, type PreviewAppExamplePreview, type PreviewAppState, type ShowTarget } from './protocol';

export interface McpAppTransport {
  /** A view's data from get_open_design_preview_state: the design with its comments, or one page of a picker (`cursor` for the next). */
  loadState(target: ShowTarget, cursor?: string): Promise<PreviewAppState>;
  /** One gallery card's preview. */
  loadExamplePreview(exampleId: string): Promise<PreviewAppExamplePreview>;
  /** One design system's Visualize page. */
  loadDesignSystemPreview(designSystemId: string): Promise<PreviewAppDesignSystemPreview>;
  /** One question option's picture, by its imageRef. */
  loadAskImage(imageRef: string): Promise<PreviewAppAskImage>;
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

/** get_open_design_preview_state's arguments for a target: the show tool's target, minus its title. */
export function stateArgs(target: ShowTarget, cursor?: string): Record<string, unknown> {
  switch (target.view) {
    case 'artifact':
      return { entryPath: target.entryPath };
    case 'exploration':
      return { explorationId: target.explorationId };
    case 'campaign':
      return { view: 'campaign', entryPath: target.entryPath };
    default: {
      const args: Record<string, unknown> = { ...target };
      delete args.title;
      if (cursor) args.cursor = cursor;
      return args;
    }
  }
}

async function structured<T>(app: App, args: Record<string, unknown>): Promise<T> {
  const result = await callTool(app, PREVIEW_STATE_TOOL, args);
  return (result.structuredContent ?? JSON.parse(resultText(result))) as unknown as T;
}

export function createMcpAppTransport(app: App): McpAppTransport {
  return {
    async loadState(target, cursor) {
      const state = await structured<PreviewAppState>(app, stateArgs(target, cursor));
      if (!state || !PREVIEW_APP_VIEWS.includes(state.view) || state.view !== target.view) throw new Error('The preview state was malformed.');
      return state;
    },
    async loadExamplePreview(exampleId) {
      return structured<PreviewAppExamplePreview>(app, { exampleId });
    },
    async loadDesignSystemPreview(designSystemId) {
      return structured<PreviewAppDesignSystemPreview>(app, { designSystemId });
    },
    async loadAskImage(imageRef) {
      return structured<PreviewAppAskImage>(app, { imageRef });
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
