import * as vscode from 'vscode';
import { getArtifact, getOutputDirectory, getWorkspaceRoot } from '../workspace/artifactWriter';
import { findStaleSources, readUnaddressedComments, recordedSources } from '@feimacode/open-design-agent-kit-core';

interface GetArtifactInput {
  entryPath: string;
}

export class GetArtifactTool implements vscode.LanguageModelTool<GetArtifactInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetArtifactInput>,
  ): Promise<vscode.LanguageModelToolResult> {
    const { entryPath } = options.input;
    const result = await getArtifact(entryPath);
    if (!result) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`No artifact found at ${entryPath}. It may not have been written yet.`),
      ]);
    }
    // Open and sent comments, with up to 4 crops (comments made in the browser preview have them).
    const { comments: openComments, crops } = await readUnaddressedComments(getWorkspaceRoot(), entryPath);
    const recorded = recordedSources(result.manifest);
    const payload = {
      manifest: result.manifest,
      supportingFiles: result.supportingFiles,
      entryContent: result.entryContent,
      openComments,
      commentScreenshotsAttached: crops.length > 0 ? crops.map((c) => c.commentId) : undefined,
      staleSources: recorded.length > 0 ? await findStaleSources(getWorkspaceRoot(), getOutputDirectory(), recorded) : undefined,
    };
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(payload, null, 2)),
      ...crops.map((c) => vscode.LanguageModelDataPart.image(c.png, 'image/png')),
    ]);
  }
}
