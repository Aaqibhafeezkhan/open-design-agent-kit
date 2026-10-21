// Layout the preview MCP App adds to the shared preview chrome (chromeCss.ts):
// a fixed-height stage inline, the full window in fullscreen, the export
// buttons, the fallback screenshot, the exploration grid, and the pickers
// (openspec add-mcp-app-pickers): example cards, design-system tiles and the
// campaign sheet. Colors come from the --od-* tokens, so the host's light or
// dark theme carries through; only design previews keep a white ground.
export const MCP_APP_CSS = `
  html, body { margin: 0; background: var(--od-bg); }
  body { overflow: hidden; }
  #root { height: 600px; }
  body.od-fullscreen #root { height: 100vh; }
  .od-stage { position: relative; flex: 1; min-height: 0; }
  .od-preview { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
  .od-toolbar .od-title { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: var(--od-text-strong); }
  .od-export-group { display: flex; align-items: center; gap: 4px; padding-left: 8px; border-left: 1px solid var(--od-border-soft); }
  @container (max-width: 640px) { .od-export-group .od-label, #od-apply .od-label { display: none; } }

  .od-toast {
    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 20; max-width: calc(100% - 32px);
    padding: 10px 14px; border-radius: var(--od-radius-md); background: var(--od-accent-fill); color: var(--od-accent-contrast);
    font-size: 13px; box-shadow: var(--od-shadow-md);
  }
  .od-toast[hidden] { display: none; }

  .od-message { padding: 24px 16px; font-size: 13px; color: var(--od-text-muted); }
  .od-fallback { height: 100%; overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .od-fallback p { margin: 0; font-size: 12px; font-weight: 500; color: var(--od-text-muted); }
  .od-fallback figure { margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .od-fallback figcaption { font-size: 11px; color: var(--od-text-soft); }
  .od-fallback img { max-width: 100%; height: auto; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-sm); background: #fff; }

  .od-directions { height: 100%; overflow: auto; padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; align-content: start; }
  .od-direction { display: flex; flex-direction: column; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-md); overflow: hidden; background: var(--od-bg); }
  .od-direction.chosen { border-color: var(--od-accent-fill); box-shadow: 0 0 0 1px var(--od-accent-fill); }
  .od-direction-frame { position: relative; height: 320px; overflow: hidden; background: #fff; border-bottom: 1px solid var(--od-border-soft); }
  .od-direction-frame iframe { position: absolute; left: 0; top: 0; width: 1280px; height: 1280px; border: 0; transform-origin: 0 0; pointer-events: none; }
  .od-direction-frame img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .od-direction-frame .od-message { padding: 16px; }
  .od-direction-body { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; }
  .od-direction-body h2 { margin: 0; font-size: 13px; color: var(--od-text-strong); }
  .od-direction-body p { margin: 0; font-size: 12px; font-weight: 500; color: var(--od-text-muted); }
  .od-direction-body .od-btn { align-self: flex-start; height: 28px; font-size: 12px; }
  .od-card-actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .od-card-actions .od-btn { height: 28px; font-size: 12px; }

  .od-scroll { overflow: auto; height: 100%; }
  .od-stage.od-scroll { height: auto; }
  .od-toolbar-note { font-size: 12px; color: var(--od-text-muted); font-variant-numeric: tabular-nums; }
  .od-card-meta { font-size: 11px; color: var(--od-text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .od-badge { display: inline-block; padding: 1px 6px; border-radius: var(--od-radius-pill); background: var(--od-accent-fill); color: var(--od-accent-contrast); font-size: 10px; font-weight: 600; vertical-align: middle; }

  .od-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 12px 0; }
  .od-chip { height: 26px; padding: 0 10px; border: 1px solid var(--od-border); border-radius: var(--od-radius-pill); background: var(--od-bg); color: var(--od-text); font: inherit; font-size: 12px; cursor: pointer; }
  .od-chip:hover { border-color: var(--od-border-strong); }
  .od-chip.active { background: var(--od-accent-fill); border-color: var(--od-accent-fill); color: var(--od-accent-contrast); }

  .od-cards { padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .od-card { display: flex; flex-direction: column; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-md); overflow: hidden; background: var(--od-bg); }
  .od-card-frame { position: relative; height: 180px; overflow: hidden; background: #fff; border-bottom: 1px solid var(--od-border-soft); }
  .od-card-frame iframe, .od-ds-frame iframe { position: absolute; left: 0; top: 0; width: 1280px; height: 1280px; border: 0; transform-origin: 0 0; pointer-events: none; }
  .od-card-frame .od-message { padding: 16px; color: #6b6b6b; }
  .od-card-body { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; flex: 1; }
  .od-card-body h2 { margin: 0; font-size: 13px; color: var(--od-text-strong); }
  .od-card-body p { margin: 0 0 4px; font-size: 12px; color: var(--od-text-muted); flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .od-card-body .od-btn { align-self: flex-start; height: 28px; font-size: 12px; }
  .od-more { display: flex; justify-content: center; padding: 0 12px 16px; }

  .od-ds-tiles { padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .od-ds-tile { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0 0 10px; text-align: left; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-md); overflow: hidden; background: var(--od-bg); color: var(--od-text); font: inherit; cursor: pointer; }
  .od-ds-tile:hover { border-color: var(--od-border-strong); }
  .od-ds-tile.active { border-color: var(--od-accent-fill); box-shadow: 0 0 0 1px var(--od-accent-fill); }
  .od-ds-tile > :not(.od-swatches) { padding: 0 10px; }
  .od-swatches { display: flex; height: 44px; margin-bottom: 4px; border-bottom: 1px solid var(--od-border-soft); }
  .od-swatches span { flex: 1; }
  .od-swatches span + span { box-shadow: inset 1px 0 0 color-mix(in srgb, var(--od-text) 12%, transparent); }
  .od-ds-name { font-size: 13px; font-weight: 600; color: var(--od-text-strong); }
  .od-ds-fonts { font-size: 11px; color: var(--od-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .od-ds-detail { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; background: var(--od-bg); }
  .od-ds-detail[hidden] { display: none; }
  .od-ds-detail-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--od-border-soft); }
  .od-ds-detail-bar .od-title { font-size: 13px; color: var(--od-text-strong); }
  .od-ds-detail-bar .od-btn { height: 28px; font-size: 12px; }
  .od-ds-frame { position: relative; flex: 1; min-height: 0; overflow: hidden; background: #fff; }

  .od-campaign-sheet { display: block; max-width: calc(100% - 24px); margin: 12px; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-sm); }
  .od-campaign-tiles { padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; align-items: start; }
  .od-campaign-tile { margin: 0; display: flex; flex-direction: column; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-md); overflow: hidden; background: var(--od-bg); }
  .od-campaign-tile.bad { border-color: color-mix(in srgb, var(--od-red) 60%, transparent); }
  .od-campaign-image { display: flex; align-items: center; justify-content: center; height: 180px; padding: 8px; background: var(--od-bg-muted); border-bottom: 1px solid var(--od-border-soft); }
  .od-campaign-image[role="button"] { cursor: pointer; }
  .od-campaign-image img { max-width: 100%; max-height: 100%; box-shadow: var(--od-shadow-sm); }
  .od-campaign-tile figcaption { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
  .od-tile-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--od-text-strong); }
  .od-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .od-dot.ok { background: var(--od-green); }
  .od-dot.bad { background: var(--od-red); }
  .od-tile-errors { margin: 0; padding-left: 16px; font-size: 12px; color: var(--od-text-muted); }
  .od-tile-errors code { color: var(--od-red); }
`;
