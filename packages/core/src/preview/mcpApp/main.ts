/// <reference lib="dom" />
// The preview MCP App page (openspec add-mcp-app-preview): shown inline in
// hosts that render MCP Apps (Claude Desktop Chat) for show_open_design_artifact.
// The design renders in a nested, sandboxed frame from its standalone export
// with the preview bridge injected; Comment mode reuses the browser preview's
// comment controller over the MCP Apps transport. Exports and "Ask Claude to
// apply" post chat messages: the host refuses downloads. Bundled by the MCP
// server's build as mcp-app.js and inlined into the `ui://` resource.
import { App } from '@modelcontextprotocol/ext-apps';
import { createCommentController } from '../commentController';
import { icon } from '../dom/icons';
import { escapeHtml, highlightBox, hostRectOf, selectionGuides } from '../overlays';
import { BRIDGE_TAG, isBridgeMessage, type BridgeRect, type ElementSnapshot, type FromBridge, type ToBridge, type Untagged } from '../protocol';
import {
  applyCommentsMessage,
  exportRequestMessage,
  pickDirectionMessage,
  SHOW_ARTIFACT_TOOL,
  type PreviewAppArtifactState,
  type PreviewAppExplorationState,
  type ShowTarget,
} from './protocol';
import { createMcpAppTransport } from './transport';

type Mode = 'view' | 'comment';

const EXPORT_LABELS: Record<string, string> = { png: 'PNG', pdf: 'PDF', standalone: 'HTML file', pptx: 'PowerPoint' };

const root = document.getElementById('root')!;
const app = new App({ name: 'Open Design preview', version: '1.0.0' });
const transport = createMcpAppTransport(app);

const toastEl = document.createElement('div');
toastEl.className = 'od-toast';
toastEl.hidden = true;
toastEl.setAttribute('role', 'status');
document.body.appendChild(toastEl);
let toastTimer = 0;
function toast(text: string): void {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 4000);
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

function showMessage(text: string): void {
  root.innerHTML = `<div class="od-message">${escapeHtml(text)}</div>`;
}

// ── Host context: theme and display mode ──────────────────────────────────
function applyHostContext(): void {
  const ctx = app.getHostContext();
  const dark = ctx?.theme ? ctx.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('od-dark', dark);
  document.body.classList.toggle('od-fullscreen', ctx?.displayMode === 'fullscreen');
  const fullscreen = document.getElementById('od-fullscreen');
  if (fullscreen) {
    fullscreen.hidden = !(ctx?.availableDisplayModes ?? []).includes('fullscreen');
    fullscreen.setAttribute('aria-pressed', String(ctx?.displayMode === 'fullscreen'));
  }
}

function fullscreenButton(): string {
  return `<button id="od-fullscreen" class="od-btn" title="Fullscreen" aria-pressed="false" hidden>${icon('expand')}<span class="od-label">Fullscreen</span></button>`;
}

function wireFullscreen(): void {
  document.getElementById('od-fullscreen')?.addEventListener('click', () => {
    const next = app.getHostContext()?.displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
    app.requestDisplayMode({ mode: next }).catch((err) => toast(`Couldn't change the view: ${errorText(err)}`));
  });
  applyHostContext();
}

async function send(text: string, done: string): Promise<boolean> {
  try {
    await transport.sendToChat(text);
    toast(done);
    return true;
  } catch (err) {
    toast(`Couldn't send it to the chat: ${errorText(err)}`);
    return false;
  }
}

