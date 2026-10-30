#!/usr/bin/env -S npx tsx
// Builds the public gallery of design systems and remixable examples as a
// static site (hub and spoke): two hub pages of thumbnails, titles and tags,
// and one spoke page per item with its preview, downloads and hand-off buttons.
//
//   dist/gallery/index.html                         the landing page
//   dist/gallery/design-systems/index.html          hub
//   dist/gallery/design-systems/<id>/index.html     spoke: preview.html, kit/, claude/
//   dist/gallery/examples/index.html                hub
//   dist/gallery/examples/<slug>/index.html         spoke: preview.html
//   dist/gallery/<hub>/thumbs/<slug>.webp           thumbnails (needs Chrome, Edge or Chromium)
//   dist/gallery/gallery.json                       every item, its links and prompts, for agents
//
//   npx tsx scripts/build-gallery.ts                 the pilot in gallery/pilot.json
//   npx tsx scripts/build-gallery.ts --all           every bundled design system and example
//   options: --out <dir>  --no-thumbs  --index (drop the noindex tag)
//            --base-url <url> (the site's address, so gallery.json links are absolute)
//
// Generated, never committed (dist/ is ignored); .github/workflows/gallery.yml
// builds and deploys it to GitHub Pages. No page can act for the visitor: the
// buttons copy a prompt, open a new Claude chat with it, or link to files.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ContentIndex, type DesignSystemDetail, type SkillSummary } from '../packages/core/src/content/contentIndex';
import { buildDesignSystemPreview, buildExamplePreview, designSystemTile } from '../packages/core/src/preview/server/mcpAppPickers';
import { findBrowser } from '../packages/core/src/export/browserDiscovery';

const REPO = 'feimacode/open-design-agent-kit';
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'packages/content/assets/open-design');
const CLAUDE_DS = path.join(ROOT, 'claude-design-systems');
const DESCRIPTORS = path.join(ROOT, 'packages/content/local/design-system-descriptors.json');
const PILOT = path.join(ROOT, 'gallery/pilot.json');
/** Screenshot size and the width it's saved at: examples at 16:10, design-system covers at their own 960×288. */
const THUMB = { width: 1280, height: 800, out: 640 };
const COVER = { width: 960, height: 288, out: 640 };

interface Options {
  out: string;
  all: boolean;
  thumbs: boolean;
  index: boolean;
  baseUrl?: string;
}

/** A hub card and its spoke: everything the pages need, already resolved. */
export interface GalleryItem {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  /** Set once the thumbnail is written. */
  thumb?: string;
  /** Up to five CSS colors, for a card without a thumbnail. */
  swatches: string[];
}

interface Descriptor {
  kind?: string;
  moods?: string[];
  industries?: string[];
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { out: path.join(ROOT, 'dist/gallery'), all: false, thumbs: true, index: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--no-thumbs') opts.thumbs = false;
    else if (a === '--index') opts.index = true;
    else if (a === '--out') opts.out = path.resolve(argv[++i] ?? '');
    else if (a === '--base-url') opts.baseUrl = argv[++i] || undefined;
    else throw new Error(`Unknown option ${a}`);
  }
  return opts;
}

// ── Page chrome ───────────────────────────────────────────────────────────

