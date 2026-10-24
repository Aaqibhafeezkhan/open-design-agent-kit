import * as vscode from 'vscode';
import { prepareComponentLibrary, type ContentIndex } from '@feimacode/open-design-agent-kit-core';
import { getOutputDirectory, getWorkspaceRoot } from '../workspace/artifactWriter';

interface PrepareComponentLibraryInput {
  entryPaths?: string[];
  collectionId?: string;
  library?: string;
  outputDir?: string;
  record?: unknown;
}

// Instructions only, like PortToAppCodeTool: the model writes the theme,
// components and gallery with its own file tools. The one write here is the
// `record` call's metadata.componentLibrary on the source manifests
// (openspec add-component-library-port).
export class PrepareComponentLibraryTool implements vscode.LanguageModelTool<PrepareComponentLibraryInput> {
  constructor(private readonly contentIndex: ContentIndex) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<PrepareComponentLibraryInput>,
  ): Promise<vscode.PreparedToolInvocation> {
    if (options.input.record) return { invocationMessage: 'Recording the component set on the design' };
    return { invocationMessage: 'Preparing a component set from the design' };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<PrepareComponentLibraryInput>,
  ): Promise<vscode.LanguageModelToolResult> {
    const { outputDir, ...rest } = options.input;
    const result = await prepareComponentLibrary({
      ...rest,
      componentsDir: outputDir,
      workspaceRoot: getWorkspaceRoot(),
      outputDir: getOutputDirectory(),
      getDesignSystem: (id) => this.contentIndex.getDesignSystem(id),
    });
    const text = result.ok ? result.text : `Component set not prepared (${result.code}): ${result.text}`;
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
  }
}
