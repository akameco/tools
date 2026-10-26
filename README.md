# tools.zen-lab.dev

[**https://tools.zen-lab.dev**](https://tools.zen-lab.dev) — ブラウザ完結で動作する単一 HTML ミニツール・実験集。

## 収録ツール一覧 (5)

| ツール | 概要 | タグ | 解説 |
| :--- | :--- | :--- | :--- |
| [**Agent Session Player**](https://tools.zen-lab.dev/agent-session-player.html) (`agent-session-player`) | AIコーディングエージェント（Antigravity / Claude Code）の .jsonl セッショントランスクリプトをウォーターフォールタイムラインとステッププレイヤーで可視化・再生するツール | AI Agent, JSONL, Visualization, Timeline | [Docs](./agent-session-player.docs.md) |
| [**Context Treemap**](https://tools.zen-lab.dev/context-treemap.html) (`context-treemap`) | CLAUDE.md・AGENTS.md・SKILL.md 等のコンテキスト占有量を Squarified Treemap で階層可視化し、セクション単位のミュートでトークン削減効果を即座に試算するツール | AI, Context Engineering, Visualization, Markdown | [Docs](./context-treemap.docs.md) |
| [**Asset &amp; FIRE Monte Carlo**](https://tools.zen-lab.dev/fire-monte-carlo.html) (`fire-monte-carlo`) | 資産積立・配当再投資・取り崩し（FIRE）の確率分布を1,000回のモンテカルロ法で即座に描画し、URLハッシュで条件共有できるシミュレーター | Finance, Simulation, Canvas | [Docs](./fire-monte-carlo.docs.md) |
| [**Seam Carver**](https://tools.zen-lab.dev/seam-carver.html) (`seam-carver`) | 動的計画法（Dynamic Programming）によるコンテンツ認識型画像リサイズ（Seam Carving）のインタラクティブ実験・可視化ツール。エネルギーマップ・最小エネルギー経路・保護/優先削除マスクブラシをリアルタイムに体験できます。 | Image, Algorithm, Visualization, Canvas | [Docs](./seam-carver.docs.md) |
| [**SQLite Wasm Studio**](https://tools.zen-lab.dev/sqlite-wasm-studio.html) (`sqlite-wasm-studio`) | CSV・JSON・SQLite(.db)をドラッグ＆ドロップで即座にSQL集計し、Canvasチャートで自動可視化するブラウザ完結型SQLiteプレイグラウンド | SQLite, WebAssembly, Data Analysis, Visualization | [Docs](./sqlite-wasm-studio.docs.md) |

## 開発コマンド

```bash
# バリデーション（HTMLメタデータ・JS構文・.docs.md 検査）
bun test

# 静的サイト生成（dist/ 出力 & README.md 更新）
bun run build
```
