// Layout the preview MCP App adds to the shared preview chrome (chromeCss.ts):
// a fixed-height stage inline, the full window in fullscreen, the export
// buttons, the fallback screenshot, and the exploration grid.
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
`;