// ── An artifact ───────────────────────────────────────────────────────────
function renderArtifact(state: PreviewAppArtifactState, reload: () => void): void {
  const { entryPath } = state;
  const exportButtons = state.exports
    .map((f) => `<button class="od-btn" data-export="${escapeHtml(f)}" title="Ask Claude to export it as ${escapeHtml(EXPORT_LABELS[f] ?? f)}">${icon('export')}<span class="od-label">${escapeHtml(EXPORT_LABELS[f] ?? f)}</span></button>`)
    .join('');
  root.innerHTML = `
  <div class="od-toolbar" role="toolbar" aria-label="Preview">
    <div class="od-segmented" role="radiogroup" aria-label="Mode"${state.html ? '' : ' hidden'}>
      <button data-mode="view" class="od-seg-btn active" role="radio" aria-checked="true" title="View">${icon('eye')}<span class="od-label">View</span></button>
      <button data-mode="comment" class="od-seg-btn" role="radio" aria-checked="false" tabindex="-1" title="Comment on elements">${icon('comment')}<span class="od-label">Comment</span></button>
    </div>
    <span class="od-title" title="${escapeHtml(entryPath)}">${escapeHtml(state.title)}</span>
    <span class="od-toolbar-spacer"></span>
    <button id="od-apply" class="od-btn od-btn-primary" title="Send the open comments to Claude" hidden>${icon('send')}<span class="od-label">Ask Claude to apply</span><span id="od-apply-count" class="od-count"></span></button>
    ${exportButtons ? `<div class="od-export-group">${exportButtons}</div>` : ''}
    <button id="od-refresh" class="od-icon-btn" title="Reload the design" aria-label="Reload the design">${icon('refresh')}</button>
    ${fullscreenButton()}
  </div>
  <div class="od-stage">
    <div id="od-errors" class="od-errors" role="status" hidden>
      <div class="od-errors-text"><strong>This design has errors</strong><span id="od-errors-list"></span></div>
      <button id="od-errors-close" class="od-panel-close" aria-label="Dismiss">×</button>
    </div>
    ${
      state.html
        ? '<iframe id="od-preview" class="od-preview" title="Design" sandbox="allow-scripts allow-popups allow-forms"></iframe>'
        : `<div class="od-fallback"><p>${escapeHtml(state.fallback ?? '')}</p>${
            state.checkImages.length
              ? state.checkImages.map((img) => `<figure><img src="${img.src}" alt="${escapeHtml(img.label)}"><figcaption>${escapeHtml(img.label)}</figcaption></figure>`).join('')
              : '<p>No check screenshot yet. Ask Claude to run check_open_design_artifact.</p>'
          }</div>`
    }
    <div id="od-pins" class="od-pins"></div>
  </div>
  <div id="od-panel" class="od-panel" hidden></div>`;

  wireFullscreen();
  document.getElementById('od-refresh')!.addEventListener('click', reload);
  root.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((btn) =>
    btn.addEventListener('click', () => void send(exportRequestMessage(entryPath, btn.dataset.export!), 'Asked Claude to export it.')),
  );

  const applyBtn = document.getElementById('od-apply') as HTMLButtonElement;
  const applyCount = document.getElementById('od-apply-count')!;
  const iframe = document.getElementById('od-preview') as HTMLIFrameElement | null;
  const panel = document.getElementById('od-panel')!;
  const pinsLayer = document.getElementById('od-pins')!;
  let mode: Mode = 'view';

  const comments = createCommentController({
    panel,
    // Pins are only drawn when there is a frame to anchor them to.
    iframe: iframe ?? document.createElement('iframe'),
    host: 'mcp-app',
    pinDetails: true,
    persist: (changed, deletedIds) => {
      transport.persist(entryPath, changed, deletedIds).catch((err) => toast(`Couldn't save the comment: ${errorText(err)}`));
    },
    closePanel: () => closePanel(),
    onListChanged: () => {
      updateApply();
      toBridge({ type: 'set-comments', comments: comments.forBridge() });
      renderOverlays();
    },
  });

  function updateApply(): void {
    const open = comments.open().length;
    applyBtn.hidden = mode !== 'comment' && open === 0;
    applyBtn.disabled = open === 0;
    applyCount.textContent = open ? String(open) : '';
  }

  applyBtn.addEventListener('click', async () => {
    const open = comments.open();
    if (open.length === 0) return;
    if (await send(applyCommentsMessage(entryPath, open), 'Sent to Claude.')) comments.markOpenSent();
  });

  comments.setComments(state.comments);
  if (!iframe) return;

  let hoverRect: BridgeRect | null = null;
  let selection: ElementSnapshot | null = null;
  let selectionRect: BridgeRect | null = null;
  let pinRects: { commentId: string; rect: BridgeRect | null }[] = [];
  let bridgeReady = false;

  // The frame is sandboxed without same-origin, so its origin is opaque ("null"): address it by window, not origin.
  function toBridge(message: Untagged<ToBridge>): void {
    iframe?.contentWindow?.postMessage({ od: BRIDGE_TAG, ...message }, '*');
  }

  function closePanel(): void {
    panel.hidden = true;
    selection = null;
    selectionRect = null;
    toBridge({ type: 'clear-selection' });
    renderOverlays();
  }

  function renderOverlays(): void {
    pinsLayer.innerHTML = '';
    if (mode === 'view' || !iframe) return;
    if (hoverRect) pinsLayer.appendChild(highlightBox(hostRectOf(iframe, hoverRect), 'od-hover-box'));
    if (selection && selectionRect) {
      const rect = hostRectOf(iframe, selectionRect);
      selectionGuides(iframe, rect).forEach((line) => pinsLayer.appendChild(line));
      pinsLayer.appendChild(highlightBox(rect, 'od-select-box'));
    }
    comments.pins(pinRects).forEach((pin) => pinsLayer.appendChild(pin));
  }

  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.od-seg-btn[data-mode]'));
  function setMode(next: Mode): void {
    if (next !== 'view' && !bridgeReady) {
      toast("Comment isn't available: the design's page didn't start the preview helper, usually because one of its scripts failed.");
      return;
    }
    mode = next;
    modeButtons.forEach((btn) => {
      const active = btn.dataset.mode === next;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    panel.hidden = true;
    selection = null;
    selectionRect = null;
    hoverRect = null;
    pinRects = [];
    updateApply();
    toBridge({ type: 'set-mode', mode: next });
    toBridge({ type: 'set-comments', comments: comments.forBridge() });
    renderOverlays();
  }
  modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode as Mode)));

  const errorsBanner = document.getElementById('od-errors')!;
  const errorsList = document.getElementById('od-errors-list')!;
  const previewErrors: string[] = [];
  document.getElementById('od-errors-close')!.addEventListener('click', () => {
    errorsBanner.hidden = true;
  });

  // Messages from the design are untrusted: only this frame's window, and only the bridge's shapes.
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (typeof event.data?.odPreviewError === 'string') {
      const text = event.data.odPreviewError as string;
      if (!previewErrors.includes(text) && previewErrors.length < 20) {
        previewErrors.push(text);
        errorsBanner.hidden = false;
        errorsList.innerHTML = previewErrors
          .slice(0, 3)
          .map((e) => `<code>${escapeHtml(e)}</code>`)
          .join('');
      }
      return;
    }
    if (!isBridgeMessage(event.data)) return;
    const message = event.data as FromBridge;
    switch (message.type) {
      case 'ready':
        bridgeReady = true;
        toBridge({ type: 'set-mode', mode });
        toBridge({ type: 'set-comments', comments: comments.forBridge() });
        break;
      case 'select':
        if (mode === 'view') break;
        selection = message.element;
        selectionRect = message.element.rect;
        hoverRect = null;
        renderOverlays();
        comments.openInput(selection);
        break;
      case 'rects':
        hoverRect = message.hover;
        selectionRect = selection ? message.selection : null;
        pinRects = Array.isArray(message.pins) ? message.pins : [];
        renderOverlays();
        break;
      case 'open-local-link':
        toast('Links to other files open in the browser preview (open_open_design_preview).');
        break;
    }
  });
  iframe.addEventListener('load', () => {
    toBridge({ type: 'hello' });
    renderOverlays();
  });
  window.addEventListener('resize', renderOverlays);
  iframe.srcdoc = state.html!;
}