export function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CSS = `
:root{--bg:#ffffff;--panel:#fafafa;--line:#e3e3e3;--text:#494949;--strong:#202020;--muted:#6b6b6b;--chip:#ededed;--accent:#202020;--accent-ink:#fafafa;--brand:#007106;
--font:'Albert Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1c;--panel:#262626;--line:#3a3a3a;--text:#e3e3e3;--strong:#fafafa;--muted:#a8a8a8;--chip:#333333;--accent:#fafafa;--accent-ink:#202020;--brand:#87ea5c;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 var(--font)}
a{color:inherit}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.wrap{max-width:1180px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left)) 64px}
header.site{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:baseline;margin-bottom:28px}
header.site .home{font-weight:700;color:var(--strong);text-decoration:none}
header.site nav{display:flex;gap:16px}
header.site nav a{color:var(--muted);text-decoration:none}
header.site nav a[aria-current]{color:var(--strong);font-weight:600}
h1{font-size:clamp(28px,4vw,40px);line-height:1.15;color:var(--strong);margin:0 0 8px;text-wrap:balance}
h2{font-size:20px;color:var(--strong);margin:32px 0 12px}
.lede{color:var(--muted);max-width:68ch;margin:0 0 24px}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px}
.filters input{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);min-width:220px;flex:1 1 220px;max-width:360px}
.chip{font:13px/1 var(--font);padding:7px 10px;border-radius:999px;border:1px solid var(--line);background:var(--bg);color:var(--text);cursor:pointer}
.chip[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;list-style:none;padding:0;margin:0}
.card a{display:grid;gap:10px;text-decoration:none}
.thumb{aspect-ratio:16/10;height:auto;border-radius:10px;border:1px solid var(--line);overflow:hidden;background:var(--panel);display:block;width:100%;object-fit:cover;object-position:top}
.cover .thumb{aspect-ratio:10/3;border-radius:10px 10px 0 0}
.cover .bar{display:flex;height:10px;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px;overflow:hidden;margin-top:-10px}
.cover .bar span{flex:1}
.grid.covers{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
.swatches{display:flex}
.swatches span{flex:1}
.card .title{font-weight:600;color:var(--strong);line-height:1.3}
.card a:hover .title{text-decoration:underline}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.tags li{font-size:12px;padding:3px 8px;border-radius:999px;background:var(--chip);color:var(--muted)}
.empty{color:var(--muted)}
.spoke{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px;align-items:start}
@media (max-width:860px){.spoke{grid-template-columns:minmax(0,1fr)}}
.tabs{display:flex;gap:4px;margin-bottom:8px}
.tab{font:600 14px/1 var(--font);padding:9px 14px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--muted);cursor:pointer}
.tab[aria-selected="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.frame{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.frame iframe{display:block;width:100%;height:min(78vh,820px);border:0}
aside{display:grid;gap:18px}
aside section{border:1px solid var(--line);border-radius:10px;padding:16px;display:grid;gap:10px;background:var(--panel)}
aside h2{margin:0;font-size:15px}
aside p{margin:0;font-size:14px}
.btn{display:inline-flex;justify-content:center;gap:8px;font:600 14px/1 var(--font);padding:10px 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);cursor:pointer;text-decoration:none}
.btn.secondary{background:transparent;color:var(--strong);border-color:var(--line)}
.prompt{font:13px/1.45 var(--mono);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px 10px;white-space:pre-wrap;word-break:break-word;margin:0}
ul.files{margin:0;padding-left:18px;font-size:14px}
.note{font-size:13px;color:var(--muted)}
.big{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:24px}
.big a{display:grid;gap:6px;padding:22px;border:1px solid var(--line);border-radius:12px;text-decoration:none;background:var(--panel)}
.big strong{font-size:20px;color:var(--strong)}
footer{margin-top:48px;font-size:13px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const COPY_JS = `document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var t=document.getElementById(b.getAttribute('data-copy')).textContent;var done=function(){var l=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=l},1500)};if(navigator.clipboard){navigator.clipboard.writeText(t).then(done,function(){})}})});`;

// Switches the spoke's frame between the two views; #claude opens (and links to) the Claude Design one.
const TABS_JS = `(function(){var tabs=[].slice.call(document.querySelectorAll('.tab')),f=document.getElementById('view');if(!tabs.length)return;
function show(t){tabs.forEach(function(o){o.setAttribute('aria-selected',String(o===t))});if(f.getAttribute('src')!==t.dataset.src)f.setAttribute('src',t.dataset.src);history.replaceState(null,'',t.dataset.hash?'#'+t.dataset.hash:location.pathname)}
tabs.forEach(function(t){t.addEventListener('click',function(){show(t)})});var h=location.hash.slice(1);tabs.forEach(function(t){if(h&&t.dataset.hash===h)show(t)})})();`;

// Filters the hub's cards. The filter lives in the hash (#tag=poster&q=cafe), so a link can open the hub already filtered.
const FILTER_JS = `(function(){var q=document.getElementById('q'),chips=[].slice.call(document.querySelectorAll('.chip')),cards=[].slice.call(document.querySelectorAll('.card')),empty=document.getElementById('empty'),tag='';
function mark(){chips.forEach(function(o){o.setAttribute('aria-pressed',String(o.dataset.tag===tag))})}
function apply(){var s=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){var ok=(!tag||c.dataset.tags.split('|').indexOf(tag)>=0)&&(!s||c.dataset.search.indexOf(s)>=0);c.hidden=!ok;if(ok)n++});empty.hidden=n>0;var h=new URLSearchParams();if(tag)h.set('tag',tag);if(q.value.trim())h.set('q',q.value.trim());var t=h.toString();history.replaceState(null,'',t?'#'+t:location.pathname)}
function read(){var h=new URLSearchParams(location.hash.slice(1)),t=h.get('tag')||'';tag=chips.some(function(c){return c.dataset.tag===t})?t:'';q.value=h.get('q')||'';mark();apply()}
q.addEventListener('input',apply);chips.forEach(function(ch){ch.addEventListener('click',function(){tag=ch.getAttribute('aria-pressed')==='true'?'':ch.dataset.tag;mark();apply()})});window.addEventListener('hashchange',read);if(location.hash.length>1)read()})();`;

function page(input: { title: string; body: string; depth: number; current?: 'design-systems' | 'examples'; script?: string; index: boolean; description: string }): string {
  const up = '../'.repeat(input.depth);
  const nav = (id: 'design-systems' | 'examples', label: string): string =>
    `<a href="${up}${id}/"${input.current === id ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${input.index ? '' : '<meta name="robots" content="noindex">\n'}<title>${esc(input.title)}</title>
<meta name="description" content="${esc(input.description)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header class="site"><a class="home" href="${up}">Open Design gallery</a><nav>${nav('design-systems', 'Design systems')}${nav('examples', 'Examples')}</nav></header>
${input.body}
<footer>Made with the <a href="https://github.com/${REPO}">Open Design Agent Kit</a>. Design systems and examples are synced from <a href="https://github.com/nexu-io/open-design">Open Design</a>.</footer>
</div>
${input.script ? `<script>${input.script}</script>` : ''}
</body>
</html>
`;
}

export function renderHub(input: { kind: 'design-systems' | 'examples'; title: string; lede: string; items: GalleryItem[]; index: boolean }): string {
  const allTags = [...new Set(input.items.flatMap((i) => i.tags))].sort();
  const cover = input.kind === 'design-systems';
  const cards = input.items
    .map((item) => {
      const size = cover ? COVER : THUMB;
      const bars = (item.swatches.length ? item.swatches : ['var(--chip)']).map((c) => `<span style="background:${esc(c)}"></span>`).join('');
      const visual = item.thumb
        ? `<img class="thumb" src="thumbs/${esc(item.thumb)}" alt="" loading="lazy" width="${size.out}" height="${Math.round(size.out * (size.height / size.width))}">${cover ? `<span class="bar" aria-hidden="true">${bars}</span>` : ''}`
        : `<span class="thumb swatches" aria-hidden="true">${bars}</span>`;
      const search = `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
      return `<li class="card${cover ? ' cover' : ''}" data-tags="${esc(item.tags.join('|'))}" data-search="${esc(search)}"><a href="${esc(item.slug)}/">${visual}<span class="title">${esc(item.title)}</span></a><ul class="tags">${item.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></li>`;
    })
    .join('\n');
  const body = `<h1>${esc(input.title)}</h1>
<p class="lede">${esc(input.lede)}</p>
<div class="filters" role="search"><input id="q" type="search" placeholder="Search" aria-label="Search ${esc(input.title.toLowerCase())}">${allTags.map((t) => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
<ul class="grid${cover ? ' covers' : ''}">
${cards}
</ul>
<p id="empty" class="empty" hidden>Nothing matches. Clear the search or the tag.</p>`;
  return page({ title: `${input.title} · Open Design gallery`, body, depth: 1, current: input.kind, script: FILTER_JS, index: input.index, description: input.lede });
}

