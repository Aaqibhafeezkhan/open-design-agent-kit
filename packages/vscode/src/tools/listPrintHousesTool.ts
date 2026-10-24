import * as vscode from 'vscode';
import { formatPrintHouses, type ContentIndex } from '@feimacode/open-design-agent-kit-core';

// Printers' upload sizes (openspec add-print-house-images), for export's printHouse. Read-only.
export class ListPrintHousesTool implements vscode.LanguageModelTool<Record<string, never>> {
  constructor(private readonly contentIndex: ContentIndex) {}

  async invoke(): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(formatPrintHouses(await this.contentIndex.listPrintHouses()))]);
  }
}
