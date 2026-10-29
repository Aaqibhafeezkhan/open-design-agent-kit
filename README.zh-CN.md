# Open Design Agent Kit

[English](README.md) | 简体中文 | [日本語](README.ja.md)

**将专业级设计能力直接集成到你日常使用的编程助手中。**

Open Design Agent Kit 将 [Open Design](https://github.com/nexu-io/open-design) 的设计技能、品牌设计系统和可复用示例集成到 **GitHub Copilot Chat、Claude Code、Codex、Cursor** 以及其他支持 MCP 的 AI 编程助手中。只需在当前打开的聊天窗口中描述需求，即可创建演示文稿、落地页、数据仪表板或移动端原型。AI 助手会使用自身的模型和文件工具，借助精心整理的设计资源生成更具专业感的成果。

**无需桌面应用、后台守护进程、额外账户、API 密钥或模型设置。** 安装后，只需提出需求，生成的文件就会出现在你的项目中。

## 有什么不同？

- **原生集成到各类 AI 助手。** 它不是简单的封装工具，也不是独立的用户界面；每种集成都使用对应助手自身的机制。在 Copilot 中，它使用 VS Code 的 `languageModelTools`、聊天指令和斜杠命令；在 Claude Code 中，它通过插件、技能和内置 MCP 服务器运行；在 Codex 中，它使用 `.agents/skills` 和 MCP。AI 助手会自动发现可用工具，你只需描述自己的需求。

- **精心整理的设计资源库，而不只是提示词。** 针对不同任务提供设计方案、符合品牌规范的设计令牌，以及经过实践打磨的设计规则。这些资源能够帮助你生成真正经过设计的作品，而不是千篇一律的渐变卡片布局。

- **从真实示例改造，而不是从零开始。** 你可以从已有的实际渲染示例和不断扩充的社区作品库中选择参考，让 AI 助手在此基础上进行调整，而不是每次都重新生成。

- **默认保持品牌一致性。** 只需选择一次设计系统，无论使用内置系统、根据设计需求创建的系统，还是导入自己的系统，后续生成的作品都会沿用相应的视觉规范。

- **立足于真实代码，并融入实际项目。** 生成内容时会优先参考项目中现有的组件。原型确认后，只需调用相应工具，就能将其转换为符合项目规范的生产代码。

- **所有内容都是普通文件。** 设计产物、清单、注释和自定义设计系统都以文件形式保存在工作区中，无需数据库，不受特定平台锁定，也不需要额外导出。

## 快速开始

- **VS Code（GitHub Copilot Chat）：** 从 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=feima.open-design-agent-kit) 安装 Open Design Agent Kit。请参阅 [入门指南](docs/getting-started/vscode.md)。

- **Cursor 及其他支持 MCP 的助手：** 将 `npx -y @feimacode/open-design-agent-kit-mcp` 注册为使用标准输入输出通信的 MCP 服务器。请参阅 [MCP 服务器说明](packages/mcp-server/README.md)。

- **Codex CLI：** 在项目中运行 `npx @feimacode/open-design-agent-kit init --tools codex`。请参阅 [入门指南](docs/getting-started/codex.md)。

- **Claude Code：** 运行 `/plugin marketplace add feimacode/open-design-agent-kit`，然后运行 `/plugin install open-design`。也可以在项目中运行 `npx @feimacode/open-design-agent-kit init --tools claude`。请参阅 [入门指南](docs/getting-started/claude-code.md)。

- **Claude Desktop：** 在 Customize → Plugins 中安装同一插件，然后在 Code 标签页或包含文件夹的聊天中使用它。你也可以从 [Releases](https://github.com/feimacode/open-design-agent-kit/releases/latest) 下载桌面扩展 `open-design-<version>.mcpb`，以便在不安装 Node.js 的情况下使用相关工具。请参阅 [入门指南](docs/getting-started/claude-desktop.md)。

- **其他支持 Skills 的 AI 助手：** 运行 `npx skills add https://github.com/feimacode/open-design-agent-kit/tree/main/packages/claude-plugin/skills/open-design`，即可将相应技能添加到 Cursor、OpenCode、Cline 等支持的助手中。首次提出设计需求时，系统会自动注册 MCP 服务器，无需预先启动其他服务。

- **脚本与 CI：** 使用 `npx @feimacode/open-design-agent-kit export …`、`check …` 和 `render-video …`。请参阅 [CLI 指南](docs/getting-started/cli.md)。

## 社区

- **作品展示：** 社区可复用设计作品收录于 [awesome-open-design](https://github.com/feimacode/awesome-open-design)。欢迎分享你的优秀作品。
- **交流与展示：** 前往 [GitHub Discussions](https://github.com/feimacode/open-design-agent-kit/discussions) 提问、交流经验并展示作品。
- **问题与功能建议：** 请通过 [GitHub Issues](https://github.com/feimacode/open-design-agent-kit/issues) 提交问题或提出功能建议。
- **参与贡献：** 请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，也可以从标记为 [`good first issue`](https://github.com/feimacode/open-design-agent-kit/labels/good%20first%20issue) 的任务开始。
