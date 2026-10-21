import * as path from 'node:path';
import {
  type AssetResolution,
  CLAUDE_ARTIFACT_PROVIDER,
  latestShareFor,
  readShareRecords,
  type JsonRecord,
  findStaleSources,
  formatSourceRegistration,
  prepareSourceRegistration,
  readSourceTool,
  recordedSources,
  resolveBriefSources,
  chooseDirection as chooseDirectionCore,
  compareExploration as compareExplorationCore,
  prepareExploration as prepareExplorationCore,
  refreshExplorationCompare,
  type ChooseDirectionInput,
  type ExplorationToolContext,
  type PrepareExplorationInput,
  composeCustomDesignSystemInstructions,
  composeDesignSystemTokensInstructions,
  composeInstructions,
  composePortToAppInstructions,
  copyExampleArtifact,
  detectExistingApp,
  addDiagramRuntime as addDiagramRuntimeCore,
  checkArtifact as checkArtifactCore,
  formatAddDiagramRuntimeResult,
  exportArtifact as exportArtifactCore,
  formatCheckResult,
  listSkillsPayload,
  type ListSkillsInput,
  type PasteTarget,
  type CheckViewport,
  type ReviewView,
  find3dAssets as find3dAssetsCore,
  formatFound3dAssets,
  type Find3dAssetsInput,
  publishArtifact as publishArtifactCore,
  restoreArtifact as restoreArtifactCore,
  exportsForKind,
  formatExportResult,
  loadLocalPrompts,
  renderLocalPrompt,
  extractBrandEvidence,
  findCollectionArtifacts,
  hostOverrideFor,
  readArtifact,
  readUnaddressedComments,
  resolveArtifactComments,
  PreviewSession,
  formatPreviewOutcome,
  loadPreviewAssets,
  buildArtifactPreviewState,
  buildExplorationPreviewState,
  prepareShow,
  previewAppResourceDomains,
  remoteOrigins,
  renderPreviewAppPage,
  saveCommentFromApp,
  previewModeFromEnv,
  type PreviewMode,
  resolveActiveDesignSystem,
  resolveCraftSections,
  craftRequirementsFor,
  setActiveDesignSystem,
  suggestCollectionScreenEntryPath,
  suggestTargetComponentPath,
  writeArtifactManifest,
  getFormat,
  unknownFormatError,
  resolveBriefCanvas,
  posterRegistrationMetadata,
  adaptArtifact,
  formatAdaptResult,
  createArtifactQrCode,
  formatQrCodeResult,
  agentFromClientName,
  composePublishCanvaTemplateInstructions,
  preparePullFigmaFrame,
  prepareFigmaPush,
  formatIntegrations,
  type ListIntegrationsInput,
  type ActiveDesignSystemStore,
  type ContentIndex,
  type ExportFormat,
  type LocalPrompt,
} from '@feimacode/open-design-agent-kit-core';
import { figmaTokenFilePath } from './env';

export interface ToolContext {
  contentIndex: ContentIndex;
  store: ActiveDesignSystemStore;
  workspaceRoot: string;
  outputDir: string;
  assetsRoot: string;
  figmaToken?: string;
  /** The client name from the MCP initialize handshake (e.g. "claude-code", "codex-mcp-client"). */
  clientName?: string;
  /** True when the client renders MCP Apps (it lists the io.modelcontextprotocol/ui extension). */
  rendersMcpApps?: boolean;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'artifact';
}

function suggestEntryPath(ctx: ToolContext, brief: string, skillName: string): string {
  const slugSource = brief.trim().length > 0 ? brief : skillName;
  const slug = slugify(slugSource);
  return path.posix.join(ctx.outputDir, slug, `${slug}.html`);
}

const KIND_TO_RENDERER: Record<string, string> = {
  html: 'html',
  deck: 'deck-html',
  'react-component': 'react-component',
  'markdown-document': 'markdown',
  svg: 'svg',
  diagram: 'diagram',
  'code-snippet': 'code',
  'mini-app': 'mini-app',
  'design-system': 'design-system',
};

export async function listSkills(ctx: ToolContext, input: ListSkillsInput): Promise<unknown> {
  return listSkillsPayload(ctx.contentIndex, input);
}

export interface RemixablePrompt {
  /** Hyphenated invocation name, e.g. "od-video-frame-liquid-bg-hero". Colons render as literal spaces in some MCP clients' chat input, so this is never the colon form. */
  name: string;
  publicId: string;
  displayName: string;
  examplePrompt?: string;
}

