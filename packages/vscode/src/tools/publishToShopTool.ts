import * as vscode from 'vscode';
import { publishToShop, type Shop } from '@feimacode/open-design-agent-kit-core';
import { getOutputDirectory, getWorkspaceRoot } from '../workspace/artifactWriter';

interface PublishToShopInput {
  entryPaths: string[];
  shop: Shop;
  data?: string;
  nameField?: string;
  folder?: boolean;
}

// Shopify's connector route, or an upload-ready folder (openspec add-shop-handoff). Never contacts the shop.
export class PublishToShopTool implements vscode.LanguageModelTool<PublishToShopInput> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<PublishToShopInput>,
  ): Promise<vscode.PreparedToolInvocation> {
    const writes = options.input.folder || options.input.shop !== 'shopify';
    return { invocationMessage: writes ? `Preparing a ${options.input.shop} upload folder` : 'Preparing the designs for Shopify' };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<PublishToShopInput>): Promise<vscode.LanguageModelToolResult> {
    const browserPath = vscode.workspace.getConfiguration('openDesign').get<string>('export.browserPath', '') || undefined;
    const text = await publishToShop({ ...options.input, workspaceRoot: getWorkspaceRoot(), exportOptions: { outputDir: getOutputDirectory(), browserPath } });
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
  }
}
