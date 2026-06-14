import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = pkg.version;

const readmePath = resolve(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const updated = readme.replace(
  /(@tim-hilde\/opencode-insights@)[^"'`\s]+/g,
  `$1${version}`,
);

if (updated !== readme) {
  writeFileSync(readmePath, updated);
  console.log(`README.md: updated version to ${version}`);
} else {
  console.log(`README.md: already at ${version}, no change`);
}
