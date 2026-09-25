import { cp, mkdir, readdir, rm } from "node:fs/promises";
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
  "_headers",
  "assets",
  "css",
  "js",
  "data",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of publicEntries) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

const files = await readdir(output, { recursive: true });
console.log(`Built ${files.length} files into ${path.relative(root, output)}.`);
