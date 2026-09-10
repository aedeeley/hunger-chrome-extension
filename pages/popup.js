import { request, showError, showSaved, paintStatus } from "./ui.js";
let state;
const controls = ["blockSites", "hideMentions", "hidePromotions"];
function render(data) {
  state = data;
  paintStatus(state.settings);
  document.querySelector("#domain-count").textContent = state.coverage.domains.length;
  for (const key of controls) { const input = document.getElementById(key); input.checked = state.settings[key]; input.disabled = false; }
  const pause = document.querySelector("#pause");
  pause.disabled = false;
  pause.textContent = state.active ? "Pause for 15 minutes" : "Resume protection";
}
for (const key of controls) document.getElementById(key).addEventListener("change", async event => {
  const checked = event.target.checked;
  event.target.disabled = true;
  try { render(await request("UPDATE_SETTINGS", { patch: { [key]: checked } })); showSaved("Saved."); }
  catch (error) { if (state) render(state); showError(error); }
});
document.querySelector("#pause").addEventListener("click", async event => {
  event.target.disabled = true;
  try { render(await request(state.active ? "PAUSE" : "RESUME")); showSaved(state.active ? "Protection resumed." : "Protection will resume automatically."); }
  catch (error) { if (state) render(state); showError(error); }
});
document.querySelector("#manage").addEventListener("click", () => chrome.runtime.openOptionsPage());
async function pageStats() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_STATS" }, { frameId: 0 });
    document.querySelector("#hidden-count").textContent = response.hidden;
  } catch { document.querySelector("#hidden-count").textContent = "—"; document.querySelector("#hidden-count").title = "Unavailable on this page. Refresh tabs opened before installation."; }
}
request("GET_STATE").then(render).catch(showError);
pageStats();
chrome.storage?.onChanged.addListener((changes, area) => { if (area === "local" && changes.settings) { request("GET_STATE").then(render).catch(showError); pageStats(); } });