/** The prompts a spoke offers, and a new-chat link that opens Claude with one filled in. */
export function claudeNewChatUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

export function designSystemPrompts(id: string, title: string): { githubFolder: string; kit: string; claudeDesign: string } {
  const githubFolder = `https://github.com/${REPO}/tree/main/claude-design-systems/${id}`;
  return {
    githubFolder,
    kit: `Use the Open Design design system "${id}" for my designs.`,
    claudeDesign: `Add the "${title}" design system to my Claude design systems. Its files, already in Claude's Design System format, are in ${githubFolder}/project. Build a Design System artifact from them.`,
  };
}

export function remixPrompt(id: string): string {
  return `Remix the Open Design example ${id}.`;
}

function promptBlock(id: string, text: string, label: string, newChat: boolean): string {
  return `<pre class="prompt" id="${esc(id)}">${esc(text)}</pre>
<div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" class="btn" data-copy="${esc(id)}">${esc(label)}</button>${newChat ? `<a class="btn secondary" href="${esc(claudeNewChatUrl(text))}" target="_blank" rel="noopener">Open in Claude</a>` : ''}</div>`;
}

export function renderDesignSystemSpoke(input: {
  item: GalleryItem;
  id: string;
  claudeFiles: string[];
  kitFiles: string[];
  /** Whether claude/view.html was written: the system as Claude Design shows it. */
  claudeView: boolean;
  index: boolean;
}): string {
  const { item, id } = input;
  const { githubFolder, kit: usePrompt, claudeDesign: claudePrompt } = designSystemPrompts(id, item.title);
  const fileList = (dir: string, files: string[]): string => `<ul class="files">${files.map((f) => `<li><a href="${dir}/${esc(f)}" download>${esc(f)}</a></li>`).join('')}</ul>`;
  const body = `<h1>${esc(item.title)}</h1>
<p class="lede">${esc(item.summary)}</p>
<ul class="tags" style="margin-bottom:20px">${item.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<div class="spoke">
<div>
${input.claudeView ? `<div class="tabs" role="tablist" aria-label="Which view"><button type="button" role="tab" class="tab" data-src="preview.html" data-hash="" aria-selected="true">Open Design</button><button type="button" role="tab" class="tab" data-src="claude/view.html" data-hash="claude" aria-selected="false">Claude Design</button></div>` : ''}
<div class="frame"><iframe id="view" src="preview.html" title="${esc(item.title)} preview" sandbox="allow-scripts" loading="lazy"></iframe></div>
</div>
<aside>
<section><h2>Use it with Open Design</h2><p>In a chat or editor where the Open Design Agent Kit is installed, paste this.</p>${promptBlock('p-use', usePrompt, 'Copy prompt', false)}</section>
<section><h2>Add it to Claude Design</h2><p>Claude builds the design system for you from its files.</p>${promptBlock('p-claude', claudePrompt, 'Copy prompt', true)}
<p class="note">Or in Claude's <b>Add design system</b>, pick the GitHub repo option with <code>${esc(REPO)}</code> and the folder <code>claude-design-systems/${esc(id)}</code>.</p></section>
${input.claudeFiles.length ? `<section><h2>Claude Design files</h2>${fileList('claude', input.claudeFiles)}<p class="note"><a href="${esc(githubFolder)}">The folder on GitHub</a></p></section>` : ''}
${input.kitFiles.length ? `<section><h2>Open Design files</h2>${fileList('kit', input.kitFiles)}</section>` : ''}
</aside>
</div>`;
  return page({ title: `${item.title} · Open Design gallery`, body, depth: 2, current: 'design-systems', script: COPY_JS + TABS_JS, index: input.index, description: item.summary });
}

