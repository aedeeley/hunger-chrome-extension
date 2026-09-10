(() => {
  const catalog = globalThis.HungerCatalog;
  const DEFAULTS = {
    enabled: true, blockSites: true, hideMentions: true, hidePromotions: true,
    pauseUntil: 0,
    categories: { delivery: true, restaurants: true, groceries: false, mealKits: false },
    customDomains: [], customKeywords: [],
  };
  const PROMOTIONS = ["order food", "food delivery", "meal delivery", "order takeout", "order takeaway", "order delivery", "get food delivered"];
  const PATH_RULES = [{ category: "delivery", domain: "uber.com", pattern: "^https?://([a-z0-9-]+\\.)*uber\\.com/([^/?#]+/)*eats([/?#]|$)" }];

  function normalizeDomain(value) {
    if (typeof value !== "string") throw new Error("Enter a domain such as example.com.");
    const input = value.trim();
    if (!input || /[\s*]/u.test(input)) throw new Error("Use a domain without spaces or wildcards.");
    let url;
    try { url = new URL(input.includes("://") ? input : `https://${input}`); }
    catch { throw new Error(`Invalid domain: ${input}`); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Enter just the domain (example.com), without a path, port, or query.");
    }
    const domain = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (domain.length > 253 || !domain.includes(".") || !domain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /^\d+(\.\d+){3}$/.test(domain)) {
      throw new Error(`Invalid website domain: ${input}`);
    }
    return domain;
  }
  function unique(values) { return [...new Set(values)]; }
  function normalizeSettings(input = {}) {
    const result = structuredClone(DEFAULTS);
    for (const key of ["enabled", "blockSites", "hideMentions", "hidePromotions"]) {
      if (typeof input[key] === "boolean") result[key] = input[key];
    }
    for (const category of catalog) {
      if (typeof input.categories?.[category.id] === "boolean") result.categories[category.id] = input.categories[category.id];
    }
    if (Number.isFinite(input.pauseUntil) && input.pauseUntil > 0) result.pauseUntil = input.pauseUntil;
    if (Array.isArray(input.customDomains)) {
      if (input.customDomains.length > 200) throw new Error("You can add up to 200 custom domains.");
      result.customDomains = unique(input.customDomains.map(normalizeDomain));
    }
    if (Array.isArray(input.customKeywords)) {
      if (input.customKeywords.length > 200) throw new Error("You can add up to 200 custom phrases.");
      result.customKeywords = unique(input.customKeywords.map(value => {
        if (typeof value !== "string") throw new Error("Phrases must be text.");
        const phrase = value.trim().replace(/\s+/gu, " ");
        if (phrase.length < 2 || phrase.length > 80) throw new Error("Each phrase must be 2–80 characters.");
        return phrase.toLowerCase();
      }));
    }
    return result;
  }
  function isActive(settings, now = Date.now()) { return settings.enabled && settings.pauseUntil <= now; }
  function getCoverage(settings) {
    const services = catalog.filter(c => settings.categories[c.id]).flatMap(c => c.services);
    return {
      services: services.length,
      domains: unique([...services.flatMap(s => s[1]), ...settings.customDomains]),
      keywords: unique([...services.flatMap(s => s[2]), ...settings.customKeywords]),
    };
  }
  function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function phraseRegex(phrases) {
    if (!phrases.length) return null;
    const patterns = unique(phrases).sort((a, b) => b.length - a.length).map(phrase =>
      escapeRegex(phrase.normalize("NFKC")).replace(/['’]/g, "['’]").replace(/\s+/gu, "[\\s\\u200B-\\u200D]*"));
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${patterns.join("|")})(?=$|[^\\p{L}\\p{N}])`, "iu");
  }
  function createMatcher(settings) {
    const coverage = getCoverage(settings);
    const domainSet = new Set(coverage.domains);
    const mentionRegex = phraseRegex([...coverage.keywords, ...coverage.domains]);
    const promotionRegex = phraseRegex(PROMOTIONS);
    const pathRules = PATH_RULES.filter(rule => settings.categories[rule.category]).map(rule => new RegExp(rule.pattern, "i"));
    function matchesHost(hostname) {
      const labels = hostname.toLowerCase().replace(/\.$/, "").split(".");
      while (labels.length > 1) {
        if (domainSet.has(labels.join("."))) return true;
        labels.shift();
      }
      return false;
    }
    function matchesURL(value, base = "https://invalid.local") {
      if (!value || typeof value !== "string") return false;
      try {
        const url = new URL(value, base);
        if (/^https?:$/.test(url.protocol) && (matchesHost(url.hostname) || pathRules.some(rule => rule.test(url.href)))) return true;
        if (settings.categories.delivery && /^(ubereats|doordash|grubhub|postmates):$/i.test(url.protocol)) return true;
        // App-store and advertising redirects often encode a destination URL.
        for (const [key, target] of url.searchParams) {
          if (/^(url|q|adurl|redirect|redirect_url|redirect_uri|target|destination|u|link)$/i.test(key)) {
            let decoded = target;
            for (let pass = 0; pass < 2; pass++) {
              if (/^https?:\/\//i.test(decoded)) {
                try { const nested = new URL(decoded); if (matchesHost(nested.hostname) || pathRules.some(rule => rule.test(nested.href))) return true; } catch { /* Not a destination URL. */ }
              }
              try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
            }
          }
        }
        if (url.hostname === "play.google.com" && settings.categories.delivery && ["com.ubercab.eats", "com.dd.doordash", "com.grubhub.android"].includes(url.searchParams.get("id"))) return true;
        if (/^(apps\.apple\.com|play\.google\.com)$/.test(url.hostname)) return Boolean(mentionRegex?.test(decodeURIComponent(url.pathname + url.search).replace(/[_.-]/g, " ")));
      } catch { /* Malformed URLs are ignored. */ }
      return false;
    }
    function matchesText(text) {
      const normalized = String(text).normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
      return Boolean((settings.hideMentions && mentionRegex?.test(normalized)) || (settings.hidePromotions && promotionRegex.test(normalized)));
    }
    return { matchesHost, matchesURL, matchesText, coverage };
  }
  function buildRules(settings, now = Date.now()) {
    if (!isActive(settings, now) || !settings.blockSites) return [];
    const domains = getCoverage(settings).domains;
    const conditions = domains.length ? [{ requestDomains: domains }] : [];
    for (const rule of PATH_RULES) if (settings.categories[rule.category]) conditions.push({ regexFilter: rule.pattern });
    return conditions.flatMap((condition, index) => [
      { id: index * 2 + 1, priority: 1, action: { type: "redirect", redirect: { extensionPath: "/pages/blocked.html" } }, condition: { ...condition, resourceTypes: ["main_frame"] } },
      { id: index * 2 + 2, priority: 1, action: { type: "block" }, condition: { ...condition, excludedResourceTypes: ["main_frame"] } },
    ]);
  }
  globalThis.HungerCore = { DEFAULTS, catalog, PROMOTIONS, normalizeDomain, normalizeSettings, isActive, getCoverage, createMatcher, buildRules };
})();
