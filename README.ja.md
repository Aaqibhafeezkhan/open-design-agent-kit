# Open Design Agent Kit

[English](README.md) | [简体中文](README.zh-CN.md) | 日本語

**プロレベルのデザインを、普段お使いのコーディングエージェントに直接組み込みます。**

Open Design Agent Kit は、[Open Design](https://github.com/nexu-io/open-design) のデザインスキル、ブランドデザインシステム、リミックス可能なサンプルを、**GitHub Copilot Chat、Claude Code、Codex、Cursor**、その他 MCP に対応したあらゆるエージェントに提供します。すでに開いているチャットで、ピッチデッキ、ランディングページ、ダッシュボード、モバイルプロトタイプを依頼してください。エージェント自身のモデルが、自身のファイルツールを使って作成します。その際、結果が AI 生成っぽく見えないようにするライブラリがガイドします。

**デスクトップアプリも、デーモンも、追加のアカウント、API キー、モデル設定も不要です。** インストールして依頼すれば、ファイルがリポジトリに現れます。

## 別のアプリより組み込み型が優れている理由

Open Design 自体は、独自のデーモン、プロジェクトデータベース、モデル設定を備えた、ローカルファーストの本格的なデスクトップアプリです。優れたアプリですが、インストールし、起動し続け、設定し、切り替えて使うものがもう 1 つ増えることになります。日々の作業で価値をもたらしているものの大半は、アプリそのものではありません。それは**コンテンツ**です：181 のスキル、114 のデザインテンプレート、198 のブランドデザインシステム、193 のリミックス可能なサンプル成果物、そして 13 のクラフトドキュメント（タイポグラフィ、カラー、アクセシビリティ、「AI スロップ」対策）。Agent Kit は、そのコンテンツとそれを取り巻く生成ワークフローを、エージェントに直接組み込みます：

| | Open Design デスクトップアプリ | Open Design Agent Kit |
|---|---|---|
| **インストール** | デスクトップアプリとバックグラウンドデーモン | VS Code 拡張機能、Claude Code プラグイン、または `npx` コマンドの 1 つだけ |
| **作業する場所** | 別のアプリウィンドウ | すでに開いているエージェントのチャット |
| **モデル** | アプリ内で選択・設定 | エージェントがすでに使っているモデル。2 つ目のキーや請求は不要 |
| **セットアップ** | プロバイダー、キー、プロジェクトをアプリ内で設定 | 設定するものはありません。アクティブなデザインシステムはワークスペースごとに記憶されます。 |
| **出力** | アプリのプロジェクトデータベースに保存 | リポジトリ内のプレーンなファイル：他のコードと同じように差分を確認し、レビューし、コミットできます |
| **本番への移行** | エクスポートして引き渡し | 同じセッション内で、プロトタイプを実際のアプリのコンポーネントに昇格 |

## 何が違うのか

- **各エージェントにネイティブ対応。** ラッパーでも別の UI でもありません。各インテグレーションはエージェント自身の仕組みを使います。Copilot では VS Code の `languageModelTools`、チャットの指示、スラッシュコマンド。Claude Code ではスキルと同梱の MCP サーバーを備えたプラグイン。Codex では `.agents/skills` と MCP です。エージェントが自分でツールを見つけるので、欲しいものを説明するだけです。
- **プロンプトではなく、厳選されたライブラリ。** タスク別のレシピ、ブランドに忠実なデザイントークン、苦労して得たクラフトのルール。それが「ありがちなグラデーションのカードレイアウト」と、デザインされたように見えるものとの違いです。
- **白紙から始めず、リミックスする。** 193 の実際にレンダリングされたサンプルと、拡大し続けるコミュニティカタログのどれからでも始められ、モデルがゼロから作り出すのではなく、それを応用します。
- **デフォルトでブランドの一貫性を維持。** デザインシステムを一度選べば（同梱のもの、概要から作り出したもの、自分のものをインポートしたもの）、それ以降のすべての生成でそれが使われます。
- **コードベースに根ざし、コードベースへ向かう。** 生成ではまず実際のコンポーネントを参照します。プロトタイプが完成したら、1 回のツール呼び出しで、慣用的な本番コードとしてアプリに移植できます。
- **すべてがファイル。** 成果物、マニフェスト、コメント、カスタムデザインシステムは、ワークスペース内のプレーンなファイルです。データベースもロックインもなく、エクスポートするものもありません。

利用方法：

- **[VS Code 拡張機能](packages/vscode/README.md)**：GitHub Copilot Chat 向けのネイティブツールに加え、ギャラリー、コメント付きのライブ成果物プレビュー、WYSIWYG 編集と Tweaks パネル、複数画面のコレクションと探索、そして Integrations ビューを提供します。
- **[Claude Code プラグイン](docs/getting-started/claude-code.md)**：`/plugin install open-design` で、デザインの依頼（SNS 投稿、ポスター、キャンペーン、探索、ドキュメントからのデッキを含む）で発動するスキル、厳選された 27 の `/open-design:*` コマンド、そして自動登録される MCP サーバーが手に入ります。
- **[Codex CLI](docs/getting-started/codex.md)**：Codex 独自の `.agents/skills` 形式の同じスキルと、MCP サーバー。
- **[1 コマンドでのプロジェクトセットアップ](packages/cli/README.md)**：`npx @feimacode/open-design-agent-kit init` で、Claude Code や Codex をプロジェクトに組み込みます。
- **[MCP サーバー](packages/mcp-server/README.md)**：Cursor やその他の MCP 対応エージェント向けの `npx @feimacode/open-design-agent-kit-mcp`。
- **[`npx skills add`](https://github.com/vercel-labs/skills) 経由であらゆるエージェントに**：`npx skills add https://github.com/feimacode/open-design-agent-kit/tree/main/packages/claude-plugin/skills/open-design` で、`skills` が対応する 75 以上のエージェント（Cursor、OpenCode、Cline など）のどれにでも同じスキルを追加できます。初めてデザインを依頼したときに MCP サーバーを自分で登録するので、事前に実行するものは何もありません。

**feimacode** の名義で公開しています。VS Code 拡張機能のパブリッシャー ID は `feima` です。

## 作れるものを見る

約 280 ある同梱スキルとテンプレートのうち 6 つを、そのままレンダリングしたものです — レタッチも、都合のよい切り抜きもしていません：

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/examples/dating-web.png" alt="一般向け出会い系アプリのダッシュボード。エディトリアルなタイポグラフィと左側のナビゲーション" width="100%"/><br/>
<sub><b>「出会い系サイトのダッシュボードをデザインして — 相互マッチ、マッチ率、30 日間の推移。」</b><br/>エディトリアルなダッシュボード、左側のナビゲーション、控えめなアクセントカラー 1 色。</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/examples/gamified-app.png" alt="ゲーム要素のある習慣トラッキングのモバイルアプリ。3 つのスマートフォンフレーム" width="100%"/><br/>
<sub><b>「デイリークエストと XP がある習慣トラッキングアプリ。」</b><br/>3 画面のモバイルプロトタイプ、鮮やかなクエストタイル、レベルバー。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/examples/deck-swiss-international.png" alt="スイス・インターナショナル・スタイルの取締役会向け戦略デッキの表紙スライド" width="100%"/><br/>
<sub><b>「取締役会にそのまま出せる、スイス・インターナショナル・スタイルの戦略デッキ。」</b><br/>意思決定に使える水準の企業向けデッキ — これは 10 枚中の 1 枚目です。</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/examples/data-report.png" alt="KPI カードと推移グラフを含む週次メトリクスレポート" width="100%"/><br/>
<sub><b>「この CSV を週次のメトリクスレポートにして。」</b><br/>KPI カード、推移グラフ、生データの表。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="docs/screenshots/examples/card-xiaohongshu.png" alt="小紅書（Xiaohongshu）風のスワイプできる知識カード" width="100%"/><br/>
<sub><b>「5 つのヒントを、小紅書風のスワイプできるカードカルーセルに。」</b><br/>SNS ネイティブな知識カード。そのまま画像としてエクスポートできます。</sub>
</td>
<td width="50%" valign="top">
<img src="docs/screenshots/examples/resume-modern.png" alt="モダンでミニマルな履歴書。A4 1 ページ" width="100%"/><br/>
<sub><b>「モダンで、そのまま印刷できる履歴書。」</b><br/>A4 1 ページで、PDF としてエクスポートできます。</sub>
</td>
</tr>
</table>

これらはすべて、`remix_open_design_example`（実際のサンプルをコピーしてから修正）または `prepare_open_design_brief`（指示を組み立ててゼロから生成）から始まっています — 以下のどの利用方法でも、使うのはこの同じ 2 つのツールです。

## はじめに

- **VS Code（GitHub Copilot Chat）：** [Marketplace](https://marketplace.visualstudio.com/items?itemName=feima.open-design-agent-kit) から「Open Design Agent Kit」をインストールしてください。[入門ガイド](docs/getting-started/vscode.md)を参照してください。
- **Claude Code：** `/plugin marketplace add feimacode/open-design-agent-kit` の後、`/plugin install open-design` を実行します。または、プロジェクトで `npx @feimacode/open-design-agent-kit init --tools claude` を実行します。[入門ガイド](docs/getting-started/claude-code.md)を参照してください。
- **Claude Desktop：** **Customize → Plugins** から同じプラグインをインストールし、Code タブ、またはフォルダを指定した Chat で使用します。必要に応じてデスクトップ拡張機能（[releases](https://github.com/feimacode/open-design-agent-kit/releases/latest) の `open-design-<version>.mcpb`）を追加すると、Node.js なしでのツール利用、Figma トークンの入力フォーム、フォルダなしでの Chat が可能になります。[入門ガイド](docs/getting-started/claude-desktop.md)を参照してください。
- **Codex CLI：** `npx @feimacode/open-design-agent-kit init --tools codex`。[入門ガイド](docs/getting-started/codex.md)を参照してください。
- **あらゆる MCP エージェント（Cursor など）：** `npx -y @feimacode/open-design-agent-kit-mcp` を stdio MCP サーバーとして登録します。[MCP サーバーの README](packages/mcp-server/README.md) を参照してください。
- **[`skills` が対応する 75 以上のエージェント](https://github.com/vercel-labs/skills)のいずれか：** `npx skills add https://github.com/feimacode/open-design-agent-kit/tree/main/packages/claude-plugin/skills/open-design`（特定のエージェントを直接対象にするには `--agent <name>` を追加）。スキルは初回実行時に MCP サーバーを自動で設定します。
- **スクリプトと CI：** `npx @feimacode/open-design-agent-kit export …`、`check …`、`render-video …`。[CLI ガイド](docs/getting-started/cli.md)を参照してください。

## 普段お使いのツールと連携

エージェントがこれらのサービスの公式 MCP サーバーに接続されている場合、Open Design のワークフローは、アップロード用のファイルを渡す代わりにそれらを直接使用します：Canva へのインポート、Figma へのデザインのプッシュ、Drive への保存、スケジューラー経由での投稿などです。あなたの許可なしに何かがインストールされることはありません。[他のサービスとの接続](docs/guides/integrations.md)を参照してください。

<!-- integrations:start -->
| インテグレーション | エージェントができること |
|---|---|
| Canva | デザインのインポート、アセットのアップロード、エクスポート、ブランドキットの読み取り |
| Figma | フレームを読み取ってコード化、デザインを編集可能なレイヤーとしてプッシュ、アセットのエクスポートとアップロード |
| Notion | ページの読み取り、ページの作成、ファイルのアップロード |
| Google Drive | ファイルの検索、読み取り、保存 |
| Slack | チャンネルへのメッセージや画像の共有 |
| Buffer | X、LinkedIn、Instagram、Facebook、Threads、Bluesky、Mastodon、TikTok、Pinterest、YouTube への投稿の下書きと予約 |
| Metricool | Instagram、Facebook、LinkedIn、TikTok、YouTube への投稿の予約 |
| X | X 自身のサーバー経由での投稿 |
| Shopify | ストアの商品と説明文の更新 |
<!-- integrations:end -->

## ドキュメント

すべて [`docs/`](docs/README.md) にあります：

- **ガイド：**
  - [デザインを生成する](docs/guides/generate-a-design.md)、[デザインの方向性を探る](docs/guides/explore-directions.md)、[ドキュメントをデッキにする](docs/guides/deck-from-a-document.md)、[コードの図](docs/guides/diagrams.md)、[3D オブジェクト](docs/guides/3d-objects.md)、[エンジニアリングドキュメント](docs/guides/engineering-docs.md)；
  - [デザインシステム](docs/guides/design-systems.md)、[リミックスとギャラリー](docs/guides/remix-and-gallery.md)、[コミュニティのデザイン](docs/guides/community-designs.md)；
  - [プレビュー、コメント、編集](docs/guides/preview-comments-edit.md)、[Figma](docs/guides/figma.md)、[アプリのコードに昇格する](docs/guides/promote-to-app-code.md)、[コンポーネントセットを作る](docs/guides/component-library.md)、[他のサービスと接続する](docs/guides/integrations.md)；
  - [SNS 投稿](docs/guides/social-posts.md)、[HTML メール](docs/guides/html-email.md)、[WeChat、Notion、ニュースレターへの貼り付け](docs/guides/paste-html.md)、[ポスターと印刷物](docs/guides/posters.md)、[作ったものを販売する](docs/guides/sell-what-you-make.md)、[キャンペーンを実施する](docs/guides/campaigns.md)、[YouTube 動画](docs/guides/youtube-video.md)；
  - [画像のエクスポート](docs/guides/export-images.md)、[デッキと PDF のエクスポート](docs/guides/export-decks.md)、[アニメーションのエクスポート](docs/guides/export-animations.md)、[共有と公開](docs/guides/share-and-publish.md)。
- **リファレンス：** [ツール](docs/reference/tools.md)、[プロンプトとコマンド](docs/reference/prompts-and-commands.md)、[CLI](docs/reference/cli.md)、[設定と環境変数](docs/reference/settings-and-env.md)、[成果物マニフェスト](docs/reference/artifact-manifest.md)。
- **ヘルプ：** [トラブルシューティング](docs/troubleshooting.md)。
- **自動化：** [SNS パイプライン](docs/automation/social-pipeline.md)。
- **コントリビュート：** [アーキテクチャ](docs/contributing/architecture.md)、[コンテンツの同期](docs/contributing/content-sync.md)、[スキルやプロンプトの追加](docs/contributing/adding-a-skill-or-prompt.md)、[アップストリームからの移植](docs/contributing/upstream-ports.md)、[リリース](docs/contributing/releasing.md)。

## コミュニティ

- **ギャラリー：** コミュニティによるリミックス可能なデザインは [awesome-open-design](https://github.com/feimacode/awesome-open-design) にあります。良いものができたら、そこに追加してください。
- **質問と作品紹介：** [GitHub Discussions](https://github.com/feimacode/open-design-agent-kit/discussions)。
- **バグと要望：** [Issue を作成](https://github.com/feimacode/open-design-agent-kit/issues/new/choose)してください。
- **コントリビュート：** まずは [CONTRIBUTING.md](CONTRIBUTING.md) と [`good first issue`](https://github.com/feimacode/open-design-agent-kit/labels/good%20first%20issue) ラベルから始めてください。

## 来歴

一部のコードは open-design（Apache-2.0）から改変して使用しています：成果物マニフェストのロジック、プレビューエディターの一部、デッキのエクスポートです。正確な記録については、[アップストリームからの移植](docs/contributing/upstream-ports.md)と [`packages/core/src/vendored/SOURCE.md`](packages/core/src/vendored/SOURCE.md) を参照してください。

## ライセンス

MIT — [LICENSE](LICENSE) を参照してください。スキル/デザインシステム/クラフト/サンプルのコンテンツは [open-design](https://github.com/nexu-io/open-design) から同梱しており、Apache-2.0 でライセンスされています。どのファイルが該当するかについては、上記の[来歴](#来歴)を参照してください。