export function renderExampleSpoke(input: { item: GalleryItem; id: string; examplePrompt?: string; sourcePath: string; hasPreview: boolean; index: boolean }): string {
  const { item, id } = input;
  const preview = input.hasPreview
    ? `<div class="frame"><iframe src="preview.html" title="${esc(item.title)} preview" sandbox="allow-scripts" loading="lazy"></iframe></div>`
    : `<div class="frame"><p class="empty" style="padding:24px">This example is too large to preview here. <a href="https://github.com/${REPO}/blob/main/${esc(input.sourcePath)}">See its source</a>.</p></div>`;
  const body = `<h1>${esc(item.title)}</h1>
<p class="lede">${esc(item.summary)}</p>
<ul class="tags" style="margin-bottom:20px">${item.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<div class="spoke">
${preview}
<aside>
<section><h2>Remix it with Open Design</h2><p>In a chat or editor where the Open Design Agent Kit is installed, paste this. Claude asks what to make, then starts from this example.</p>${promptBlock('p-remix', remixPrompt(id), 'Copy prompt', false)}</section>
${input.examplePrompt ? `<section><h2>Make one like it in Claude</h2><p>The brief this example was made from. Change the details to fit yours.</p>${promptBlock('p-brief', input.examplePrompt, 'Copy brief', true)}</section>` : ''}
<section><h2>Source</h2><p><a href="https://github.com/${REPO}/blob/main/${esc(input.sourcePath)}">example.html on GitHub</a></p></section>
</aside>
</div>`;
  return page({ title: `${item.title} · Open Design gallery`, body, depth: 2, current: 'examples', script: COPY_JS, index: input.index, description: item.summary });
}

function renderLanding(counts: { designSystems: number; examples: number }, index: boolean): string {
  const body = `<h1>Open Design gallery</h1>
<p class="lede">Design systems and finished examples you can use with the Open Design Agent Kit, or take into Claude Design. Open one to see it full size, copy a prompt, or download its files.</p>
<div class="big">
<a href="design-systems/"><strong>Design systems</strong><span>${counts.designSystems} systems: colors, type and spacing as tokens, ready for Open Design or Claude Design.</span></a>
<a href="examples/"><strong>Examples</strong><span>${counts.examples} finished designs to remix: posters, landing pages, decks and more.</span></a>
</div>
<p class="note" style="margin-top:24px">For agents: <a href="gallery.json">gallery.json</a> lists every item with its links, tags and prompts.</p>`;
  return page({ title: 'Open Design gallery', body, depth: 0, index, description: 'Design systems and remixable examples for the Open Design Agent Kit and Claude Design.' });
}

// ── gallery.json ──────────────────────────────────────────────────────────

export interface DesignSystemRecord {
  item: GalleryItem;
  id: string;
  claudeFiles: string[];
  kitFiles: string[];
  claudeView: boolean;
}

export interface ExampleRecord {
  item: GalleryItem;
  id: string;
  examplePrompt?: string;
  sourcePath: string;
  hasPreview: boolean;
}

/**
 * The machine-readable gallery: what an agent without the kit needs to search
 * it and link a person to the right page. Links are absolute when the site's
 * address is known (--base-url), otherwise relative to the site's root.
 */
