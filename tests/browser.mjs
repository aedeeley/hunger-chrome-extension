import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(import.meta.dirname, "..");
await mkdir(join(root, "test-results"), { recursive: true });
const profile = await mkdtemp(join(root, "test-results", "profile-"));
const fixture = await readFile(join(root, "tests", "fixture.html"));
const server = createServer((request, response) => { response.setHeader("Content-Type", "text/html"); response.end(fixture); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
let context;
const checks = [];
const errors = [];
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
async function waitFor(test, label) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 80)); }
  throw new Error(`Timed out: ${label}`);
}
try {
  context = await chromium.launchPersistentContext(profile, {
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : { channel: "chromium" }),
    headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    viewport: { width: 1280, height: 900 },
  });
  context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const base = `chrome-extension://${extensionId}/pages/`;
  const options = await context.newPage();
  await options.goto(base + "options.html");
  await waitFor(() => options.locator("#enabled").isEnabled(), "extension initialization");
  const rpc = (type, extra = {}) => options.evaluate(async ({ type, extra }) => {
    const response = await chrome.runtime.sendMessage({ type, ...extra });
    if (!response?.ok) throw new Error(response?.error || "RPC failed");
    return response;
  }, { type, extra });
  const defaults = (await rpc("GET_STATE")).settings;
  const rules = await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
  assert(rules.length >= 2);
  pass("Manifest V3 loads and Chrome accepts network rules");

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const hidden = id => page.locator(`#${id}`).evaluate(el => getComputedStyle(el).display === "none");
  await waitFor(() => hidden("ad"), "ad card hidden");
  for (const id of ["split", "name", "promotion", "redirect", "image", "nav-food"]) assert(await hidden(id), `${id} should be hidden`);
  for (const id of ["safe", "main", "form", "input", "textarea", "editor", "nav", "nav-safe", "grocery", "kit"]) assert(!(await hidden(id)), `${id} should remain`);
  pass("Hides ads, names, split text, redirects, and image labels; preserves unrelated content and inputs");

  await page.evaluate(() => {
    document.querySelector("#dynamic").innerHTML = '<article id="dynamic-ad"><span>DoorDash</span></article><p id="changing">Safe text</p>';
    document.querySelector("#shadow-host").attachShadow({ mode: "open" }).innerHTML = '<p id="shadow-ad">Uber Eats offer</p><p id="shadow-safe">Normal content</p>';
  });
  await waitFor(() => hidden("dynamic-ad"), "dynamic ad");
  await waitFor(() => hidden("shadow-ad"), "shadow ad");
  assert(!(await hidden("shadow-safe")));
  await page.locator("#changing").evaluate(el => { el.firstChild.nodeValue = "Order food today"; });
  await waitFor(() => hidden("changing"), "changed text");
  await page.locator("#dynamic-ad").evaluate(el => { el.innerHTML = '<span>A normal recycled card</span>'; });
  await waitFor(async () => !(await hidden("dynamic-ad")), "recycled ad restored");
  await page.locator("#changing").evaluate(el => { el.firstChild.nodeValue = "Normal content now"; });
  await waitFor(async () => !(await hidden("changing")), "changed text restored");
  pass("Mutation filtering, shadow DOM, and recycled feed cards work");

  await options.screenshot({ path: join(root, "test-results", "options.png"), fullPage: true, animations: "disabled" });
  const popup = await context.newPage(); await popup.setViewportSize({ width: 372, height: 700 });
  await popup.goto(base + "popup.html");
  await waitFor(() => popup.locator("#blockSites").isEnabled(), "popup ready");
  for (const key of ["blockSites", "hideMentions", "hidePromotions"]) assert(await popup.locator(`#${key}`).isChecked(), `popup ${key} reflects saved state`);
  await popup.locator("#hideMentions").uncheck();
  await waitFor(async () => !(await hidden("name")), "popup toggle restores mentions");
  assert(await hidden("promotion"));
  await popup.locator("#hideMentions").check();
  await waitFor(() => hidden("name"), "popup toggle re-hides mentions");
  const popupHeight = await popup.evaluate(() => document.body.getBoundingClientRect().height);
  assert(popupHeight <= 600, `popup fits Chrome's 600px height cap (actual: ${popupHeight})`);
  await popup.setViewportSize({ width: 372, height: Math.ceil(popupHeight) });
  await popup.screenshot({ path: join(root, "test-results", "popup.png"), fullPage: true, animations: "disabled" });
  await popup.close();
  pass("Options and popup render without page errors");

  await rpc("PAUSE");
  await waitFor(async () => !(await hidden("ad")), "pause restores content");
  assert(!(await hidden("shadow-ad")));
  assert.equal((await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).length, 0);
  assert((await worker.evaluate(() => chrome.alarms.get("resume"))).scheduledTime > Date.now());
  await rpc("RESUME");
  await waitFor(() => hidden("ad"), "resume refilters content");
  pass("Pause removes rules and restores content; resume re-enables both");

  await rpc("UPDATE_SETTINGS", { patch: { pauseUntil: Date.now() + 900 } });
  await waitFor(async () => (await rpc("GET_STATE")).settings.pauseUntil === 0, "automatic alarm resume");
  await waitFor(() => hidden("ad"), "automatic filter resume");
  assert((await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).length > 0);
  pass("Timed pause automatically restores network blocking and filtering");

  await options.locator("#category-groceries").check();
  await waitFor(() => hidden("grocery"), "grocery category");
  await waitFor(() => options.locator("#keyword-form button").isEnabled(), "save complete");
  await options.locator("#keyword-input").fill("Local Delivery Company");
  await options.locator("#keyword-form button").click();
  await waitFor(() => hidden("custom-name"), "custom phrase");
  await waitFor(() => options.locator("#domain-form button").isEnabled(), "save complete");
  await options.locator("#domain-input").fill("customfood.example");
  await options.locator("#domain-form button").click();
  await waitFor(async () => (await rpc("GET_STATE")).settings.customDomains.includes("customfood.example"), "custom domain");
  await options.reload();
  await waitFor(() => options.getByLabel("Remove customfood.example").isVisible(), "saved domain persists");
  await options.getByLabel("Remove local delivery company").click();
  await waitFor(async () => !(await hidden("custom-name")), "removed phrase restores content");
  pass("Category switches and custom additions save, persist, and remove correctly");

  await waitFor(() => options.locator("#domain-form button").isEnabled(), "save complete");
  await options.locator("#domain-input").fill("example.com/path");
  await options.locator("#domain-form button").click();
  await waitFor(() => options.locator("#message[data-kind='error']").isVisible(), "invalid domain rejected");
  assert(!(await rpc("GET_STATE")).settings.customDomains.includes("example.com/path"));
  pass("Invalid custom domains fail without changing existing protection");

  const blocked = await context.newPage();
  await blocked.goto("https://www.doordash.com/", { waitUntil: "domcontentloaded" });
  assert.equal(blocked.url(), base + "blocked.html");
  await blocked.screenshot({ path: join(root, "test-results", "blocked.png"), fullPage: true });
  await blocked.goto("https://customfood.example/", { waitUntil: "domcontentloaded" });
  assert.equal(blocked.url(), base + "blocked.html");
  await blocked.goto("https://www.uber.com/us/en/eats/", { waitUntil: "domcontentloaded" });
  assert.equal(blocked.url(), base + "blocked.html");
  pass("Actual navigations to delivery, custom domains, and shared-domain ordering routes are redirected");

  const failedRequest = page.waitForEvent("requestfailed", request => request.url() === "https://www.doordash.com/hunger-test");
  const resource = await page.evaluate(async () => { try { await fetch("https://www.doordash.com/hunger-test", { mode: "no-cors" }); return "loaded"; } catch { return "blocked"; } });
  assert.equal(resource, "blocked");
  assert.equal((await failedRequest).failure().errorText, "net::ERR_BLOCKED_BY_CLIENT");
  pass("Requests to blocked service domains fail");

  await rpc("UPDATE_SETTINGS", { patch: { enabled: false } });
  await waitFor(async () => !(await hidden("ad")), "disabled content restored");
  assert.equal((await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).length, 0);
  await rpc("UPDATE_SETTINGS", { patch: defaults });
  await options.setViewportSize({ width: 390, height: 844 });
  assert(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile options should not overflow");
  await options.screenshot({ path: join(root, "test-results", "options-mobile.png"), fullPage: true });
  pass("Master switch restores pages and narrow settings layout fits");
  assert.deepEqual(errors, [], "no uncaught page errors");
  await writeFile(join(root, "test-results", "browser-results.json"), JSON.stringify({ checks, errors }, null, 2));
  console.log(`\n${checks.length} browser checks passed.`);
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
}
