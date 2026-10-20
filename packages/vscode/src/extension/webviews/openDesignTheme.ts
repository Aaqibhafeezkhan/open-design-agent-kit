import * as vscode from 'vscode';

/**
 * A from-scratch reproduction (not a literal copy-paste — the values are
 * hand-transcribed from open-design's own token files) of open-design's
 * actual visual design language, for the extension's webviews to share.
 * Source (read directly, not guessed): apps/web/src/styles/tokens.css,
 * base.css, primitives.css, viewer/core.css, viewer/memory.css,
 * home/plugin-marketplace-demo.css. See openspec/changes/archive/
 * 2026-09-19-open-design-visual-language/design.md for the full mapping
 * and what was deliberately simplified (no icon system, single shadow set
 * shared across light/dark rather than open-design's fully separate ones).
 *
 * VS Code adds `vscode-dark`/`vscode-light`/`vscode-high-contrast` classes
 * to every webview's <body> automatically — used here to switch between
 * open-design's own light/dark token sets (not whatever arbitrary colors
 * the user's current VS Code theme happens to have), so the extension's
 * views look like Open Design regardless of the ambient editor theme.
 */

export function odFontFaceCss(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const fontUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'fonts', 'AlbertSans-VariableFont_wght.ttf'));
  return `
@font-face {
  font-family: 'Albert Sans';
  src: url('${fontUri}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}`;
}

// The tokens themselves live in core, shared with the browser preview (openspec add-browser-preview).
export { OD_TOKENS_CSS } from '@feimacode/open-design-agent-kit-core/src/preview/theme';

