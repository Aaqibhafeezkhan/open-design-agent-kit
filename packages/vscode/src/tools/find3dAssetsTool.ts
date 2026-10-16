import * as vscode from 'vscode';
import { find3dAssets, formatFound3dAssets, type Find3dAssetsInput } from '@feimacode/open-design-agent-kit-core';

// Poly Haven search for 3D designs (openspec add-3d-scene, "3d-asset-sources"):
// returns CC0 file URLs as text; writes nothing.
export class Find3dAssetsTool implements vscode.LanguageModelTool<Find3dAssetsInput> {
  async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<Find3dAssetsInput>): Promise<vscode.PreparedToolInvocation> {
    return { invocationMessage: `Searching Poly Haven for ${options.input.type}s: "${options.input.query}"` };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<Find3dAssetsInput>): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(formatFound3dAssets(await find3dAssets(options.input)))]);
  }
}
