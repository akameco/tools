import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

interface CommitInfo {
  hash: string;
  shortHash: string;
  dateIso: string;
  dateJst: string;
  subject: string;
}

interface ToolEntry {
  slug: string;
  filename: string;
  docsFilename: string;
  title: string;
  description: string;
  tags: string[];
  docsBody: string;
  docsHtml: string;
  createdAtIso: string;
  updatedAtIso: string;
  createdAtJst: string;
  updatedAtJst: string;
  commits: CommitInfo[];
}

const ROOT_DIR = import.meta.dir;
const DIST_DIR = join(ROOT_DIR, "dist");
const REPO_URL = "https://github.com/akameco/tools";

function formatJst(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")} JST`;
}

function formatJstDateOnly(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFrontmatterAndBody(md: string): { tags: string[]; body: string } {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { tags: [], body: md.trim() };
  }
  const yamlPart = match[1];
  const body = match[2].trim();
  const tags: string[] = [];
  let inTags = false;
  for (const line of yamlPart.split(/\r?\n/)) {
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      continue;
    }
    const inlineTags = line.match(/^tags:\s*\[(.*)\]\s*$/);
    if (inlineTags) {
      for (const item of inlineTags[1].split(",")) {
        const cleaned = item.trim().replace(/^['"]|['"]$/g, "");
        if (cleaned) tags.push(cleaned);
      }
      inTags = false;
      continue;
    }
    if (inTags) {
      const m = line.match(/^\s*-\s*(.+)$/);
      if (m) {
        tags.push(m[1].trim().replace(/^['"]|['"]$/g, ""));
      } else if (/^\S/.test(line)) {
        inTags = false;
      }
    }
  }
  return { tags, body };
}

function renderSimpleMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inList = false;
  let inCode = false;
  let codeBuffer: string[] = [];

  const formatInline = (text: string) =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\.\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      if (!inCode) {
        inCode = true;
        codeBuffer = [];
      } else {
        htmlLines.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (!line.trim()) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      htmlLines.push(`<h4>${formatInline(line.slice(4).trim())}</h4>`);
    } else if (line.startsWith("## ")) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      htmlLines.push(`<h3>${formatInline(line.slice(3).trim())}</h3>`);
    } else if (/^\s*-\s+/.test(line)) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      htmlLines.push(`<li>${formatInline(line.replace(/^\s*-\s+/, ""))}</li>`);
    } else {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      htmlLines.push(`<p>${formatInline(line.trim())}</p>`);
    }
  }
  if (inList) htmlLines.push("</ul>");
  if (inCode) htmlLines.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
  return htmlLines.join("\n");
}

function getGitCommits(filename: string, docsFilename: string): CommitInfo[] {
  const res = spawnSync(
    "git",
    ["log", "--follow", "--format=%H|%aI|%s", "--", filename, docsFilename],
    { cwd: ROOT_DIR, encoding: "utf-8" }
  );
  if (res.status !== 0 || !res.stdout.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const commits: CommitInfo[] = [];
  for (const line of res.stdout.trim().split(/\r?\n/)) {
    const [hash, dateIso, ...rest] = line.split("|");
    if (!hash || !dateIso || seen.has(hash)) continue;
    seen.add(hash);
    commits.push({
      hash,
      shortHash: hash.slice(0, 7),
      dateIso,
      dateJst: formatJst(dateIso),
      subject: rest.join("|"),
    });
  }
  return commits;
}

function extractMeta(html: string, slug: string): { title: string; description: string } {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : slug;
  const title = rawTitle.replace(/\s*[—\-|]\s*Zen Lab Tools$/i, "").trim();

  const descMatch =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ??
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  return { title, description };
}

function collectTools(): ToolEntry[] {
  const files = readdirSync(ROOT_DIR)
    .filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "colophon.html")
    .sort();

  const tools: ToolEntry[] = [];

  for (const filename of files) {
    const slug = filename.replace(/\.html$/, "");
    const docsFilename = `${slug}.docs.md`;
    const htmlPath = join(ROOT_DIR, filename);
    const docsPath = join(ROOT_DIR, docsFilename);

    const html = readFileSync(htmlPath, "utf-8");
    const { title, description } = extractMeta(html, slug);

    let tags: string[] = [];
    let docsBody = description;
    if (existsSync(docsPath)) {
      const rawDocs = readFileSync(docsPath, "utf-8");
      const parsed = parseFrontmatterAndBody(rawDocs);
      tags = parsed.tags;
      docsBody = parsed.body || description;
    }

    const commits = getGitCommits(filename, docsFilename);
    const stat = statSync(htmlPath);
    const fallbackIso = stat.mtime.toISOString();

    const updatedAtIso = commits[0]?.dateIso ?? fallbackIso;
    const createdAtIso = commits[commits.length - 1]?.dateIso ?? fallbackIso;

    tools.push({
      slug,
      filename,
      docsFilename,
      title,
      description,
      tags,
      docsBody,
      docsHtml: renderSimpleMarkdown(docsBody),
      createdAtIso,
      updatedAtIso,
      createdAtJst: formatJstDateOnly(createdAtIso),
      updatedAtJst: formatJst(updatedAtIso),
      commits,
    });
  }

  return tools;
}

