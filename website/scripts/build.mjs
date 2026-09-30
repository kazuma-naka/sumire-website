import { access, cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const publicEntries = [
  "index.html",
  "features.html",
  "settings.html",
  "requests.html",
  "review.html",
  "en",
  "_headers",
  "assets",
  "css",
  "js",
  "data",
];

// A static copy alone succeeds even when a page's JavaScript is missing.
// Check local script references before publishing an incomplete site.
const pages = [
  ...publicEntries.filter(entry => entry.endsWith(".html")),
  ...(await readdir(path.join(root, "en"))).filter(entry => entry.endsWith(".html")).map(entry => `en/${entry}`),
];
for (const page of pages) {
  const html = await readFile(path.join(root, page), "utf8");
  for (const match of html.matchAll(/<script\b[^>]*\bsrc="(\/[^\"]+)"/g)) {
    await access(path.join(root, match[1]));
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of publicEntries) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

const files = await readdir(output, { recursive: true });
console.log(`Built ${files.length} files into ${path.relative(root, output)}.`);