export function buildGalleryIndex(input: { baseUrl?: string; designSystems: DesignSystemRecord[]; examples: ExampleRecord[]; generatedAt?: string }): Record<string, unknown> {
  const base = input.baseUrl ? (input.baseUrl.endsWith('/') ? input.baseUrl : `${input.baseUrl}/`) : undefined;
  const url = (rel: string): string => (base ? new URL(rel, base).href : rel);
  const tagsOf = (items: GalleryItem[]): string[] => [...new Set(items.flatMap((i) => i.tags))].sort();
  return {
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    site: base ?? null,
    repository: `https://github.com/${REPO}`,
    hubs: {
      designSystems: { url: url('design-systems/'), tags: tagsOf(input.designSystems.map((d) => d.item)) },
      examples: { url: url('examples/'), tags: tagsOf(input.examples.map((e) => e.item)) },
      filter: 'Append #tag=<tag>, #q=<words> or both (#tag=poster&q=cafe) to a hub URL to open it filtered.',
    },
    designSystems: input.designSystems.map((d) => {
      const dir = `design-systems/${d.id}/`;
      const prompts = designSystemPrompts(d.id, d.item.title);
      return {
        id: d.id,
        title: d.item.title,
        summary: d.item.summary,
        tags: d.item.tags,
        colors: d.item.swatches,
        url: url(dir),
        ...(d.claudeView ? { claudeDesignUrl: url(`${dir}#claude`) } : {}),
        thumbnail: d.item.thumb ? url(`design-systems/thumbs/${d.item.thumb}`) : null,
        files: {
          kit: d.kitFiles.map((f) => url(`${dir}kit/${f}`)),
          claudeDesign: d.claudeFiles.map((f) => url(`${dir}claude/${f}`)),
          claudeDesignFolder: prompts.githubFolder,
        },
        prompts: { kit: prompts.kit, claudeDesign: prompts.claudeDesign },
      };
    }),
    examples: input.examples.map((e) => {
      const dir = `examples/${e.item.slug}/`;
      return {
        id: e.id,
        slug: e.item.slug,
        title: e.item.title,
        summary: e.item.summary,
        tags: e.item.tags,
        url: url(dir),
        preview: e.hasPreview ? url(`${dir}preview.html`) : null,
        thumbnail: e.item.thumb ? url(`examples/thumbs/${e.item.thumb}`) : null,
        source: `https://github.com/${REPO}/blob/main/${e.sourcePath}`,
        prompts: { remix: remixPrompt(e.id), ...(e.examplePrompt ? { brief: e.examplePrompt } : {}) },
      };
    }),
  };
}

// ── The Claude Design view ────────────────────────────────────────────────

type TokenValue = string | Record<string, string>;
interface ClaudeToken { name: string; value: TokenValue; usage?: string }
interface ClaudeTokens {
  name?: string;
  color?: { themes?: Array<{ id: string; name: string }>; tokens?: ClaudeToken[] };
  type?: { families?: Record<string, string>; groups?: Array<{ name: string; family: string; styles: Array<{ name: string; fontSize: string; lineHeight?: number | string; letterSpacing?: string; usage?: string }> }> };
  spacing?: { tokens?: ClaudeToken[] };
  radius?: { tokens?: ClaudeToken[] };
  shadow?: { tokens?: ClaudeToken[] };
}

