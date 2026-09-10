import { readFile, access, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { buildRules, normalizeSettings, catalog, normalizeDomain } from "../src/core.mjs";
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
const files = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(s => s.js), ...manifest.web_accessible_resources.flatMap(r => r.resources)];
for (const path of files) await access(join(root, path));
for (const folder of ["src", "pages", "scripts", "tests"]) for (const file of await readdir(join(root, folder))) {
  if (!/\.m?js$/.test(file)) continue;
  const result = spawnSync(process.execPath, ["--check", join(root, folder, file)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}
for (const category of catalog) for (const service of category.services) for (const domain of service[1]) assert.equal(normalizeDomain(domain), domain);
const rules = buildRules(normalizeSettings());
assert.equal(new Set(rules.map(r => r.id)).size, rules.length);
for (const html of ["popup.html", "options.html", "blocked.html"]) {
  const content = await readFile(join(root, "pages", html), "utf8");
  assert(!/\bon\w+=/i.test(content), "No inline event handlers allowed by MV3 CSP");
  for (const [, file] of content.matchAll(/(?:src|href)="([^"#]+\.(?:css|js|html))"/g)) await access(join(root, "pages", file));
}
console.log(`Manifest, local assets, JavaScript syntax, ${catalog.flatMap(c => c.services).length} services, and rules verified.`);