/**
 * The remixable-example catalog (source: 'example', exampleArtifactPath
 * non-empty) as MCP prompt entries — same filter already backing
 * list_open_design_skills' remixableOnly, VS Code's Gallery Grid, and
 * references/remixable-examples.md. Selecting one is meant to prefill a
 * client's chat composer with the example's brief (mirroring
 * packages/vscode's chatWithExample.ts), not to write or generate anything.
 */
export async function listRemixablePrompts(ctx: ToolContext): Promise<RemixablePrompt[]> {
  const skills = await ctx.contentIndex.listSkills(undefined, undefined, 'example', true);
  return skills.map((s) => ({
    name: s.id.replace(/:/g, '-'),
    publicId: s.id,
    displayName: s.name,
    examplePrompt: s.examplePrompt,
  }));
}

/**
 * Deliberately does NOT say `Use the Open Design skill "<id>"` — VS Code's
 * chatWithExample.ts uses exactly that phrasing safely, but on Claude Code
 * this text becomes a fresh user message with no surrounding skill context,
 * and the model reflexively tried invoking its own built-in Skill tool with
 * the quoted id (which isn't a real Skill name — od:<mode>:<name> is this
 * server's own internal skillId namespace), producing a real "Unknown
 * skill" error observed live. Naming the MCP tool explicitly and using
 * "skillId" instead of "skill" avoids that misread.
 */
export function buildRemixPromptMessage(prompt: RemixablePrompt): string {
  const brief = prompt.examplePrompt ? ` ${prompt.examplePrompt}` : '';
  return `Remix the Open Design example "${prompt.displayName}" — call the open-design MCP server's remix_open_design_example tool with skillId "${prompt.publicId}".${brief}`;
}

export async function listDesignSystems(ctx: ToolContext, input: { query?: string; category?: string }): Promise<unknown> {
  const designSystems = await ctx.contentIndex.listDesignSystems(input.query, input.category);
  const activeId = await ctx.store.get();
  return designSystems.map((ds) => ({
    id: ds.id,
    name: ds.name,
    summary: ds.summary,
    category: ds.category,
    source: ds.source,
    active: ds.id === activeId,
  }));
}

export async function prepareBrief(
  ctx: ToolContext,
  input: {
    skillId: string;
    designSystemId?: string;
    brief: string;
    collectionId?: string;
    collectionName?: string;
    screenRole?: string;
    screenTotal?: number;
    sources?: string[];
    format?: string;
    fluid?: boolean;
  },
): Promise<string> {
  const canvas = resolveBriefCanvas(input.format, input.fluid);
  if ('error' in canvas) return canvas.error;
  const canvasFormat = canvas.format;
  const skill = await ctx.contentIndex.getSkill(input.skillId);
  if (!skill) {
    const available = (await ctx.contentIndex.listSkills()).map((s) => s.id).slice(0, 20);
    return `Unknown skillId "${input.skillId}". Call list_open_design_skills to see available ids. A few available ids: ${available.join(', ')}`;
  }

  const resolution = await resolveActiveDesignSystem(input.designSystemId, ctx.store, (id) => ctx.contentIndex.getDesignSystem(id));
  if (resolution.unknownExplicitId) {
    const available = (await ctx.contentIndex.listDesignSystems()).map((d) => d.id).slice(0, 20);
    return `Unknown designSystemId "${resolution.unknownExplicitId}". Call list_open_design_design_systems to see available ids. A few available ids: ${available.join(', ')}`;
  }
  const { designSystemId, designSystem } = resolution;

  const allCraftSections = await ctx.contentIndex.craftSections();
  const craftSections = resolveCraftSections(allCraftSections, craftRequirementsFor(skill, designSystem));
  const existingAppFrameworks = await detectExistingApp(ctx.workspaceRoot);

  let suggestedEntryPath: string;
  let collectionContext: Parameters<typeof composeInstructions>[0]['collectionContext'];
  if (input.collectionId) {
    if (!input.screenRole) {
      return 'screenRole is required when collectionId is given — a short label for this screen\'s role in the flow, e.g. "splash", "value-prop", "checkout".';
    }
    const siblings = await findCollectionArtifacts(ctx.workspaceRoot, ctx.outputDir, input.collectionId);
    suggestedEntryPath = suggestCollectionScreenEntryPath(ctx.outputDir, input.collectionId, slugify(input.screenRole));
    collectionContext = {
      collectionName: input.collectionName ?? input.collectionId,
      index: siblings.length + 1,
      total: input.screenTotal ?? siblings.length + 1,
      role: input.screenRole,
      siblingScreens: siblings.map((s) => ({ role: s.screenRole ?? '?', title: s.title })),
    };
  } else {
    suggestedEntryPath = suggestEntryPath(ctx, input.brief, skill.name);
  }

  const sources = await resolveBriefSources({
    workspaceRoot: ctx.workspaceRoot,
    outputDir: ctx.outputDir,
    sourcePaths: input.sources,
    skillId: skill.id,
    skillMode: skill.mode,
    suggestedEntryPath,
  });
  if (!sources.ok) return sources.error;

  const instructions = composeInstructions({
    skillName: skill.name,
    skillBody: skill.body,
    designSystemTitle: designSystem?.name,
    designSystemBody: designSystem?.body,
    craftSections,
    brief: input.brief,
    suggestedEntryPath,
    existingAppFrameworks,
    collectionContext,
    hostOverride: hostOverrideFor(skill.id, skill.body),
    sourceContext: sources.context,
    canvasFormat,
    fluid: canvas.fluid,
  });

  const payload = {
    instructions,
    suggestedEntryPath,
    suggestedKind: 'html',
    format: canvasFormat?.id,
    fluid: canvasFormat ? canvas.fluid : undefined,
    designSystemId: designSystem ? designSystemId : undefined,
    designSystemName: designSystem?.name,
    outlinePath: sources.context?.outlinePath,
    sources: sources.context?.sources.map((s) => ({ path: s.path, markdownPath: s.markdownPath, kind: s.kind })),
  };
  return JSON.stringify(payload, null, 2);
}