/** The handful of Markdown a design-system README uses: headings, lists, quotes, paragraphs, bold, italics and code. */
export function miniMarkdown(md: string): string {
  const inline = (t: string): string =>
    esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  const out: string[] = [];
  let list = false;
  let para: string[] = [];
  const flush = (): void => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const endList = (): void => {
    if (list) out.push('</ul>');
    list = false;
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flush();
      endList();
    } else if (h) {
      flush();
      endList();
      const level = Math.min(h[1].length + 1, 4);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (li) {
      flush();
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line.startsWith('>')) {
      flush();
      endList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else para.push(line.trim());
  }
  flush();
  endList();
  return out.join('\n');
}

function tokenRows(tokens: ClaudeToken[] | undefined, themes: string[], cell: (value: string) => string): string {
  if (!tokens?.length) return '';
  return tokens
    .map((t) => {
      const values = typeof t.value === 'string' ? [t.value] : themes.map((id) => (t.value as Record<string, string>)[id] ?? '');
      return `<tr><td><code>${esc(t.name)}</code></td>${values.map((v) => `<td>${cell(v)}</td>`).join('')}<td>${esc(t.usage ?? '')}</td></tr>`;
    })
    .join('');
}

/** The system as Claude Design presents it: its cover, its tokens by family and its README, all from the Claude-format files. */
export function renderClaudeView(input: { tokens: ClaudeTokens; readme: string; hasCover: boolean }): string {
  const { tokens } = input;
  const themes = tokens.color?.themes?.map((t) => t.id) ?? ['light'];
  const themeNames = tokens.color?.themes?.map((t) => t.name) ?? ['Value'];
  const swatch = (v: string): string => (v ? `<span class="sw" style="background:${esc(v)}"></span><code>${esc(v)}</code>` : '');
  const plain = (v: string): string => `<code>${esc(v)}</code>`;
  const table = (title: string, head: string[], rows: string): string =>
    rows ? `<section><h2>${title}</h2><div class="scroll"><table><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>` : '';
  const families = tokens.type?.families ?? {};
  const typeRows = (tokens.type?.groups ?? [])
    .flatMap((g) =>
      g.styles.map(
        (st) =>
          `<tr><td><code>${esc(st.name)}</code></td><td><span style="font-family:${esc(families[g.family] ?? 'inherit')};font-size:min(${esc(st.fontSize)},40px);line-height:1.1">Aa ${esc(g.name)}</span></td><td><code>${esc(st.fontSize)}${st.lineHeight !== undefined ? ` / ${esc(String(st.lineHeight))}` : ''}</code></td><td>${esc(st.usage ?? '')}</td></tr>`,
      ),
    )
    .join('');
  const familyRows = Object.entries(families).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td style="font-family:${esc(v)}">${esc(v)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tokens.name ?? 'Design system')} in Claude Design</title>
<style>
body{margin:0;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2a2a;background:#fff}
main{padding:20px 24px 40px;display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
@media (max-width:520px){main{padding:16px}}
.note{margin:0;font-size:13px;color:#6b6b6b}
.cover{border:1px solid #e3e3e3;border-radius:10px;overflow:hidden;aspect-ratio:10/3;position:relative}
.cover iframe{position:absolute;left:0;top:0;width:960px;height:288px;border:0;transform-origin:0 0}
h2{font-size:16px;margin:0 0 10px}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;vertical-align:middle;padding:7px 10px;border-bottom:1px solid #eee}
th{font-weight:600;color:#6b6b6b;font-size:12px}
code{font:12px ui-monospace,Menlo,Consolas,monospace}
.sw{display:inline-block;width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,.12);vertical-align:middle;margin-right:8px}
.readme{max-width:72ch}
.readme h2,.readme h3,.readme h4{margin:1.4em 0 .4em}
.readme blockquote{margin:0 0 1em;padding-left:12px;border-left:3px solid #ddd;color:#555}
</style>
</head>
<body>
<main>
<p class="note">What Claude Design shows for this system, built from its Claude Design files: the cover, the tokens by family and the README.</p>
${input.hasCover ? '<div class="cover"><iframe src="cover.html" title="Cover" scrolling="no"></iframe></div>' : ''}
${table('Color', ['Token', ...themeNames, 'Usage'], tokenRows(tokens.color?.tokens, themes, swatch))}
${table('Type families', ['Family', 'Stack'], familyRows)}
${table('Type scale', ['Style', 'Sample', 'Size / line height', 'Usage'], typeRows)}
${table('Spacing', ['Token', 'Value', 'Usage'], tokenRows(tokens.spacing?.tokens, ['value'], plain))}
${table('Radius', ['Token', 'Value', 'Usage'], tokenRows(tokens.radius?.tokens, ['value'], plain))}
${table('Shadow', ['Token', 'Value', 'Usage'], tokenRows(tokens.shadow?.tokens, ['value'], plain))}
${input.readme ? `<section class="readme"><h2>README</h2>${miniMarkdown(input.readme)}</section>` : ''}
</main>
${input.hasCover ? `<script>(function(){var c=document.querySelector('.cover'),f=c.querySelector('iframe');function fit(){f.style.transform='scale('+c.clientWidth/960+')'}fit();addEventListener('resize',fit)})();</script>` : ''}
</body>
</html>
`;
}

/** Writes claude/view.html (and claude/cover.html with the tokens inlined); false when the system has no Claude-format files. */
async function writeClaudeView(from: string, to: string, tokensCss: string | undefined): Promise<boolean> {
  let tokens: ClaudeTokens;
  try {
    tokens = JSON.parse(await fs.readFile(path.join(from, 'tokens.json'), 'utf8')) as ClaudeTokens;
  } catch {
    return false;
  }
  const readme = await fs.readFile(path.join(from, 'README.md'), 'utf8').catch(() => '');
  const cover = await fs.readFile(path.join(from, 'components/Cover/preview.html'), 'utf8').catch(() => undefined);
  const hasCover = cover !== undefined && tokensCss !== undefined;
  if (hasCover) await fs.writeFile(path.join(to, 'cover.html'), withTokens(cover, tokensCss));
  await fs.writeFile(path.join(to, 'view.html'), renderClaudeView({ tokens, readme, hasCover }));
  return true;
}

// ── Content ───────────────────────────────────────────────────────────────

function oneLine(text: string, max = 220): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** The example's folder name, unique across examples: examples/<slug>/example.html. */
export function exampleSlug(exampleArtifactPath: string): string {
  return path.posix.basename(path.posix.dirname(exampleArtifactPath));
}

/** Readable tags for an example: its mode, and its category with dashes as spaces. */
export function exampleTags(s: Pick<SkillSummary, 'mode' | 'category'>): string[] {
  const tags = [s.mode === 'prototype' ? 'page' : s.mode];
  if (s.category && s.category !== s.mode) tags.push(s.category.replace(/-/g, ' '));
  return [...new Set(tags)];
}

export function designSystemTags(detail: Pick<DesignSystemDetail, 'category'>, descriptor: Descriptor | undefined): string[] {
  const tags = [...(descriptor?.moods ?? []).slice(0, 3), ...(descriptor?.industries ?? []).slice(0, 2)];
  if (!tags.length && detail.category) tags.push(detail.category.toLowerCase());
  return [...new Set(tags)];
}

/** The tokens as the kit applies them: the bundled tokens.css plus the local override. */
function kitTokensCss(detail: DesignSystemDetail): string | undefined {
  if (detail.tokensCss === undefined) return undefined;
  return detail.tokensOverrideCss ? `${detail.tokensCss}\n${detail.tokensOverrideCss}` : detail.tokensCss;
}

/** The cover reads the system's CSS variables, which Claude's page supplies; standalone it needs them inlined. */
export function withTokens(html: string, tokensCss: string): string {
  const style = `<style>${tokensCss.replace(/<\/style/gi, '<\\/style')}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : `${style}${html}`;
}

/** Packaged systems carry a boilerplate summary; their DESIGN.md's blockquote says what they are. */
export function designSystemSummary(summary: string, designMd: string): string {
  if (!/^Bundled OpenDesign package\b/i.test(summary)) return summary;
  const lines = designMd.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith('#'));
  const quote: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t && !quote.length) continue;
    if (!t.startsWith('>')) break;
    const line = t.replace(/^>\s?/, '').trim();
    if (!/^category\s*:/i.test(line)) quote.push(line);
  }
  return oneLine(quote.join(' ')) || summary;
}

/** Upstream examples without a display name are named by their folder: "magazine-poster" reads as "Magazine poster". */
export function exampleTitle(name: string, slug: string): string {
  if (name !== slug) return name;
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(p, base)));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

async function copyFiles(from: string, to: string, files: string[]): Promise<void> {
  for (const f of files) {
    await fs.mkdir(path.dirname(path.join(to, f)), { recursive: true });
    await fs.copyFile(path.join(from, f), path.join(to, f));
  }
}

// ── Thumbnails ────────────────────────────────────────────────────────────

type Shooter = { shoot(html: string, file: string, size?: { width: number; height: number; out: number }): Promise<boolean>; close(): Promise<void> };

async function startShooter(log: (m: string) => void): Promise<Shooter | undefined> {
  const found = await findBrowser();
  if (!found.ok) {
    log(`No browser for thumbnails (${found.message}); cards fall back to color swatches.`);
    return undefined;
  }
  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: found.executablePath, headless: true, args: ['--hide-scrollbars'] });
  return {
    async shoot(html, file, size = THUMB) {
      const tab = await browser.newPage();
      try {
        await tab.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
        // 'load' waits for fonts and images in the page; a stalled remote asset only delays the shot.
        await tab.setContent(html, { waitUntil: 'load', timeout: 20_000 }).catch(() => undefined);
        await tab.evaluate(() => document.fonts.ready).catch(() => undefined);
        await new Promise((r) => setTimeout(r, 400));
        // A fixed clip, so the shot is exactly the viewport whatever the browser's window does.
        const png = await tab.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size.width, height: size.height } });
        await fs.mkdir(path.dirname(file), { recursive: true });
        await sharp(png).resize(size.out, Math.round(size.out * (size.height / size.width)), { fit: 'cover', position: 'top' }).webp({ quality: 78 }).toFile(file);
        return true;
      } catch (err) {
        log(`Thumbnail failed for ${path.basename(file)}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      } finally {
        await tab.close().catch(() => undefined);
      }
    },
    close: () => browser.close(),
  };
}

// ── Build ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const log = (m: string): void => console.log(m);
  const index = new ContentIndex(ASSETS);
  const pilot = JSON.parse(await fs.readFile(PILOT, 'utf8')) as { designSystems: string[]; examples: string[] };
  const descriptors = (JSON.parse(await fs.readFile(DESCRIPTORS, 'utf8')) as { systems: Record<string, Descriptor> }).systems;

  const dsIds = opts.all ? (await index.listDesignSystems()).filter((s) => s.source === 'built-in').map((s) => s.id).sort() : pilot.designSystems;
  const remixable = await index.listSkills(undefined, undefined, undefined, true);
  const examples = opts.all ? remixable.filter((s) => s.exampleArtifactPath) : pilot.examples.map((id) => remixable.find((s) => s.id === id)).filter((s): s is SkillSummary => !!s);
  const missing = opts.all ? [] : pilot.examples.filter((id) => !remixable.some((s) => s.id === id));
  if (missing.length) throw new Error(`gallery/pilot.json names examples that aren't remixable: ${missing.join(', ')}`);

  await fs.rm(opts.out, { recursive: true, force: true });
  const shooter = opts.thumbs ? await startShooter(log) : undefined;
  try {
    // Design systems
    const dsItems: GalleryItem[] = [];
    const dsRecords: DesignSystemRecord[] = [];
    for (const id of dsIds) {
      const detail = await index.getDesignSystem(id);
      if (!detail) throw new Error(`No bundled design system "${id}".`);
      const tile = designSystemTile(detail, undefined);
      const item: GalleryItem = { slug: id, title: detail.name, summary: designSystemSummary(tile.summary, detail.body), tags: designSystemTags(detail, descriptors[id]), swatches: tile.swatches };
      const dir = path.join(opts.out, 'design-systems', id);
      await fs.mkdir(dir, { recursive: true });
      const preview = await buildDesignSystemPreview(index, id);
      if (!preview.ok) throw new Error(preview.message);
      await fs.writeFile(path.join(dir, 'preview.html'), preview.preview.html);
      const claudeFrom = path.join(CLAUDE_DS, id, 'project');
      const claudeFiles = await listFiles(claudeFrom);
      await copyFiles(claudeFrom, path.join(dir, 'claude'), claudeFiles);
      const claudeView = await writeClaudeView(claudeFrom, path.join(dir, 'claude'), kitTokensCss(detail));
      const kitFiles: string[] = [];
      await fs.mkdir(path.join(dir, 'kit'), { recursive: true });
      await fs.writeFile(path.join(dir, 'kit', 'DESIGN.md'), detail.body);
      kitFiles.push('DESIGN.md');
      if (detail.tokensCss !== undefined) {
        await fs.writeFile(path.join(dir, 'kit', 'tokens.css'), kitTokensCss(detail)!);
        kitFiles.push('tokens.css');
      }
      const thumbFile = path.join(opts.out, 'design-systems', 'thumbs', `${id}.webp`);
      const coverHtml = claudeFiles.includes('components/Cover/preview.html') ? await fs.readFile(path.join(claudeFrom, 'components/Cover/preview.html'), 'utf8') : undefined;
      const shot = coverHtml && detail.tokensCss !== undefined ? withTokens(coverHtml, kitTokensCss(detail)!) : undefined;
      if (shooter && shot && (await shooter.shoot(shot, thumbFile, COVER))) item.thumb = `${id}.webp`;
      const record: DesignSystemRecord = { item, id, claudeFiles, kitFiles, claudeView };
      await fs.writeFile(path.join(dir, 'index.html'), renderDesignSystemSpoke({ ...record, index: opts.index }));
      dsItems.push(item);
      dsRecords.push(record);
    }
    await fs.writeFile(
      path.join(opts.out, 'design-systems', 'index.html'),
      renderHub({ kind: 'design-systems', title: 'Design systems', lede: 'Each one sets colors, type and spacing as tokens. Open one to see it, then use it with Open Design or add it to Claude Design.', items: dsItems, index: opts.index }),
    );
    log(`Design systems: ${dsItems.length} (${dsItems.filter((i) => i.thumb).length} thumbnails)`);

    // Examples
    const exItems: GalleryItem[] = [];
    const exRecords: ExampleRecord[] = [];
    for (const s of examples) {
      const rel = s.exampleArtifactPath!;
      const slug = exampleSlug(rel);
      const item: GalleryItem = { slug, title: exampleTitle(s.name, slug), summary: oneLine(s.description), tags: exampleTags(s), swatches: [] };
      const dir = path.join(opts.out, 'examples', slug);
      await fs.mkdir(dir, { recursive: true });
      const built = await buildExamplePreview(index, ASSETS, s.id);
      const html = built.ok ? built.preview.html : undefined;
      if (html) await fs.writeFile(path.join(dir, 'preview.html'), html);
      if (html && shooter && (await shooter.shoot(html, path.join(opts.out, 'examples', 'thumbs', `${slug}.webp`)))) item.thumb = `${slug}.webp`;
      const sourcePath = path.relative(ROOT, path.join(ASSETS, rel)).split(path.sep).join('/');
      const record: ExampleRecord = { item, id: s.id, examplePrompt: s.examplePrompt?.trim() || undefined, sourcePath, hasPreview: !!html };
      await fs.writeFile(path.join(dir, 'index.html'), renderExampleSpoke({ ...record, index: opts.index }));
      exItems.push(item);
      exRecords.push(record);
    }
    await fs.writeFile(
      path.join(opts.out, 'examples', 'index.html'),
      renderHub({ kind: 'examples', title: 'Examples', lede: 'Finished designs made with Open Design. Open one to see it full size, then remix it with the kit or take its brief into Claude.', items: exItems, index: opts.index }),
    );
    log(`Examples: ${exItems.length} (${exItems.filter((i) => i.thumb).length} thumbnails)`);

    await fs.writeFile(path.join(opts.out, 'gallery.json'), `${JSON.stringify(buildGalleryIndex({ baseUrl: opts.baseUrl, designSystems: dsRecords, examples: exRecords }), null, 2)}\n`);
    await fs.writeFile(path.join(opts.out, 'index.html'), renderLanding({ designSystems: dsItems.length, examples: exItems.length }, opts.index));
    // GitHub Pages: serve files as they are, no Jekyll.
    await fs.writeFile(path.join(opts.out, '.nojekyll'), '');
    log(`Wrote ${path.relative(ROOT, opts.out) || opts.out}`);
  } finally {
    await shooter?.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
