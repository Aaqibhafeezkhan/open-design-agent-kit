// The browser preview's HTML page: Open Design's tokens and the preview
// chrome shared with VS Code, the shell's own layout, and shell.js.
import { PREVIEW_CHROME_CSS } from '../chromeCss';
import { SHELL_CSS } from '../shell/shellCss';
import { OD_TOKENS_CSS } from '../theme';

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderShellPage(config: { entryPath?: string; designOrigin: string }): string {
  // Read by shell/main.ts; JSON in a data attribute, so no inline script is needed under the CSP.
  const json = JSON.stringify({ entryPath: config.entryPath ?? null, designOrigin: config.designOrigin });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Open Design preview</title>
<style>
${OD_TOKENS_CSS}
${PREVIEW_CHROME_CSS}
${SHELL_CSS}
</style>
</head>
<body>
<div id="root" data-od-config="${escapeAttr(json)}"></div>
<script src="shell.js"></script>
</body>
</html>`;
}
