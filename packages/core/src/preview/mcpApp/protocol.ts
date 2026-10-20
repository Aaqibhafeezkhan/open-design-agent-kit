// The preview MCP App (openspec add-mcp-app-preview): names and payloads
// shared by the MCP server, which registers the `ui://` resource and its
// tools, and the page (mcpApp/main.ts), which renders in hosts that support
// MCP Apps (Claude Desktop Chat). Kept free of node: and DOM imports.
// The MCP Apps names below are pinned to @modelcontextprotocol/ext-apps
// 1.7.5; this is the one place that declares them.
import type { ArtifactComment } from '../../workspace/artifactCommentTypes';

/** The MCP Apps extension id a client lists under `capabilities.extensions`. */
export const MCP_APPS_EXTENSION_ID = 'io.modelcontextprotocol/ui';
/** The MIME type of an MCP App HTML resource. */
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
/** The older flat `_meta` key some hosts still read for a tool's UI resource. */
export const MCP_APP_LEGACY_RESOURCE_KEY = 'ui/resourceUri';

export const PREVIEW_APP_URI = 'ui://open-design/preview';

export const SHOW_ARTIFACT_TOOL = 'show_open_design_artifact';
export const SAVE_COMMENT_TOOL = 'save_open_design_comment';
export const PREVIEW_STATE_TOOL = 'get_open_design_preview_state';

/** Remote hosts every preview may load from: Google Fonts' stylesheets and font files. */
export const PREVIEW_APP_BASE_DOMAINS: readonly string[] = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

/** Above this size the page shows the latest check screenshot instead of the design. */
export const PREVIEW_APP_MAX_HTML_BYTES = 5 * 1024 * 1024;

/** `_meta` for a tool whose result the preview renders. */
export function previewAppToolMeta(): Record<string, unknown> {
  return { ui: { resourceUri: PREVIEW_APP_URI }, [MCP_APP_LEGACY_RESOURCE_KEY]: PREVIEW_APP_URI };
}

/** `_meta` for a tool only the preview page calls: hosts keep it out of the model's tool list. */
export function appOnlyToolMeta(): Record<string, unknown> {
  return { ui: { resourceUri: PREVIEW_APP_URI, visibility: ['app'] } };
}

/** True when the client's capabilities say it renders MCP App HTML resources. */
export function clientSupportsMcpApps(capabilities: unknown): boolean {
  const extensions = (capabilities as { extensions?: Record<string, unknown> } | null | undefined)?.extensions;
  const ui = extensions?.[MCP_APPS_EXTENSION_ID] as { mimeTypes?: unknown } | undefined;
  if (!ui || typeof ui !== 'object') return false;
  // A host that lists MIME types must list ours; one that lists none renders the default.
  return !Array.isArray(ui.mimeTypes) || ui.mimeTypes.includes(MCP_APP_MIME_TYPE);
}

/** What show_open_design_artifact hands the page as its structured result. */
export type ShowTarget = { view: 'artifact'; entryPath: string; title: string } | { view: 'exploration'; explorationId: string; title: string };

export interface PreviewAppCheckImage {
  label: string;
  /** A `data:image/jpeg;base64,…` URL. */
  src: string;
}

export interface PreviewAppArtifactState {
  view: 'artifact';
  entryPath: string;
  title: string;
  kind?: string;
  /** The standalone page with the preview bridge injected; absent when it can't be shown inline (see `fallback`). */
  html?: string;
  /** Why `html` is absent: too large, not an HTML kind, or packaging failed. */
  fallback?: string;
  comments: ArtifactComment[];
  /** The latest check run's screenshots. */
  checkImages: PreviewAppCheckImage[];
  /** Export formats offered as buttons (each sends a chat request). */
  exports: string[];
}

export interface PreviewAppDirection {
  id: string;
  label: string;
  summary: string;
  /** The direction's registered artifact, once it has one. */
  entryPath?: string;
  title?: string;
  /** The standalone page (view only), or absent when `image` or nothing is shown instead. */
  html?: string;
  image?: string;
}

export interface PreviewAppExplorationState {
  view: 'exploration';
  explorationId: string;
  title: string;
  chosenDirectionId?: string;
  directions: PreviewAppDirection[];
}

export type PreviewAppState = PreviewAppArtifactState | PreviewAppExplorationState;

/** The chat message "Ask Claude to apply" sends. */
export function applyCommentsMessage(entryPath: string, comments: Pick<ArtifactComment, 'id' | 'note'>[]): string {
  const list = comments.map((c) => `- ${c.id}: ${c.note}`).join('\n');
  return `Apply my ${comments.length === 1 ? 'comment' : `${comments.length} comments`} on the Open Design artifact "${entryPath}":\n${list}\n\nCall get_open_design_artifact for it, address each comment, pass their ids as resolvedCommentIds when you re-register it, then call ${SHOW_ARTIFACT_TOOL} to show me the result.`;
}

/** The chat message an export button sends; the server tool writes the file, the page never downloads. */
export function exportRequestMessage(entryPath: string, format: string): string {
  return `Export the Open Design artifact "${entryPath}" as ${format}: call export_open_design_artifact with format "${format}" and tell me where the file was written.`;
}

/** The chat message "Take this one" sends; the agent confirms before calling choose_open_design_direction. */
export function pickDirectionMessage(explorationId: string, direction: Pick<PreviewAppDirection, 'id' | 'label'>): string {
  return `I'd like direction "${direction.label}" (${direction.id}) from the Open Design exploration "${explorationId}". Ask me whether to build it out, merge in parts of other directions, or save it as a design system, then call choose_open_design_direction with my answer.`;
}
