import { normalizeSettings, isActive, buildRules, getCoverage } from "./core.mjs";

let queue = Promise.resolve();
function serialize(work) {
  const task = queue.then(work);
  queue = task.catch(() => {});
  return task;
}
async function readSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return normalizeSettings(settings);
}
async function installRules(settings) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map(r => r.id), addRules: buildRules(settings) });
}
async function updateStatus(settings) {
  const active = isActive(settings);
  await chrome.action.setBadgeText({ text: active ? "" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: "#776a55" });
  await chrome.action.setTitle({ title: active ? "Hunger — protection active" : "Hunger — protection paused" });
  await chrome.alarms.clear("resume");
  if (settings.enabled && settings.pauseUntil > Date.now()) await chrome.alarms.create("resume", { when: settings.pauseUntil });
}
async function commit(settings) {
  const previous = await readSettings();
  await installRules(settings);
  try { await chrome.storage.local.set({ settings }); }
  catch (error) { await installRules(previous); throw error; }
  await updateStatus(settings);
  return { settings, coverage: getCoverage(settings), active: isActive(settings) };
}
async function initialize() {
  const settings = await readSettings();
  if (settings.pauseUntil && settings.pauseUntil <= Date.now()) settings.pauseUntil = 0;
  await commit(settings);
}
function report(error) { console.error("Hunger:", error); }
chrome.runtime.onInstalled.addListener(() => { serialize(initialize).catch(report); });
chrome.runtime.onStartup.addListener(() => { serialize(initialize).catch(report); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "resume") serialize(initialize).catch(report);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only our extension pages may change protection. Web content has no settings RPC.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL("pages/"))) return;
  const operation = serialize(async () => {
    const settings = await readSettings();
    if (message?.type === "GET_STATE") return { settings, coverage: getCoverage(settings), active: isActive(settings) };
    if (message?.type === "UPDATE_SETTINGS") {
      const patch = message.patch ?? {};
      return commit(normalizeSettings({ ...settings, ...patch, categories: { ...settings.categories, ...patch.categories } }));
    }
    if (message?.type === "PAUSE") return commit({ ...settings, pauseUntil: Date.now() + 15 * 60 * 1000 });
    if (message?.type === "RESUME") return commit({ ...settings, enabled: true, pauseUntil: 0 });
    throw new Error("Unknown request.");
  });
  operation.then(data => sendResponse({ ok: true, ...data }), error => sendResponse({ ok: false, error: error.message }));
  return true;
});

// A worker can start after extension re-enable or an alarm was cleared.
// Reconcile persisted rules and recreate the pause alarm on every fresh worker.
serialize(initialize).catch(report);
