import * as vscode from 'vscode';
import type { ILogService } from '../log/logService';

interface Pick<T> extends vscode.QuickPickItem {
  value: T;
}

// Asks the three questions the open-design-design-system-from-url prompt
// would otherwise ask, then hands over to chat, where the model measures the
// site with extract_open_design_design_system, writes DESIGN.md and
// tokens.css from the draft and shows the side-by-side review.
export function registerDesignSystemFromWebsiteCommand(context: vscode.ExtensionContext, log: ILogService): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openDesign.designSystemFromWebsite', async () => {
      log.info('Command: openDesign.designSystemFromWebsite');
      const url = await vscode.window.showInputBox({
        title: 'Design System from Website — Address',
        prompt: 'The page to measure, usually the home page',
        placeHolder: 'https://example.com',
        validateInput: (v) => {
          try {
            const u = new URL(v.trim());
            return u.protocol === 'http:' || u.protocol === 'https:' ? undefined : 'Use an http or https address.';
          } catch {
            return 'Enter a full address, e.g. https://example.com';
          }
        },
      });
      if (!url) return;
      const theme = await vscode.window.showQuickPick<Pick<string>>(
        [
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark', description: 'only if the site has a dark theme' },
          { label: 'Both', value: 'both', description: 'light, plus dark if the site has one' },
        ],
        { title: 'Design System from Website — Theme' },
      );
      if (!theme) return;
      const owner = await vscode.window.showQuickPick<Pick<string>>(
        [
          { label: 'Our own brand', value: "it's our own brand", description: 'copies the logo into the design system' },
          { label: 'A reference site', value: "it's a reference, not our brand", description: 'named "…-inspired", no logos copied' },
        ],
        { title: 'Design System from Website — Whose site is it?' },
      );
      if (!owner) return;
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: `/open-design-design-system-from-url ${url.trim()}, ${theme.value} theme, ${owner.value}`,
        isPartialQuery: true,
      });
    }),
  );
}
