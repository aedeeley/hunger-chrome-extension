import { isActive } from "../src/core.mjs";
export async function request(type, extra = {}) {
  if (!globalThis.chrome?.runtime?.id) throw new Error("Load Hunger as an unpacked Chrome extension to use these controls.");
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.error || "Couldn't reach Hunger. Reload the extension and try again.");
  return response;
}
export function showError(error) {
  const element = document.querySelector("#message");
  element.textContent = error.message || String(error);
  element.dataset.kind = "error";
}
export function showSaved(text = "Changes saved. Protection is up to date.") {
  const element = document.querySelector("#message");
  element.textContent = text;
  element.dataset.kind = "success";
}
export function statusText(settings) {
  if (!settings.enabled) return "Protection is off";
  if (settings.pauseUntil > Date.now()) return `Paused until ${new Date(settings.pauseUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return "Protection is on";
}
export function paintStatus(settings) {
  const enabled = isActive(settings);
  const badge = document.querySelector("#status");
  if (badge) { badge.textContent = statusText(settings); badge.classList.toggle("is-paused", !enabled); }
  document.body.classList.toggle("paused", !enabled);
}
