import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = import.meta.dir;
const htmlFiles = readdirSync(ROOT_DIR)
  .filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "colophon.html")
  .sort();

const transpiler = new Bun.Transpiler({ loader: "js" });

describe("tools validation", () => {
  test("at least one tool exists", () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
  });

  for (const filename of htmlFiles) {
    const slug = filename.replace(/\.html$/, "");
    const docsFilename = `${slug}.docs.md`;

    test(`${filename}: required HTML metadata & valid inline scripts`, () => {
      const content = readFileSync(join(ROOT_DIR, filename), "utf-8");
      expect(content).toMatch(/<!DOCTYPE html>/i);
      expect(content).toMatch(/<html[^>]+lang=["']ja["']/i);
      expect(content).toMatch(/<title>.+<\/title>/i);
      expect(content).toMatch(/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i);
      expect(content).not.toMatch(/fonts\.googleapis\.com/i);

      // Extract inline <script> blocks (without src="...") and syntax-check with Bun.Transpiler
      const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      let scriptCount = 0;
      while ((match = scriptRegex.exec(content)) !== null) {
        scriptCount++;
        const code = match[1];
        expect(() => transpiler.transformSync(code)).not.toThrow();
      }
      expect(scriptCount).toBeGreaterThan(0);
    });

    test(`${docsFilename}: companion docs file exists with tags and description`, () => {
      const docsPath = join(ROOT_DIR, docsFilename);
      expect(existsSync(docsPath)).toBe(true);
      const docs = readFileSync(docsPath, "utf-8");
      expect(docs).toMatch(/^---\r?\n[\s\S]*?tags:[\s\S]*?\r?\n---\r?\n/);
      const body = docs.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
      expect(body.length).toBeGreaterThan(20);
    });
  }
});