export async function registerArtifact(
  ctx: ToolContext,
  input: {
    entryPath: string;
    kind: string;
    title: string;
    supportingFiles?: string[];
    sourceSkillId?: string;
    designSystemId?: string;
    collectionId?: string;
    collectionName?: string;
    screenIndex?: number;
    screenRole?: string;
    explorationId?: string;
    directionId?: string;
    sources?: string[];
    format?: string;
    resolvedCommentIds?: string[];
  },
): Promise<string> {
  if (input.format !== undefined && !getFormat(input.format)) return unknownFormatError(input.format);
  const renderer = KIND_TO_RENDERER[input.kind];
  const exportsList = exportsForKind(input.kind);
  if (!renderer || !exportsList) {
    return `Unsupported kind "${input.kind}". Allowed: ${Object.keys(KIND_TO_RENDERER).join(', ')}`;
  }

  try {
    const sourceRegistration = input.sources?.length
      ? await prepareSourceRegistration({ workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir, entryPath: input.entryPath, sourcePaths: input.sources })
      : undefined;
    const manifest = await writeArtifactManifest({
      workspaceRoot: ctx.workspaceRoot,
      entryPath: input.entryPath,
      artifactManifest: {
        kind: input.kind,
        renderer,
        exports: exportsList,
        title: input.title,
        supportingFiles: input.supportingFiles,
        sourceSkillId: input.sourceSkillId,
        designSystemId: input.designSystemId,
        collectionId: input.collectionId,
        collectionName: input.collectionName,
        screenIndex: input.screenIndex,
        screenRole: input.screenRole,
        explorationId: input.explorationId,
        directionId: input.directionId,
        sources: sourceRegistration?.sources.length ? sourceRegistration.sources : undefined,
        metadata: await posterRegistrationMetadata(ctx.workspaceRoot, input.entryPath, input.format),
      },
    });
    const sourceNote = sourceRegistration ? `\n\n${formatSourceRegistration(sourceRegistration)}` : '';

    let explorationNote = '';
    if (input.explorationId) {
      const compare = await refreshExplorationCompare(ctx.workspaceRoot, ctx.outputDir, input.explorationId);
      explorationNote = compare.ok
        ? `\n\nExploration comparison page updated: ${compare.comparePath} (${compare.registered.length} of ${compare.plan.directions.length} directions registered${compare.missing.length > 0 ? `; still missing: ${compare.missing.join(', ')}` : '; all registered, so call compare_open_design_exploration next'}).`
        : `\n\nWarning: ${compare.warning}`;
    }

    let commentsNote = '';
    if (input.resolvedCommentIds?.length) {
      const { resolved, unknown } = await resolveArtifactComments(ctx.workspaceRoot, input.entryPath, input.resolvedCommentIds);
      commentsNote = `\n\nMarked ${resolved.length} comment(s) resolved.${unknown.length ? ` No comment with id ${unknown.join(', ')}.` : ''}`;
    }

    return `Artifact registered at ${input.entryPath}.artifact.json\n\n${JSON.stringify(manifest, null, 2)}\n\nWritten to ${path.join(ctx.workspaceRoot, input.entryPath)}.${await previewNoteAfterRegister(ctx, input.entryPath)}${artifactPreviewHint(ctx, manifest)}${commentsNote}${explorationNote}${sourceNote}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Failed to register artifact: ${message}`;
  }
}

