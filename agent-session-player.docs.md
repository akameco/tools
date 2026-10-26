---
tags:
  - AI Agent
  - JSONL
  - Visualization
  - Timeline
---

AIコーディングエージェント（Google Antigravity の `transcript.jsonl` や Claude Code のセッション `.jsonl`）の実行トランスクリプトを、ブラウザ内だけでウォーターフォール・タイムラインとステッププレイヤーとして可視化・再生するツールです。

## 主な機能

- **マルチフォーマット自動判別**: Antigravity 形式（`step_index`, `type`, `created_at`, `thinking`, `tool_calls`, `content`）と Claude Code 形式（`type: "user" | "assistant"`, `timestamp`, `message.content` 内の `thinking` / `tool_use` / `text` ブロック）の両方を自動認識して正規化します。
- **KPI サマリバー**: セッション全体の合計所要時間、ステップ数、Thinking 回数、ツール名別の呼び出し回数内訳、総文字数および推定トークン数を即座に算出します。
- **ウォーターフォール（ガントチャート）可視化**: 各ステップの相対的な開始タイミングと所要時間をカテゴリ別（User Input / Thinking / Tool Call / Subagent / Response）に色分け描画し、ボトルネックとなったステップを一目で特定できます。
- **ステップ再生＆インスペクタ**: `1x / 2x / 4x` の自動ステップ再生、キーボードショートカット（`←` / `→` / `Space`）、カテゴリ絞り込み・全文検索、および日本標準時（JST / `Asia/Tokyo`）での詳細タイムスタンプ・ツール引数 JSON インスペクタを備えています。
