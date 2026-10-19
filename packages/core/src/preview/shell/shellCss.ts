// Layout the browser preview shell adds to the shared preview chrome
// (chromeCss.ts): the full-window frame, the artifact picker, the Checks
// panel, the live-reload status and the toast.
export const SHELL_CSS = `
  html, body { height: 100%; }
  body { overflow: hidden; }
  #root { height: 100%; }
  .od-toolbar .od-title { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: var(--od-text-strong); }
  .od-toolbar .od-path { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 11px; font-weight: 500; color: var(--od-text-soft); }
  .od-live { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; color: var(--od-text-soft); }
  .od-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--od-green); }
  .od-live.off::before { background: var(--od-text-faint); }
  #od-checks-toggle.active { background: var(--od-bg-subtle); border-color: var(--od-border-strong); }
  .od-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--od-pin); }
  .od-dot[hidden] { display: none; }
  @container (max-width: 640px) { .od-toolbar .od-path, .od-live span { display: none; } }

  .od-toast {
    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 20; max-width: calc(100% - 32px);
    padding: 10px 14px; border-radius: var(--od-radius-md); background: var(--od-accent-fill); color: var(--od-accent-contrast);
    font-size: 13px; box-shadow: var(--od-shadow-md);
  }
  .od-toast[hidden] { display: none; }

  .od-picker { height: 100%; overflow: auto; padding: 32px 16px; }
  .od-picker-inner { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .od-picker h1 { margin: 0; font-size: 20px; color: var(--od-text-strong); }
  .od-picker p { margin: 0; font-weight: 500; color: var(--od-text-muted); }
  .od-picker-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .od-picker-list a {
    display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--od-border-soft);
    border-radius: var(--od-radius-md); color: var(--od-text-strong); text-decoration: none;
  }
  .od-picker-list a:hover { background: var(--od-bg-subtle); }
  .od-picker-list small { font-size: 11px; font-weight: 500; color: var(--od-text-soft); word-break: break-all; }

  .od-checks { top: 12px; bottom: 12px; right: 12px; width: min(760px, calc(100% - 24px)); max-height: none; }
  .od-checks .od-panel-body { gap: 12px; }
  .od-check-runs { display: flex; flex-wrap: wrap; gap: 6px; }
  .od-check-run { height: 28px; padding: 0 10px; font-size: 12px; }
  .od-check-run.active { background: var(--od-bg-subtle); border-color: var(--od-border-strong); }
  .od-check-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .od-check-pair { grid-template-columns: 1fr; } }
  .od-check-pair figure { margin: 0; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .od-check-pair figcaption { font-size: 11px; color: var(--od-text-muted); }
  .od-check-pair img { width: 100%; height: auto; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-sm); background: #fff; }
  .od-check-empty { font-size: 12px; font-weight: 500; color: var(--od-text-soft); border: 1px dashed var(--od-border); border-radius: var(--od-radius-sm); padding: 16px; text-align: center; }
  .od-check-label { font-size: 12px; color: var(--od-text-strong); margin-top: 6px; }
  .od-check-summary { font-size: 12px; font-weight: 500; color: var(--od-text-muted); margin: 0; }
  .od-comment-crop { max-width: 100%; border: 1px solid var(--od-border-soft); border-radius: var(--od-radius-sm); margin-top: 8px; }
  .od-copy-text { width: 100%; min-height: 84px; }
`;
