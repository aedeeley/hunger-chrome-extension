import { catalog } from "../src/core.mjs";
import { request, showError, showSaved, paintStatus } from "./ui.js";
let state;
let busy = false;
const fields = ["enabled", "blockSites", "hideMentions", "hidePromotions"];
const categories = document.querySelector("#categories");
for (const category of catalog) {
  const label = document.createElement("label"); label.className = "category-card";
  const labelText = document.createElement("span");
  const title = document.createElement("strong"); title.textContent = category.name;
  const description = document.createElement("small"); description.textContent = category.description;
  const count = document.createElement("span"); count.className = "category-count"; count.textContent = `${category.services.length} services`;
  labelText.append(title, description, count);
  const input = document.createElement("input"); input.type = "checkbox"; input.id = `category-${category.id}`; input.disabled = true;
  const visual = document.createElement("span"); visual.className = "check"; visual.setAttribute("aria-hidden", "true");
  label.append(labelText, input, visual); categories.append(label);
  input.addEventListener("change", () => save({ categories: { [category.id]: input.checked } }));
}
function setBusy(value) {
  busy = value;
  for (const element of document.querySelectorAll("button,input[type='checkbox']")) element.disabled = value;
}
function render(data) {
  state = data; paintStatus(state.settings);
  for (const key of fields) document.getElementById(key).checked = state.settings[key];
  for (const category of catalog) document.getElementById(`category-${category.id}`).checked = state.settings.categories[category.id];
  document.querySelector("#pause").textContent = state.active ? "Pause for 15 minutes" : "Resume protection";
  document.querySelector("#coverage-count").textContent = `${state.coverage.domains.length} domains covered`;
  renderChips("customDomains", "#custom-domains"); renderChips("customKeywords", "#custom-keywords"); renderServices();
}
async function save(patch) {
  if (busy || !state) return false;
  setBusy(true);
  try { render(await request("UPDATE_SETTINGS", { patch })); showSaved(); return true; }
  catch (error) { render(state); showError(error); return false; }
  finally { setBusy(false); }
}
function renderChips(key, selector) {
  const container = document.querySelector(selector); container.replaceChildren();
  if (!state.settings[key].length) { const empty = document.createElement("p"); empty.className = "empty-text"; empty.textContent = "Nothing added yet. A fresh start."; container.append(empty); }
  for (const value of state.settings[key]) {
    const chip = document.createElement("span"); chip.className = "chip";
    const text = document.createElement("span"); text.textContent = value;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove ${value}`); remove.disabled = busy;
    remove.addEventListener("click", () => save({ [key]: state.settings[key].filter(item => item !== value) }));
    chip.append(text, remove); container.append(chip);
  }
}
function renderServices() {
  const query = document.querySelector("#service-search").value.toLowerCase();
  const container = document.querySelector("#service-list"); container.replaceChildren();
  for (const category of catalog) for (const service of category.services) {
    if (!service.flat(2).join(" ").toLowerCase().includes(query)) continue;
    const row = document.createElement("div"); row.className = "service-row";
    const name = document.createElement("strong"); name.textContent = service[0];
    const domains = document.createElement("small"); domains.textContent = service[1].join(", ");
    const status = document.createElement("span"); status.className = "service-status"; status.textContent = state?.settings.categories[category.id] ? "Included" : "Off";
    row.append(name, domains, status); container.append(row);
  }
  if (!container.childElementCount) container.textContent = "No matching service. You can add a website below.";
}
for (const key of fields) document.getElementById(key).addEventListener("change", event => save({ [key]: event.target.checked, ...(key === "enabled" ? { pauseUntil: 0 } : {}) }));
for (const [formId, inputId, key] of [["domain-form", "domain-input", "customDomains"], ["keyword-form", "keyword-input", "customKeywords"]]) {
  document.getElementById(formId).addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById(inputId);
    if (await save({ [key]: [...state.settings[key], input.value] })) input.value = "";
    input.focus();
  });
}
document.querySelector("#service-search").addEventListener("input", renderServices);
document.querySelector("#pause").addEventListener("click", async () => {
  setBusy(true);
  try { render(await request(state.active ? "PAUSE" : "RESUME")); showSaved(state.active ? "Protection resumed." : "Paused for 15 minutes. Hunger will resume automatically."); }
  catch (error) { showError(error); }
  finally { setBusy(false); }
});
request("GET_STATE").then(data => { render(data); setBusy(false); }).catch(showError);
chrome.storage?.onChanged.addListener((changes, area) => { if (area === "local" && changes.settings && !busy) request("GET_STATE").then(render).catch(showError); });