// ── An exploration ────────────────────────────────────────────────────────
function renderExploration(state: PreviewAppExplorationState, reload: () => void): void {
  root.innerHTML = `
  <div class="od-toolbar" role="toolbar" aria-label="Exploration">
    <span class="od-title">${escapeHtml(state.title)}</span>
    <span class="od-toolbar-spacer"></span>
    <button id="od-refresh" class="od-icon-btn" title="Reload" aria-label="Reload">${icon('refresh')}</button>
    ${fullscreenButton()}
  </div>
  <div class="od-stage"><div class="od-directions">${state.directions
    .map(
      (d) => `<article class="od-direction${d.id === state.chosenDirectionId ? ' chosen' : ''}">
      <div class="od-direction-frame" data-direction="${escapeHtml(d.id)}">${
        d.html ? '' : d.image ? `<img src="${d.image}" alt="${escapeHtml(d.label)}">` : `<div class="od-message">${d.entryPath ? 'No preview yet.' : 'Not built yet.'}</div>`
      }</div>
      <div class="od-direction-body">
        <h2>${escapeHtml(d.label)}</h2>
        <p>${escapeHtml(d.summary)}</p>
        ${d.id === state.chosenDirectionId ? '<p>Chosen</p>' : `<button class="od-btn od-btn-primary" data-pick="${escapeHtml(d.id)}">${icon('check')}<span class="od-label">Take this one</span></button>`}
      </div>
    </article>`,
    )
    .join('')}</div></div>`;

  wireFullscreen();
  document.getElementById('od-refresh')!.addEventListener('click', reload);
  // View-only frames, scaled to the card's width: no bridge and no scripts' access to this page.
  for (const d of state.directions) {
    if (!d.html) continue;
    const holder = root.querySelector<HTMLElement>(`[data-direction="${CSS.escape(d.id)}"]`)!;
    const frame = document.createElement('iframe');
    frame.title = d.label;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = d.html;
    holder.appendChild(frame);
    const fit = (): void => {
      frame.style.transform = `scale(${holder.clientWidth / 1280})`;
    };
    fit();
    new ResizeObserver(fit).observe(holder);
  }
  root.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const direction = state.directions.find((d) => d.id === btn.dataset.pick);
      if (direction) void send(pickDirectionMessage(state.explorationId, direction), `Sent "${direction.label}" to Claude.`);
    }),
  );
}

