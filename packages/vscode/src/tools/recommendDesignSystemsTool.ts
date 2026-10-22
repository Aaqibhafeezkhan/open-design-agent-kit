import * as vscode from 'vscode';
import type { ContentIndex, DesignProfile } from '@feimacode/open-design-agent-kit-core';
import { getActiveDesignSystemId } from '../workspace/activeDesignSystem';

type RecommendDesignSystemsInput = DesignProfile & { limit?: number };

/** Ranks design systems against a design profile (openspec add-design-system-matching). Never changes the active one. */
export class RecommendDesignSystemsTool implements vscode.LanguageModelTool<RecommendDesignSystemsInput> {
  constructor(private readonly contentIndex: ContentIndex) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<RecommendDesignSystemsInput>,
  ): Promise<vscode.LanguageModelToolResult> {
    const { limit, ...profile } = options.input;
    const result = await this.contentIndex.recommendDesignSystems(profile, limit);
    const payload = { ...result, activeDesignSystemId: getActiveDesignSystemId() };
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(payload, null, 2))]);
  }
}