/** Claude Code and Claude Desktop ("claude-ai") identify with a name containing "claude". */
export function isClaudeClient(clientName: string | undefined): boolean {
  return /claude/i.test(clientName ?? '');
}

/** One line suggesting the private artifact preview, for Claude clients on a design that has none yet (openspec add-artifact-preview). */
function artifactPreviewHint(ctx: ToolContext, manifest: JsonRecord): string {
  if (!isClaudeClient(ctx.clientName) || latestShareFor(readShareRecords(manifest), CLAUDE_ARTIFACT_PROVIDER)) return '';
  return '\n\nArtifact preview: if you have an Artifact tool, show the user this design as a private Claude artifact: call publish_open_design_artifact with provider "claude-artifact" and follow its instructions (later rounds update the same artifact).';
}

/** get_open_design_artifact: the manifest, entry, supporting files and unaddressed comments, with up to 4 comment crops attached as images. */
export async function getArtifact(ctx: ToolContext, input: { entryPath: string }): Promise<ToolOutput> {
  const result = await readArtifact({ workspaceRoot: ctx.workspaceRoot, entryPath: input.entryPath });
  if (!result) {
    return { text: `No artifact found at ${input.entryPath}. It may not have been written yet.` };
  }
  const { comments: openComments, crops } = await readUnaddressedComments(ctx.workspaceRoot, input.entryPath);
  const recorded = recordedSources(result.manifest);
  const payload = {
    manifest: result.manifest,
    supportingFiles: result.supportingFiles,
    entryContent: result.entryContent,
    openComments,
    commentScreenshotsAttached: crops.length > 0 ? crops.map((c) => c.commentId) : undefined,
    staleSources: recorded.length > 0 ? await findStaleSources(ctx.workspaceRoot, ctx.outputDir, recorded) : undefined,
    previewUrl: latestShareFor(readShareRecords(result.manifest), CLAUDE_ARTIFACT_PROVIDER)?.url,
  };
  return { text: JSON.stringify(payload, null, 2), images: crops.map((c) => ({ data: c.png, mime: 'image/png' })) };
}

// ── Browser preview (openspec add-browser-preview) ─────────────────────────
// One preview per workspace root for the life of this MCP process; the
// window and the server close when the process exits.
const previewSessions = new Map<string, PreviewSession>();
const previewOpenedFor = new Set<string>();

function previewSession(ctx: ToolContext): PreviewSession {
  let session = previewSessions.get(ctx.workspaceRoot);
  if (!session) {
    session = new PreviewSession({ workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir, log: (m) => console.error(m) });
    previewSessions.set(ctx.workspaceRoot, session);
  }
  return session;
}

export function previewMode(): PreviewMode {
  return previewModeFromEnv();
}

/** Closes every preview this process started (tests, shutdown). */
export async function closePreviews(): Promise<void> {
  const sessions = [...previewSessions.values()];
  previewSessions.clear();
  previewOpenedFor.clear();
  await Promise.all(sessions.map((s) => s.close()));
}

/** open_open_design_preview: shows a registered artifact (or the picker) in a live browser preview. */
export async function openPreview(ctx: ToolContext, input: { entryPath?: string; open?: boolean }): Promise<string> {
  if (previewMode() === 'off') return 'The browser preview is turned off (OPEN_DESIGN_PREVIEW=off).';
  if (input.entryPath) {
    const artifact = await readArtifact({ workspaceRoot: ctx.workspaceRoot, entryPath: input.entryPath });
    if (!artifact) return `No artifact found at ${input.entryPath}. Write it and call register_open_design_artifact first.`;
    if (!artifact.manifest) return `${input.entryPath} isn't registered yet. Call register_open_design_artifact first.`;
  }
  const outcome = await previewSession(ctx).open(input.entryPath, input.open !== false);
  if (outcome.how !== 'not-opened') previewOpenedFor.add(ctx.workspaceRoot);
  return formatPreviewOutcome(outcome, input.entryPath);
}

