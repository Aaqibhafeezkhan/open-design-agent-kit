import * as vscode from 'vscode';
import * as path from 'node:path';
import { getArtifact, getOutputDirectory, getWorkspaceRoot } from '../workspace/artifactWriter';
import { buildCritiqueInput, findStaleSources, readCheckRunImage, readUnaddressedComments, recordedSources, type ContentIndex, type JsonRecord } from '@feimacode/open-design-agent-kit-core';

interface GetArtifactInput {
  entryPath: string;
  critique?: boolean;
}

export class GetArtifactTool implements vscode.LanguageModelTool<GetArtifactInput> {
  constructor(private readonly contentIndex: ContentIndex) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetArtifactInput>,
  ): Promise<vscode.LanguageModelToolResult> {
    const { entryPath, critique } = options.input;
    const result = await getArtifact(entryPath);
    if (!result) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`No artifact found at ${entryPath}. It may not have been written yet.`),
      ]);
    }
    if (critique) return this.critiqueInput(entryPath, result.manifest);
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

  /** What the design critic judges, with the latest check run's screenshots attached (openspec add-design-critic). */
  private async critiqueInput(entryPath: string, manifest: JsonRecord | null): Promise<vscode.LanguageModelToolResult> {
    const designSystemId = typeof manifest?.designSystemId === 'string' ? manifest.designSystemId : undefined;
    const ds = designSystemId ? await this.contentIndex.getDesignSystem(designSystemId) : undefined;
    const critiqueInput = await buildCritiqueInput({
      workspaceRoot: getWorkspaceRoot(),
      outputDir: getOutputDirectory(),
      entryPath,
      manifest,
      designSystem: designSystemId ? { id: designSystemId, name: ds?.name, designMd: ds?.body } : undefined,
    });
    const run = critiqueInput.checkRun;
    const images: Buffer[] = [];
    for (const img of run?.images ?? []) {
      const data = await readCheckRunImage(getWorkspaceRoot(), getOutputDirectory(), entryPath, run!.id, path.posix.basename(img.path));
      if (data) images.push(data);
    }
    const note = run
      ? `Critique input for ${entryPath}. The ${images.length} attached image(s) are this check run's screenshots, in the order of checkRun.images.`
      : `No saved check run for ${entryPath} yet: call check_open_design_artifact first, then ask for the critique input again.`;
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`${note}\n\n${JSON.stringify({ critiqueInput }, null, 2)}`),
      ...images.map((data) => vscode.LanguageModelDataPart.image(data, 'image/jpeg')),
    ]);
  }
}
