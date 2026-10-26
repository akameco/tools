# tools.zen-lab.dev (`akameco/tools`)

ブラウザ完結の単一 HTML ツール集（https://tools.zen-lab.dev）。

## Git 運用（グローバル原則の上書き）

- トピックブランチや PR は作らず、`main` に直接 `git commit` / `git push` する。
- コミット前に `git fetch && git status` で状態を確認し、`bun test && bun run build` が通ることを確かめてから push する。

## ツール追加・更新の手順

1. **2ファイルの作成**: リポジトリ直下に `{slug}.html` と `{slug}.docs.md` を作成する。
2. **検証と README 更新**: `bun test && bun run build` を実行し、すべての検査が通り `README.md` と `dist/` が更新されることを確認する。
3. **公開**: `{slug}.html`、`{slug}.docs.md`、`README.md` を `main` にコミットして push する。

## ファイル規約

### 1. `{slug}.html`（単一ファイル完結）

- 1ファイル内に HTML・CSS・JavaScript をすべて収める。外部ライブラリが必要な場合は CDN（`https://esm.sh/...` または `https://cdn.jsdelivr.net/...`）から読み込む。
- Web フォント（Google Fonts 等）は読み込まず、OS 標準フォントを使う。
- 初期表示時に手元のファイルがなくてもすぐ試せるよう、**「サンプルデータで試す」ボタン（または初期デモ状態）** を必ず組み込む。
- 以下の `<head>` 構造と Zen Lab デザイントークンをベースにする:

```html
<!DOCTYPE html>
<html lang="ja" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>ツール名 — Zen Lab Tools</title>
  <meta name="description" content="1文でのツールの簡潔な説明">
  <style>
    :root {
      color-scheme: dark;
      --color-primary: #e68a75;
      --color-shu-red: #d64527;
      --color-on-shu-red: #ffffff;
      --color-background: #081617;
      --color-on-surface: #f0f4f5;
      --color-on-surface-variant: #9eb3b5;
      --color-surface-container: #1b2f31;
      --color-surface-container-low: #142527;
      --color-surface-container-lowest: #0a1819;
      --color-surface-container-high: #243c3e;
      --color-ink-border: #334a4c;
      --color-success: oklch(79.2% 0.209 151.711);
      --focus-ring: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-shu-red);
      --font-mincho: "Hiragino Mincho ProN", "YuMincho", "Yu Mincho", "Noto Serif CJK JP", serif;
      --font-gothic: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "YuGothic", "Yu Gothic", "Noto Sans CJK JP", sans-serif;
      --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      --radius-sm: 0.25rem;
      --radius-md: 0.375rem;
      --radius-lg: 0.5rem;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--color-background);
      color: var(--color-on-surface);
      font-family: var(--font-gothic);
      line-height: 1.65;
    }
    .site-header {
      border-bottom: 1px solid var(--color-ink-border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.8125rem;
    }
    .site-header a {
      color: var(--color-on-surface-variant);
      text-decoration: none;
    }
    .site-header a:hover { color: var(--color-primary); }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px 20px 64px;
    }
    h1 {
      font-family: var(--font-mincho);
      font-size: clamp(1.35rem, 1.1rem + 1vw, 2rem);
      margin: 0 0 8px;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a href="./">← tools.zen-lab.dev</a>
    <a href="./colophon.html#{slug}.html">Docs &amp; History</a>
  </header>
  <main>
    <!-- ツール本体 -->
  </main>
</body>
</html>
```

### 2. `{slug}.docs.md`（解説・メタデータ）

YAML フロントマターに `tags`（配列）を書き、本文にツールの概要・使い方・技術的な仕組みを簡潔に記述する。

```markdown
---
tags:
  - AI
  - Visualization
---

ツールの概要と主な使い方の説明。
```
