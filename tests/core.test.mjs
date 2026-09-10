import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, catalog, normalizeDomain, normalizeSettings, isActive, createMatcher, buildRules } from "../src/core.mjs";

test("default coverage includes delivery and restaurants with optional groceries and kits", () => {
  const settings = normalizeSettings(); const matcher = createMatcher(settings);
  assert(matcher.matchesURL("https://www.doordash.com/store/nearby"));
  assert(matcher.matchesURL("https://order.dominos.com/"));
  assert(!matcher.matchesURL("https://instacart.com/"));
  assert(!matcher.matchesURL("https://hellofresh.com/"));
  assert(matcher.coverage.services > 50);
});
test("host boundaries block subdomains, not similarly named sites or plain query mentions", () => {
  const matcher = createMatcher(normalizeSettings());
  assert(matcher.matchesURL("https://offers.doordash.com./"));
  assert(!matcher.matchesURL("https://notdoordash.com/"));
  assert(!matcher.matchesURL("https://doordash.com.example.org/"));
  assert(!matcher.matchesURL("https://example.org/?topic=doordash.com"));
  assert(!matcher.matchesURL("javascript:alert('doordash.com')"));
});
test("food ordering routes on shared Uber domain leave ride pages alone", () => {
  const matcher = createMatcher(normalizeSettings());
  for (const path of ["/eats", "/us/en/eats/", "/gb/en/eats?test=1"]) assert(matcher.matchesURL(`https://www.uber.com${path}`));
  for (const path of ["/us/en/ride/", "/eatsomething", "/rider"]) assert(!matcher.matchesURL(`https://uber.com${path}`));
});
test("redirect links, app stores, and deep links are identified", () => {
  const matcher = createMatcher(normalizeSettings());
  assert(matcher.matchesURL("https://www.google.com/aclk?adurl=https%3A%2F%2Fwww.doordash.com%2F"));
  assert(matcher.matchesURL("https://example.org/?url=https%253A%252F%252Fubereats.com%252F"));
  assert(matcher.matchesURL("https://apps.apple.com/us/app/doordash-food-delivery/id719972451"));
  assert(matcher.matchesURL("https://play.google.com/store/apps/details?id=com.ubercab.eats"));
  assert(matcher.matchesURL("ubereats://home"));
  assert(!matcher.matchesURL("https://example.org/?url=https://doordash.com.evil.test"));
});
test("brand and phrase matching handles Unicode, casing, and spelling variations", () => {
  const matcher = createMatcher(normalizeSettings());
  for (const text of ["Try DOORDASH today", "Uber   Eats", "Uber\u200bEats", "Ｕｂｅｒ Ｅａｔｓ", "Visit McDonald’s", "Get food delivery", "Find doordash.com"]) assert(matcher.matchesText(text), text);
  for (const text of ["toast for breakfast", "a slice of pizza", "a seamless experience", "catch the subway", "a factor of ten", "shipping delivery times", "bigger foodpandas", "myubereatsclone"]) assert(!matcher.matchesText(text), text);
});
test("custom literal phrases cannot introduce regular expressions", () => {
  const matcher = createMatcher(normalizeSettings({ customKeywords: ["A+B", "Local (Food)"] }));
  assert(matcher.matchesText("Try A+B today"));
  assert(matcher.matchesText("Visit Local (Food)!"));
  assert(!matcher.matchesText("Try AAAB today"));
});
test("filters can be switched independently", () => {
  const promotions = createMatcher(normalizeSettings({ hideMentions: false }));
  assert(!promotions.matchesText("DoorDash")); assert(promotions.matchesText("order food"));
  const names = createMatcher(normalizeSettings({ hidePromotions: false }));
  assert(names.matchesText("DoorDash")); assert(!names.matchesText("order food"));
});
test("category changes control both names and domains", () => {
  const matcher = createMatcher(normalizeSettings({ categories: { delivery: false, restaurants: false, groceries: true, mealKits: true } }));
  assert(!matcher.matchesText("DoorDash")); assert(!matcher.matchesURL("https://ubereats.com"));
  assert(matcher.matchesText("Instacart")); assert(matcher.matchesURL("https://hellofresh.com"));
});
test("domain normalization rejects paths, credentials, and rule syntax", () => {
  assert.equal(normalizeDomain("https://WWW.Example.com/"), "example.com");
  assert.equal(normalizeDomain("example.com."), "example.com");
  assert.equal(normalizeDomain("bücher.de"), "xn--bcher-kva.de");
  for (const domain of ["com", "*.example.com", "example.com/path", "example.com?x=1", "https://user:pass@example.com", "example.com:8080", "127.0.0.1", "-example.com", "chrome://settings", "one two.com"]) assert.throws(() => normalizeDomain(domain), domain);
});
test("settings are bounded, normalized, deduplicated, and do not mutate defaults", () => {
  const settings = normalizeSettings({ categories: { delivery: false }, customDomains: ["www.example.com", "example.com"], customKeywords: [" Test food ", "test food"] });
  assert.equal(settings.categories.restaurants, true);
  assert.deepEqual(settings.customDomains, ["example.com"]);
  assert.deepEqual(settings.customKeywords, ["test food"]);
  assert.equal(DEFAULTS.categories.delivery, true);
  assert.throws(() => normalizeSettings({ customKeywords: ["a"] }));
  assert.throws(() => normalizeSettings({ customDomains: Array(201).fill("example.com") }));
});
test("pause expires at the saved timestamp and disabled state takes precedence", () => {
  const settings = normalizeSettings({ pauseUntil: 1000 });
  assert.equal(isActive(settings, 999), false); assert.equal(isActive(settings, 1000), true);
  assert.equal(isActive({ ...settings, enabled: false }, 2000), false);
  assert.deepEqual(buildRules(settings, 999), []); assert(buildRules(settings, 1000).length);
});
test("network rules split navigation redirects from blocked resources and respect disabling", () => {
  const rules = buildRules(normalizeSettings());
  assert.deepEqual(rules[0].condition.resourceTypes, ["main_frame"]);
  assert.equal(rules[0].action.type, "redirect");
  assert.equal(rules[1].action.type, "block");
  assert.deepEqual(rules[1].condition.excludedResourceTypes, ["main_frame"]);
  assert(rules[0].condition.requestDomains.includes("doordash.com"));
  assert.deepEqual(buildRules(normalizeSettings({ enabled: false })), []);
  assert.deepEqual(buildRules(normalizeSettings({ blockSites: false })), []);
  const categories = Object.fromEntries(catalog.map(c => [c.id, false]));
  assert.deepEqual(buildRules(normalizeSettings({ categories })), []);
  const custom = buildRules(normalizeSettings({ categories, customDomains: ["localfood.example"] }));
  assert.deepEqual(custom[0].condition.requestDomains, ["localfood.example"]);
});