// ── Start ─────────────────────────────────────────────────────────────────
let target: ShowTarget | undefined;

async function render(): Promise<void> {
  if (!target) return;
  try {
    const state = await transport.loadState(target);
    if (state.view === 'artifact') renderArtifact(state, () => void render());
    else renderExploration(state, () => void render());
  } catch (err) {
    showMessage(`Couldn't load the design: ${errorText(err)}`);
  }
}

function targetFrom(value: unknown): ShowTarget | undefined {
  const v = value as Partial<ShowTarget> | undefined;
  if (v?.view === 'artifact' && typeof v.entryPath === 'string') return { view: 'artifact', entryPath: v.entryPath, title: String(v.title ?? v.entryPath) };
  if (v?.view === 'exploration' && typeof v.explorationId === 'string') return { view: 'exploration', explorationId: v.explorationId, title: String(v.title ?? v.explorationId) };
  return undefined;
}

showMessage('Loading the design…');
app.ontoolinput = (params) => {
  // Shown before the result arrives; the result's target is the one the server checked.
  const args = params.arguments ?? {};
  if (!target && typeof args.entryPath === 'string') target = { view: 'artifact', entryPath: args.entryPath, title: args.entryPath };
  else if (!target && typeof args.explorationId === 'string') target = { view: 'exploration', explorationId: args.explorationId, title: args.explorationId };
};
app.ontoolresult = (result) => {
  const next = targetFrom(result.structuredContent);
  if (!next) {
    const text = (result.content ?? []).find((c) => c.type === 'text');
    showMessage(text && 'text' in text ? String(text.text) : `${SHOW_ARTIFACT_TOOL} returned nothing to show.`);
    return;
  }
  target = next;
  void render();
};
app.onhostcontextchanged = () => applyHostContext();
app.onteardown = async () => ({});
app.connect().then(applyHostContext, (err) => showMessage(`Couldn't connect to the host: ${errorText(err)}`));