// ── Preview MCP App (openspec add-mcp-app-preview) ───────────────────────
// Remote origins the designs shown in this process still load from, declared
// in the `ui://` resource's CSP on its next read.
const previewAppOrigins = new Set<string>();

function notePreviewAppOrigins(urls: string[]): void {
  remoteOrigins(urls).forEach((o) => previewAppOrigins.add(o));
}

/** The `ui://open-design/preview` page and the remote domains it may load from. */
export async function previewAppResource(): Promise<{ html: string; resourceDomains: string[] }> {
  const assets = await loadPreviewAssets();
  return { html: renderPreviewAppPage(assets.mcpAppJs), resourceDomains: previewAppResourceDomains(previewAppOrigins) };
}

/** show_open_design_artifact: the text every host gets, plus the target the preview app renders. */
export async function showArtifact(ctx: ToolContext, input: { entryPath?: string; explorationId?: string }): Promise<ToolOutput> {
  const shown = await prepareShow({ workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir, ...input, hostRendersApp: ctx.rendersMcpApps === true });
  if (!shown.ok) return { text: shown.text };
  return { text: shown.text, structuredContent: shown.target };
}

/** get_open_design_preview_state (app only): the design as a standalone page with the bridge, its comments and check screenshots. */
export async function previewAppState(ctx: ToolContext, input: { entryPath?: string; explorationId?: string }): Promise<ToolOutput> {
  if (input.explorationId) {
    const result = await buildExplorationPreviewState({ workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir, explorationId: input.explorationId });
    if (!result.ok) throw new Error(result.message);
    notePreviewAppOrigins(result.externalDependencies);
    return { text: `Exploration ${input.explorationId}: ${result.state.directions.length} directions.`, structuredContent: { ...result.state } };
  }
  if (!input.entryPath) throw new Error('Pass entryPath or explorationId.');
  const { bridgeJs } = await loadPreviewAssets();
  const result = await buildArtifactPreviewState({ workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir, entryPath: input.entryPath, bridgeJs });
  if (!result.ok) throw new Error(result.message);
  notePreviewAppOrigins(result.externalDependencies);
  return { text: `${result.state.title} (${input.entryPath}): ${result.state.comments.length} comments.`, structuredContent: { ...result.state } };
}

/** save_open_design_comment (app only): creates, edits or deletes one comment in the sidecar. */
export async function saveComment(ctx: ToolContext, input: { entryPath: string; comment?: unknown; deleteId?: string }): Promise<ToolOutput> {
  const result = await saveCommentFromApp({ workspaceRoot: ctx.workspaceRoot, ...input });
  if (!result.ok) throw new Error(result.message);
  return { text: `Saved. ${result.comments.length} comments on ${input.entryPath}.`, structuredContent: { comments: result.comments } };
}