const SHARED_CSS = `
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
  line-height: 1.7;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}
a:hover {
  color: var(--color-shu-red);
}
a:focus-visible, button:focus-visible, input:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.site-header {
  border-bottom: 1px solid var(--color-ink-border);
  background: var(--color-surface-container-lowest);
  padding: 16px 24px;
}
.site-header-inner {
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--color-on-surface);
  font-family: var(--font-mincho);
  font-weight: 700;
  font-size: 1.125rem;
  letter-spacing: 0.04em;
}
.brand-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-shu-red);
  color: var(--color-on-shu-red);
  font-family: var(--font-mincho);
  font-size: 0.75rem;
  transform: rotate(45deg);
  border-radius: 2px;
}
.brand-seal span {
  transform: rotate(-45deg);
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}
.nav-links a {
  color: var(--color-on-surface-variant);
}
.nav-links a:hover, .nav-links a[aria-current="page"] {
  color: var(--color-on-surface);
}
main {
  flex: 1;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}
.site-footer {
  border-top: 1px solid var(--color-ink-border);
  padding: 24px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-on-surface-variant);
}
`;

function renderIndexHtml(tools: ToolEntry[]): string {
  const allTags = Array.from(new Set(tools.flatMap((t) => t.tags))).sort();
  const sortedByUpdated = [...tools].sort((a, b) =>
    b.updatedAtIso.localeCompare(a.updatedAtIso)
  );

  const cardsHtml = sortedByUpdated
    .map((tool) => {
      const tagsAttr = escapeHtml(tool.tags.join(","));
      const searchBlob = escapeHtml(
        `${tool.slug} ${tool.title} ${tool.description} ${tool.docsBody} ${tool.tags.join(" ")}`.toLowerCase()
      );
      const tagPills = tool.tags
        .map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`)
        .join("");

      return `
      <article class="tool-card" data-tags="${tagsAttr}" data-search="${searchBlob}">
        <div class="tool-card-header">
          <h2 class="tool-title">
            <a href="./${encodeURIComponent(tool.filename)}">${escapeHtml(tool.title)}</a>
          </h2>
          <code class="tool-slug">${escapeHtml(tool.slug)}</code>
        </div>
        <p class="tool-desc">${escapeHtml(tool.description)}</p>
        <div class="tool-card-footer">
          <div class="tool-tags">${tagPills}</div>
          <div class="tool-meta">
            <span>${escapeHtml(tool.createdAtJst)}</span>
            <span class="meta-sep">·</span>
            <a href="./colophon.html#${encodeURIComponent(tool.filename)}" class="docs-link">解説・履歴</a>
          </div>
        </div>
      </article>`;
    })
    .join("\n");

  const tagButtonsHtml = [
    `<button type="button" class="filter-chip" data-tag="all" aria-pressed="true">All (${tools.length})</button>`,
    ...allTags.map(
      (tag) =>
        `<button type="button" class="filter-chip" data-tag="${escapeHtml(tag)}" aria-pressed="false">${escapeHtml(tag)}</button>`
    ),
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="ja" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Zen Lab Tools — tools.zen-lab.dev</title>
  <meta name="description" content="ブラウザ完結で動く実験的ミニツール・AIエージェント補助・ビジュアライザ集（tools.zen-lab.dev）">
  <style>
    ${SHARED_CSS}
    .hero {
      margin-bottom: 36px;
      padding-bottom: 28px;
      border-bottom: 1px solid var(--color-ink-border);
    }
    .hero-eyebrow {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-shu-red);
      margin: 0 0 8px;
    }
    .hero h1 {
      font-family: var(--font-mincho);
      font-size: clamp(1.6rem, 1.2rem + 1.8vw, 2.5rem);
      margin: 0 0 12px;
      line-height: 1.3;
    }
    .hero p {
      margin: 0;
      color: var(--color-on-surface-variant);
      max-width: 68ch;
      font-size: 0.95rem;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 28px;
    }
    .search-box {
      position: relative;
    }
    .search-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-ink-border);
      border-radius: var(--radius-md);
      color: var(--color-on-surface);
      font-family: var(--font-gothic);
      font-size: 0.95rem;
    }
    .search-input::placeholder {
      color: var(--color-on-surface-variant);
    }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .filter-chip {
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-ink-border);
      color: var(--color-on-surface-variant);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-chip:hover {
      border-color: var(--color-primary);
      color: var(--color-on-surface);
    }
    .filter-chip[aria-pressed="true"] {
      background: var(--color-shu-red);
      border-color: var(--color-shu-red);
      color: var(--color-on-shu-red);
    }
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .tool-card {
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-ink-border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
      transition: border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
    }
    .tool-card:hover {
      border-color: color-mix(in oklab, var(--color-shu-red) 55%, var(--color-ink-border));
      background: var(--color-surface-container);
    }
    .tool-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .tool-title {
      font-family: var(--font-mincho);
      font-size: 1.15rem;
      margin: 0;
      line-height: 1.4;
    }
    .tool-title a {
      color: var(--color-on-surface);
    }
    .tool-title a:hover {
      color: var(--color-primary);
    }
    .tool-slug {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container-lowest);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-ink-border);
      white-space: nowrap;
    }
    .tool-desc {
      margin: 0;
      color: var(--color-on-surface-variant);
      font-size: 0.9rem;
      line-height: 1.65;
      flex: 1;
    }
    .tool-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 12px;
      border-top: 1px solid color-mix(in oklab, var(--color-ink-border) 60%, transparent);
    }
    .tool-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag-pill {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--color-primary);
      background: color-mix(in oklab, var(--color-shu-red) 15%, var(--color-surface-container-lowest));
      border: 1px solid color-mix(in oklab, var(--color-shu-red) 35%, transparent);
      padding: 2px 8px;
      border-radius: 999px;
    }
    .tool-meta {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--color-on-surface-variant);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .docs-link {
      color: var(--color-on-surface-variant);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .docs-link:hover {
      color: var(--color-primary);
    }
    .empty-state {
      display: none;
      padding: 40px;
      text-align: center;
      color: var(--color-on-surface-variant);
      border: 1px dashed var(--color-ink-border);
      border-radius: var(--radius-lg);
      font-family: var(--font-mono);
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <a href="./" class="brand">
        <span class="brand-seal"><span>禅</span></span>
        <span>Zen Lab Tools</span>
      </a>
      <nav class="nav-links" aria-label="サイトナビゲーション">
        <a href="./" aria-current="page">Tools (${tools.length})</a>
        <a href="./colophon.html">Colophon &amp; Docs</a>
        <a href="https://zen-lab.dev">zen-lab.dev</a>
        <a href="${REPO_URL}">GitHub</a>
      </nav>
    </div>
  </header>
  <main>
    <section class="hero">
      <p class="hero-eyebrow">tools.zen-lab.dev</p>
      <h1>単一HTMLで動く実験室</h1>
      <p>AIエージェント連携、WebAssembly / Canvas 実験、日常のシミュレーションなど、ブラウザ内だけで完結するスタンドアロン・ミニツール集です。すべての処理はクライアントサイドで実行され、外部サーバーへデータは送信されません。</p>
    </section>

    <section class="controls" aria-label="ツール検索とフィルタ">
      <div class="search-box">
        <input type="search" id="tool-search" class="search-input" placeholder="ツール名・機能・タグで絞り込み (例: SQLite, JSONL, Monte Carlo, Seam...)" autocomplete="off">
      </div>
      <div class="filter-bar" id="tag-filters">
        ${tagButtonsHtml}
      </div>
    </section>

    <section class="tool-grid" id="tool-grid">
      ${cardsHtml}
    </section>
    <div class="empty-state" id="empty-state">条件に一致するツールが見つかりませんでした。</div>
  </main>
  <footer class="site-footer">
    <p>Built on <a href="https://zen-lab.dev">zen-lab.dev</a> design system · Source on <a href="${REPO_URL}">akameco/tools</a></p>
  </footer>
  <script>
    const searchInput = document.getElementById("tool-search");
    const tagButtons = Array.from(document.querySelectorAll(".filter-chip"));
    const cards = Array.from(document.querySelectorAll(".tool-card"));
    const emptyState = document.getElementById("empty-state");
    let activeTag = "all";

    function applyFilter() {
      const q = (searchInput.value || "").trim().toLowerCase();
      let visibleCount = 0;
      for (const card of cards) {
        const tags = (card.dataset.tags || "").split(",").filter(Boolean);
        const searchBlob = card.dataset.search || "";
        const matchTag = activeTag === "all" || tags.includes(activeTag);
        const matchQuery = !q || searchBlob.includes(q);
        if (matchTag && matchQuery) {
          card.style.display = "";
          visibleCount++;
        } else {
          card.style.display = "none";
        }
      }
      emptyState.style.display = visibleCount === 0 ? "block" : "none";
    }

    searchInput.addEventListener("input", applyFilter);
    for (const btn of tagButtons) {
      btn.addEventListener("click", () => {
        activeTag = btn.dataset.tag || "all";
        for (const b of tagButtons) {
          b.setAttribute("aria-pressed", String(b === btn));
        }
        applyFilter();
      });
    }
  </script>
</body>
</html>`;
}

function renderColophonHtml(tools: ToolEntry[]): string {
  const sorted = [...tools].sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));

  const entriesHtml = sorted
    .map((tool) => {
      const commitsHtml =
        tool.commits.length > 0
          ? `<ul class="commit-list">
              ${tool.commits
                .map(
                  (c) =>
                    `<li>
                      <a href="${REPO_URL}/commit/${c.hash}" class="commit-hash">${c.shortHash}</a>
                      <span class="commit-date">${escapeHtml(c.dateJst)}</span>
                      <span class="commit-subject">${escapeHtml(c.subject)}</span>
                    </li>`
                )
                .join("\n")}
            </ul>`
          : `<p class="commit-empty">Git履歴取得前（ローカルビルド）</p>`;

      return `
      <section class="colophon-entry" id="${escapeHtml(tool.filename)}">
        <div class="colophon-header">
          <div>
            <h2><a href="./${encodeURIComponent(tool.filename)}">${escapeHtml(tool.title)}</a></h2>
            <div class="colophon-links">
              <a href="./${encodeURIComponent(tool.filename)}">ツールを開く →</a>
              <span>·</span>
              <a href="${REPO_URL}/blob/main/${encodeURIComponent(tool.filename)}">${escapeHtml(tool.filename)}</a>
              <span>·</span>
              <a href="${REPO_URL}/blob/main/${encodeURIComponent(tool.docsFilename)}">${escapeHtml(tool.docsFilename)}</a>
            </div>
          </div>
          <div class="colophon-tags">
            ${tool.tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>
        <div class="docs-body">
          ${tool.docsHtml}
        </div>
        <div class="commits-box">
          <h3>更新履歴 (JST)</h3>
          ${commitsHtml}
        </div>
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Colophon &amp; Docs — Zen Lab Tools</title>
  <meta name="description" content="tools.zen-lab.dev に収録されている全ツールの解説ドキュメント（.docs.md）とGitコミット履歴">
  <style>
    ${SHARED_CSS}
    .page-header {
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--color-ink-border);
    }
    .page-header h1 {
      font-family: var(--font-mincho);
      font-size: clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem);
      margin: 0 0 8px;
    }
    .page-header p {
      margin: 0;
      color: var(--color-on-surface-variant);
    }
    .colophon-entry {
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-ink-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 24px;
      scroll-margin-top: 24px;
    }
    .colophon-entry:target {
      border-color: var(--color-shu-red);
    }
    .colophon-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--color-ink-border);
    }
    .colophon-header h2 {
      font-family: var(--font-mincho);
      margin: 0 0 6px;
      font-size: 1.35rem;
    }
    .colophon-header h2 a {
      color: var(--color-on-surface);
    }
    .colophon-links {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--color-on-surface-variant);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .colophon-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tag-pill {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--color-primary);
      background: color-mix(in oklab, var(--color-shu-red) 15%, var(--color-surface-container-lowest));
      border: 1px solid color-mix(in oklab, var(--color-shu-red) 35%, transparent);
      padding: 2px 8px;
      border-radius: 999px;
    }
    .docs-body {
      padding: 16px 0;
      font-size: 0.95rem;
    }
    .docs-body h3, .docs-body h4 {
      font-family: var(--font-mincho);
      margin: 16px 0 8px;
    }
    .docs-body p, .docs-body ul {
      margin: 8px 0;
    }
    .docs-body code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      background: var(--color-surface-container-lowest);
      padding: 2px 5px;
      border-radius: var(--radius-sm);
    }
    .commits-box {
      background: var(--color-surface-container-lowest);
      border: 1px solid var(--color-ink-border);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      margin-top: 8px;
    }
    .commits-box h3 {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-on-surface-variant);
      margin: 0 0 10px;
    }
    .commit-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 0.8rem;
    }
    .commit-list li {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: baseline;
    }
    .commit-hash {
      color: var(--color-shu-red);
    }
    .commit-date {
      color: var(--color-on-surface-variant);
    }
    .commit-subject {
      color: var(--color-on-surface);
    }
    .commit-empty {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--color-on-surface-variant);
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <a href="./" class="brand">
        <span class="brand-seal"><span>禅</span></span>
        <span>Zen Lab Tools</span>
      </a>
      <nav class="nav-links" aria-label="サイトナビゲーション">
        <a href="./">Tools (${tools.length})</a>
        <a href="./colophon.html" aria-current="page">Colophon &amp; Docs</a>
        <a href="https://zen-lab.dev">zen-lab.dev</a>
        <a href="${REPO_URL}">GitHub</a>
      </nav>
    </div>
  </header>
  <main>
    <div class="page-header">
      <h1>Colophon &amp; Tool Documentation</h1>
      <p>各ツールの解説ドキュメント（<code>*.docs.md</code>）と Git コミット履歴（日本標準時 JST）の一覧です。</p>
    </div>
    ${entriesHtml}
  </main>
  <footer class="site-footer">
    <p><a href="./">← ツール一覧へ戻る</a> · <a href="https://zen-lab.dev">zen-lab.dev</a></p>
  </footer>
</body>
</html>`;
}

function renderReadme(tools: ToolEntry[]): string {
  const sorted = [...tools].sort((a, b) => a.slug.localeCompare(b.slug));
  const rows = sorted
    .map(
      (t) =>
        `| [**${t.title}**](https://tools.zen-lab.dev/${t.filename}) (\`${t.slug}\`) | ${t.description} | ${t.tags.join(", ")} | [Docs](./${t.docsFilename}) |`
    )
    .join("\n");

  return `# tools.zen-lab.dev

[**https://tools.zen-lab.dev**](https://tools.zen-lab.dev) — ブラウザ完結で動作する単一 HTML ミニツール・実験集。

## 収録ツール一覧 (${tools.length})

| ツール | 概要 | タグ | 解説 |
| :--- | :--- | :--- | :--- |
${rows}

## 開発コマンド

\`\`\`bash
# バリデーション（HTMLメタデータ・JS構文・.docs.md 検査）
bun test

# 静的サイト生成（dist/ 出力 & README.md 更新）
bun run build
\`\`\`
`;
}

function main() {
  mkdirSync(DIST_DIR, { recursive: true });
  const tools = collectTools();

  for (const tool of tools) {
    copyFileSync(join(ROOT_DIR, tool.filename), join(DIST_DIR, tool.filename));
    if (existsSync(join(ROOT_DIR, tool.docsFilename))) {
      copyFileSync(join(ROOT_DIR, tool.docsFilename), join(DIST_DIR, tool.docsFilename));
    }
  }

  if (existsSync(join(ROOT_DIR, "CNAME"))) {
    copyFileSync(join(ROOT_DIR, "CNAME"), join(DIST_DIR, "CNAME"));
  }
  writeFileSync(join(DIST_DIR, ".nojekyll"), "", "utf-8");
  writeFileSync(join(DIST_DIR, "tools.json"), JSON.stringify(tools, null, 2), "utf-8");
  writeFileSync(join(DIST_DIR, "index.html"), renderIndexHtml(tools), "utf-8");
  writeFileSync(join(DIST_DIR, "colophon.html"), renderColophonHtml(tools), "utf-8");
  writeFileSync(join(ROOT_DIR, "README.md"), renderReadme(tools), "utf-8");

  console.log(`Built ${tools.length} tools into dist/ and updated README.md`);
}

main();
