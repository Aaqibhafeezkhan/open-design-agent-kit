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
export const SHOW_EXAMPLES_TOOL = 'show_open_design_examples';
export const SHOW_DESIGN_SYSTEMS_TOOL = 'show_open_design_design_systems';
export const SAVE_COMMENT_TOOL = 'save_open_design_comment';
export const PREVIEW_STATE_TOOL = 'get_open_design_preview_state';

/** Remote hosts every preview may load from: Google Fonts' stylesheets and font files. */
export const PREVIEW_APP_BASE_DOMAINS: readonly string[] = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

/** Above this size the page shows the latest check screenshot instead of the design. */
export const PREVIEW_APP_MAX_HTML_BYTES = 5 * 1024 * 1024;
/** Examples per page of the gallery (openspec add-mcp-app-pickers). */
export const PREVIEW_APP_EXAMPLES_PAGE_SIZE = 24;
/** Above this size a campaign tile shows its label and errors without the image. */
export const PREVIEW_APP_MAX_TILE_IMAGE_BYTES = 1024 * 1024;

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

export interface ExampleFilters {
  query?: string;
  mode?: string;
  surface?: string;
}

export interface DesignSystemFilters {
  query?: string;
  category?: string;
  /** A shortlist, shown in this order. */
  ids?: string[];
}

/** What a show tool hands the page as its structured result: the view, its filters and a title, never the data itself. */
export type ShowTarget =
  | { view: 'artifact'; entryPath: string; title: string }
  | { view: 'exploration'; explorationId: string; title: string }
  | ({ view: 'examples'; title: string } & ExampleFilters)
  | ({ view: 'design-systems'; title: string } & DesignSystemFilters)
  | { view: 'campaign'; entryPath: string; title: string };

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
  /** Made with the style-tile skill: each direction can be saved as a design system. */
  styleTiles?: boolean;
  directions: PreviewAppDirection[];
}

export interface PreviewAppExample {
  /** The skill id remix_open_design_example takes. */
  id: string;
  name: string;
  mode: string;
  summary: string;
}

/** One page of the gallery; each card's preview is fetched on its own (PreviewAppExamplePreview). */
export interface PreviewAppExamplesState {
  view: 'examples';
  title: string;
  filters: ExampleFilters;
  /** Modes offered as filter chips: every mode among the examples that match the other filters. */
  modes: string[];
  examples: PreviewAppExample[];
  total: number;
  /** Pass back as `cursor` for the next page. */
  nextCursor?: string;
}

export interface PreviewAppExamplePreview {
  exampleId: string;
  /** The example as one view-only page, or absent (see `fallback`). */
  html?: string;
  fallback?: string;
}

export interface PreviewAppDesignSystemTile {
  id: string;
  name: string;
  category?: string;
  summary: string;
  active: boolean;
  /** Up to five CSS colors: background, text, accent, surface, muted (or DESIGN.md's colors). */
  swatches: string[];
  displayFont?: string;
  bodyFont?: string;
}

export interface PreviewAppDesignSystemsState {
  view: 'design-systems';
  title: string;
  filters: DesignSystemFilters;
  systems: PreviewAppDesignSystemTile[];
  /** Shortlisted ids that matched nothing. */
  unknownIds?: string[];
}

/** A design system's Visualize page: script-free, shown in a view-only frame. */
export interface PreviewAppDesignSystemPreview {
  designSystemId: string;
  html: string;
}

export interface PreviewAppCampaignError {
  check: string;
  message: string;
}

export interface PreviewAppCampaignTile {
  label: string;
  /** A shape of the master (a preset id such as banner-mobile)… */
  shape?: string;
  /** …or another piece of the collection, opened in the artifact view. */
  entryPath?: string;
  /** The exported file the tile shows, when the export wrote one. */
  file?: string;
  /** A data URL, absent when the tile's image is missing or over the per-tile cap. */
  image?: string;
  errors: PreviewAppCampaignError[];
}

export interface PreviewAppCampaignState {
  view: 'campaign';
  entryPath: string;
  title: string;
  tiles: PreviewAppCampaignTile[];
  /** campaign-sheet.png as a data URL, when there is no sidecar to draw tiles from. */
  sheetImage?: string;
  /** Shown instead of tiles: why there are none. */
  message?: string;
}

export type PreviewAppState = PreviewAppArtifactState | PreviewAppExplorationState | PreviewAppExamplesState | PreviewAppDesignSystemsState | PreviewAppCampaignState;

export const PREVIEW_APP_VIEWS: readonly PreviewAppState['view'][] = ['artifact', 'exploration', 'examples', 'design-systems', 'campaign'];

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

// Picks (openspec add-mcp-app-pickers): each names the tool and arguments the
// agent should use; the page itself never calls a model-visible tool.

/** "Remix this": the agent asks what to make first when the person hasn't said. */
export function remixExampleMessage(example: Pick<PreviewAppExample, 'id' | 'name'>): string {
  return `I'd like to remix the Open Design example "${example.name}" (skillId "${example.id}"). If I haven't said what to make with it, ask me first; then call remix_open_design_example with skillId "${example.id}".`;
}

/** "Use this design system": a direct instruction. */
export function useDesignSystemMessage(system: Pick<PreviewAppDesignSystemTile, 'id' | 'name'>): string {
  return `Use the "${system.name}" design system: call set_active_design_system with designSystemId "${system.id}".`;
}

/** "Use as design system" on a style-tile exploration: a direct instruction. */
export function saveTileMessage(explorationId: string, direction: Pick<PreviewAppDirection, 'id' | 'label'>): string {
  return `Save tile "${direction.label}" (${direction.id}) from the Open Design style-tile exploration "${explorationId}" as a design system: call choose_open_design_direction with explorationId "${explorationId}", directionId "${direction.id}" and next: "save-design-system".`;
}

/** "Fix this piece" on the campaign sheet. */
export function fixCampaignPieceMessage(masterEntryPath: string, tile: Pick<PreviewAppCampaignTile, 'label' | 'shape' | 'entryPath' | 'errors'>): string {
  const piece = tile.entryPath ? `the piece "${tile.entryPath}"` : `the "${tile.shape ?? tile.label}" shape of "${masterEntryPath}"`;
  const errors = tile.errors.length ? `\n${tile.errors.map((e) => `- ${e.check}: ${e.message}`).join('\n')}` : ' It has no errors listed; ask me what to change.';
  return `Fix ${piece} on the Open Design campaign sheet (${tile.label}).${errors}\n\nThen export the master again with campaignSheet: true and call ${SHOW_ARTIFACT_TOOL} with entryPath "${masterEntryPath}" and campaign: true to show me the sheet.`;
}