async function previewNoteAfterRegister(ctx: ToolContext, entryPath: string): Promise<string> {
  const mode = previewMode();
  if (mode === 'off') return '';
  const session = previewSessions.get(ctx.workspaceRoot);
  if (session?.isRunning() && previewOpenedFor.has(ctx.workspaceRoot)) {
    // An open preview of this entry reloads by itself; another entry needs a navigate.
    return ' The open browser preview reloads by itself; call open_open_design_preview to switch it to this artifact.';
  }
  if (mode === 'auto') {
    try {
      return `\n\n${await openPreview(ctx, { entryPath })}`;
    } catch (err) {
      return `\n\nThe browser preview couldn't open: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return ' Call open_open_design_preview to show it to the user in a live browser preview, where they can also leave comments.';
}

export async function setActiveDesignSystemTool(ctx: ToolContext, input: { designSystemId?: string }): Promise<string> {
  const result = await setActiveDesignSystem(input.designSystemId, ctx.store, (id) => ctx.contentIndex.getDesignSystem(id));
  if (result.outcome === 'cleared') return 'Cleared the active Open Design design system.';
  if (result.outcome === 'unknown') {
    const available = (await ctx.contentIndex.listDesignSystems()).map((d) => d.id).slice(0, 20);
    return `Unknown designSystemId "${result.unknownId}". Call list_open_design_design_systems to see available ids. A few available ids: ${available.join(', ')}`;
  }
  return `Active Open Design design system set to "${input.designSystemId}" (${result.designSystem.name}).`;
}

export async function createCustomDesignSystem(
  ctx: ToolContext,
  input: { name?: string; brief?: string; sourceUrl?: string; existingDesignSystemId?: string },
): Promise<string> {
  if (input.existingDesignSystemId) {
    const id = input.existingDesignSystemId.trim();
    const result = composeDesignSystemTokensInstructions(id, await ctx.contentIndex.getDesignSystem(id), ctx.outputDir);
    if (!result.ok) return result.error;
    return JSON.stringify({ instructions: result.instructions, suggestedEntryPath: result.suggestedEntryPath, id: result.id }, null, 2);
  }
  if (!input.name?.trim() || !input.brief?.trim()) {
    return 'Both "name" and "brief" are required to create a new design system (or pass "existingDesignSystemId" to write only tokens.css for an existing custom one).';
  }
  const slug = slugify(input.name);
  const id = `user:${slug}`;
  const suggestedEntryPath = path.posix.join(ctx.outputDir, 'design-systems', slug, 'DESIGN.md');
  const evidence = input.sourceUrl ? await extractBrandEvidence(input.sourceUrl) : undefined;
  const instructions = composeCustomDesignSystemInstructions({ name: input.name, brief: input.brief, suggestedEntryPath, id, evidence });
  return JSON.stringify({ instructions, suggestedEntryPath, id }, null, 2);
}

export async function portToAppCode(
  ctx: ToolContext,
  input: { entryPath: string; targetComponentPath?: string; referenceComponentPath?: string },
): Promise<string> {
  const artifact = await readArtifact({ workspaceRoot: ctx.workspaceRoot, entryPath: input.entryPath });
  if (!artifact) {
    return `No artifact found at ${input.entryPath}. It may not have been written yet.`;
  }
  const artifactName =
    typeof artifact.manifest?.title === 'string' ? artifact.manifest.title : path.basename(input.entryPath, path.extname(input.entryPath));
  const targetComponentPath = input.targetComponentPath ?? (await suggestTargetComponentPath(ctx.workspaceRoot, artifactName));
  const instructions = composePortToAppInstructions({
    artifactEntryPath: input.entryPath,
    artifactContent: artifact.entryContent,
    targetComponentPath,
    referenceComponentPath: input.referenceComponentPath,
  });
  return JSON.stringify({ instructions, suggestedTargetComponentPath: targetComponentPath }, null, 2);
}

export async function pullFigmaFrame(ctx: ToolContext, input: { figmaUrl: string; designSystemId?: string }): Promise<string> {
  return preparePullFigmaFrame({
    figmaUrl: input.figmaUrl,
    designSystemId: input.designSystemId,
    token: ctx.figmaToken,
    outputDir: ctx.outputDir,
    tokenSetupHint:
      `save a personal access token from Figma → Settings → Personal access tokens in ${figmaTokenFilePath()} on the machine this server runs on, or set the OPEN_DESIGN_FIGMA_TOKEN environment variable for this MCP server`,
  });
}

export async function remixExample(ctx: ToolContext, input: { skillId: string }): Promise<string> {
  const skill = await ctx.contentIndex.getSkill(input.skillId);
  if (!skill) {
    const available = (await ctx.contentIndex.listSkills()).map((s) => s.id).slice(0, 20);
    return `Unknown skillId "${input.skillId}". Call list_open_design_skills to see available ids. A few available ids: ${available.join(', ')}`;
  }
  if (!skill.exampleArtifactPath) {
    return `"${input.skillId}" has no remixable starting artifact. Check each result's 'exampleArtifactPath' field via list_open_design_skills, or use prepare_open_design_brief to generate from scratch instead.`;
  }

  const slug = slugify(skill.name);
  const entryPath = `${ctx.outputDir}/${slug}/${slug}.html`;

  const { supportingFiles } = await copyExampleArtifact({
    assetsRoot: ctx.assetsRoot,
    exampleArtifactPath: skill.exampleArtifactPath,
    workspaceRoot: ctx.workspaceRoot,
    entryPath,
  });

  const manifest = await writeArtifactManifest({
    workspaceRoot: ctx.workspaceRoot,
    entryPath,
    artifactManifest: {
      kind: 'html',
      renderer: 'html',
      exports: exportsForKind('html'),
      title: skill.name,
      supportingFiles,
      sourceSkillId: input.skillId,
      metadata: { remixedFrom: input.skillId },
    },
  });

  const brief =
    skill.examplePrompt ?? `Adapt this example ("${skill.name}") to the user's specific request, keeping its overall visual approach.`;
  const instructions = `The file at "${entryPath}" already exists — it's a copy of the "${skill.name}" example. Read it first, then apply the following as a targeted MODIFICATION to the existing content, not a from-scratch regeneration:\n\n${brief}\n\nAfter making changes, call register_open_design_artifact again with the same entryPath if the kind/title/supportingFiles need updating.`;

  return JSON.stringify({ entryPath, instructions, manifest }, null, 2);
}

export async function exportArtifact(
  ctx: ToolContext,
  input: {
    entryPath: string;
    format?: ExportFormat;
    quality?: number;
    width?: number;
    height?: number;
    scale?: number;
    selector?: string;
    maxBytes?: number;
    deck?: boolean;
    slides?: number[];
    badge?: boolean;
    baseUrl?: string;
    embedAssets?: boolean;
    maxResolution?: AssetResolution;
    preset?: string;
    bleed?: number;
    cropMarks?: boolean;
    checkOnly?: boolean;
    data?: string;
    sheet?: string;
    nameField?: string;
    split?: boolean;
    presets?: string[];
    shapeSheet?: boolean;
    target?: PasteTarget;
    campaignSheet?: boolean;
    transparent?: boolean;
    fps?: number;
    duration?: number;
    loop?: boolean;
  },
): Promise<string> {
  // Browser path: OPEN_DESIGN_BROWSER_PATH is read by core's discovery itself;
  // OPEN_DESIGN_SHARE_BADGE by core's badge resolution.
  const result = await exportArtifactCore({
    ...input,
    workspaceRoot: ctx.workspaceRoot,
    outputDir: ctx.outputDir,
    lookupAspectHint: async (id) => (await ctx.contentIndex.getSkill(id))?.aspectHint,
  });
  return formatExportResult(result);
}

/** A tool result with images: the text always carries the complete result, so clients that ignore images lose nothing. */
export interface ToolOutput {
  text: string;
  images?: Array<{ data: Buffer; mime: string }>;
  /** For an MCP App: the data its page reads from the tool result. */
  structuredContent?: Record<string, unknown>;
}

/** MCP `content` for a handler's result: one text item, then one image item per image. */
export function toCallToolContent(out: string | ToolOutput): Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> {
  if (typeof out === 'string') return [{ type: 'text', text: out }];
  return [{ type: 'text', text: out.text }, ...(out.images ?? []).map((i) => ({ type: 'image' as const, data: i.data.toString('base64'), mimeType: i.mime }))];
}

/** add_open_design_diagram_runtime: inserts or updates the inline diagram runtime in the entry file. */
export async function addDiagramRuntime(ctx: ToolContext, input: { entryPath: string }): Promise<string> {
  return formatAddDiagramRuntimeResult(await addDiagramRuntimeCore({ ...input, workspaceRoot: ctx.workspaceRoot }));
}

export type ListIntegrationsArgs = ListIntegrationsInput;

/** list_open_design_integrations: trusted third-party MCP servers with setup steps for the connected agent; read-only. */
export async function listIntegrations(ctx: ToolContext, input: ListIntegrationsInput): Promise<string> {
  return formatIntegrations(await ctx.contentIndex.getIntegrationRegistry(), input, agentFromClientName(ctx.clientName));
}

/** check_open_design_artifact: renders the artifact and returns findings plus screenshots; writes nothing. */
export async function checkArtifact(
  ctx: ToolContext,
  input: { entryPath: string; viewports?: CheckViewport[]; slides?: number[]; maxImages?: number; at?: number[]; views?: ReviewView[] | false },
): Promise<ToolOutput> {
  // Browser path: OPEN_DESIGN_BROWSER_PATH is read by core's discovery itself.
  const result = await checkArtifactCore({
    ...input,
    workspaceRoot: ctx.workspaceRoot,
    outputDir: ctx.outputDir,
    lookupAspectHint: async (id) => (await ctx.contentIndex.getSkill(id))?.aspectHint,
  });
  return { text: formatCheckResult(result), images: result.ok ? result.images : [] };
}

/** adapt_open_design_artifact: per-format re-composition instructions; writes only the master's collection membership. */
export async function adaptArtifactTool(ctx: ToolContext, input: { entryPath: string; formats: string[]; notes?: string }): Promise<string> {
  return formatAdaptResult(await adaptArtifact({ ...input, workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir }));
}

/** create_open_design_qr_code: writes assets/<name>.svg next to the artifact and returns inline markup. */
export async function createQrCode(
  ctx: ToolContext,
  input: { entryPath: string; text: string; name?: string; errorCorrection?: 'L' | 'M' | 'Q' | 'H'; margin?: number },
): Promise<string> {
  return formatQrCodeResult(await createArtifactQrCode({ ...input, workspaceRoot: ctx.workspaceRoot }));
}

/** publish_open_design_artifact: builds the site bundle and returns publish instructions, or records a deploy. Never deploys. */
export async function publishArtifact(
  ctx: ToolContext,
  input: {
    entryPath: string;
    provider?: string;
    badge?: boolean;
    includeFiles?: string[];
    published?: { provider: string; url: string; claimUrl?: string; expiresAt?: string; siteRef?: string };
    sync?: boolean;
  },
): Promise<string> {
  const result = await publishArtifactCore({ ...input, workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir });
  return result.text;
}

/** restore_open_design_artifact: writes a synced artifact's working files back (openspec add-artifact-sync). */
export async function restoreArtifact(ctx: ToolContext, input: { pagePath: string; artifactUrl: string; overwrite?: boolean }): Promise<string> {
  const result = await restoreArtifactCore({ ...input, workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir });
  return result.text;
}

/** publish_open_design_artifact_to_canva: instructions to get an artifact into Canva (connector-aware); writes nothing. */
export async function publishToCanva(ctx: ToolContext, input: { entryPath: string }): Promise<string> {
  const artifact = await readArtifact({ workspaceRoot: ctx.workspaceRoot, entryPath: input.entryPath });
  if (!artifact) return `No artifact found at ${input.entryPath}. It may not have been written yet.`;
  const manifest = artifact.manifest as Record<string, unknown> | undefined;
  const metadata = manifest?.metadata as Record<string, unknown> | undefined;
  return composePublishCanvaTemplateInstructions({
    artifactEntryPath: input.entryPath,
    artifactContent: artifact.entryContent,
    manifestTitle: typeof manifest?.title === 'string' ? manifest.title : undefined,
    manifestKind: typeof manifest?.kind === 'string' ? manifest.kind : undefined,
    manifestFormat: typeof metadata?.format === 'string' ? metadata.format : undefined,
  });
}

/** push_open_design_artifact_to_figma: captures the artifact and writes use_figma parts; returns instructions. Never contacts Figma. */
export async function pushToFigma(ctx: ToolContext, input: { entryPath: string; refresh?: boolean }): Promise<string> {
  // Browser path: OPEN_DESIGN_BROWSER_PATH is read by core's discovery itself.
  return (await prepareFigmaPush({ ...input, workspaceRoot: ctx.workspaceRoot })).text;
}

/** Hand-written prompts (e.g. open-design-social-post) shipped under the content assets' prompts/ folder. */
export async function listLocalPrompts(ctx: ToolContext): Promise<LocalPrompt[]> {
  return (await loadLocalPrompts(ctx.assetsRoot)).filter((p) => !p.hosts || p.hosts.includes('mcp'));
}

export function buildLocalPromptMessage(prompt: LocalPrompt, brief: string | undefined): string {
  const briefText = brief?.trim() ? brief.trim() : `(none given yet — ask the user: "${prompt.placeholder}")`;
  return renderLocalPrompt(prompt, briefText);
}

function explorationContext(ctx: ToolContext, existingAppFrameworks?: string[]): ExplorationToolContext {
  // Browser path: OPEN_DESIGN_BROWSER_PATH is read by core's discovery itself.
  return { contentIndex: ctx.contentIndex, store: ctx.store, workspaceRoot: ctx.workspaceRoot, outputDir: ctx.outputDir, existingAppFrameworks };
}

export async function prepareExploration(ctx: ToolContext, input: PrepareExplorationInput): Promise<string> {
  return prepareExplorationCore(explorationContext(ctx, await detectExistingApp(ctx.workspaceRoot)), input);
}

export async function compareExploration(ctx: ToolContext, input: { explorationId: string; contactSheet?: boolean }): Promise<string> {
  return compareExplorationCore(explorationContext(ctx), input);
}

export async function chooseDirection(ctx: ToolContext, input: ChooseDirectionInput): Promise<string> {
  return chooseDirectionCore(explorationContext(ctx, await detectExistingApp(ctx.workspaceRoot)), input);
}

export async function readSource(ctx: ToolContext, input: { path: string }): Promise<string> {
  return readSourceTool(ctx, input);
}

/** find_open_design_3d_assets: searches Poly Haven for CC0 HDRIs, textures and models; writes nothing. */
export async function find3dAssets(_ctx: ToolContext, input: Find3dAssetsInput): Promise<string> {
  return formatFound3dAssets(await find3dAssetsCore(input));
}
