(() => {
  if (globalThis.__hungerInstalled) return;
  globalThis.__hungerInstalled = true;
  const { normalizeSettings, isActive, createMatcher } = globalThis.HungerCore;
  const SKIP = "script,style,noscript,template,textarea,input,select,option,[contenteditable]:not([contenteditable='false']),[role='textbox']";
  const STRUCTURAL = "html,body,main,nav,header,footer,form,[role='main'],[role='navigation'],[role='feed'],[role='list'],[role='listbox']";
  const CARDS = "article,li,[role='article'],[role='listitem'],[data-ad],.ads-ad,.ad-container,.sponsored,.search-result,.g,ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-ad-slot-renderer,[data-testid='tweet'],[data-testid='placementTracking'],shreddit-post";
  const INLINE_TEXT = "a,p,span,button,label,h1,h2,h3,h4,h5,h6,figcaption,summary";
  const hidden = new Map();
  const observers = new Map();
  const dirty = new Set();
  let settings, matcher, timer, resumeTimer, sweepTimer;
  let active = false;

  function parentElement(element) { return element.parentElement || element.getRootNode()?.host || null; }
  function isEditable(element) {
    for (let current = element; current; current = parentElement(current)) if (current.matches?.(SKIP)) return true;
    return false;
  }
  function restore(element) {
    const previous = hidden.get(element);
    if (!previous) return;
    // Do not overwrite a site's subsequent, intentional display change.
    if (element.style.getPropertyValue("display") === "none" && element.style.getPropertyPriority("display") === "important") {
      if (previous.value) element.style.setProperty("display", previous.value, previous.priority);
      else element.style.removeProperty("display");
    }
    element.removeAttribute("data-hunger-hidden");
    hidden.delete(element);
  }
  function restoreAll() { for (const element of hidden.keys()) restore(element); }
  function safeTarget(element) {
    if (!element || element.matches(STRUCTURAL) || isEditable(element)) return null;
    let target = element;
    for (let ancestor = element, depth = 0; ancestor && depth < 6; ancestor = ancestor.parentElement, depth++) {
      if (ancestor.matches(STRUCTURAL)) break;
      if (ancestor.matches(CARDS) && ancestor.textContent.length <= 6000 && !ancestor.querySelector(`${SKIP},main,nav,form`)) {
        target = ancestor;
        break;
      }
    }
    // Avoid removing an editor or a page's primary controls through a wrapper.
    if (target.querySelector(`${SKIP},main,nav,form`)) return null;
    return target;
  }
  function hide(element) {
    const target = safeTarget(element);
    if (!target || hidden.has(target)) return;
    for (let ancestor = parentElement(target); ancestor; ancestor = parentElement(ancestor)) if (hidden.has(ancestor)) return;
    hidden.set(target, { value: target.style.getPropertyValue("display"), priority: target.style.getPropertyPriority("display") });
    target.style.setProperty("display", "none", "important");
    target.setAttribute("data-hunger-hidden", "");
  }
  function observe(root) {
    if (observers.has(root)) return;
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && (mutation.target === document.body || mutation.target === document.documentElement)) {
          for (const node of mutation.addedNodes) enqueue(node);
        } else enqueue(mutation.target);
      }
    });
    observer.observe(root, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["href", "src", "srcset", "alt", "title", "aria-label", "data-src", "data-ad", "contenteditable"],
    });
    observers.set(root, observer);
  }
  function inspectElement(element) {
    if (element.matches(SKIP) || isEditable(element)) return;
    if (element.shadowRoot) { observe(element.shadowRoot); scan(element.shadowRoot); }
    if (element.matches(STRUCTURAL)) return;
    const textAttributes = ["alt", "title", "aria-label"];
    if (textAttributes.some(name => element.hasAttribute(name) && matcher.matchesText(element.getAttribute(name)))) { hide(element); return; }
    if ((settings.hideMentions || settings.hidePromotions) && ["href", "src", "data-src"].some(name => {
      const value = element.getAttribute(name);
      if (!value) return false;
      if (matcher.matchesURL(value, document.baseURI)) return true;
      try { return matcher.matchesText(decodeURIComponent(value).replace(/[_-]/g, " ")); } catch { return false; }
    })) { hide(element); return; }
    if (element.hasAttribute("srcset") && element.getAttribute("srcset").split(",").some(source => matcher.matchesURL(source.trim().split(/\s+/)[0], document.baseURI))) { hide(element); return; }
    if (element.matches(INLINE_TEXT) && element.textContent.length <= 2000 && matcher.matchesText(element.textContent)) hide(element);
  }
  function scan(root) {
    if (!active || !root.isConnected) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.matches(SKIP) || hidden.has(node))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (isEditable(root)) return;
      inspectElement(root);
      if (hidden.has(root)) return;
    }
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.ELEMENT_NODE) inspectElement(node);
      else if (node.nodeValue.trim() && !isEditable(node.parentElement)) {
        const parent = node.parentElement;
        if (!parent) continue;
        if (matcher.matchesText(node.nodeValue)) hide(parent);
        else if (!parent.matches(STRUCTURAL) && parent.childElementCount < 20 && parent.textContent.length <= 2000 && matcher.matchesText(parent.textContent)) hide(parent);
      }
    }
  }
  function enqueue(node) {
    if (!active) return;
    let root = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!root?.isConnected) return;
    // Recheck whole hidden cards when a virtualized feed reuses them.
    for (const element of hidden.keys()) {
      if (!element.isConnected) { restore(element); continue; }
      if (element === root || element.contains(root)) root = element;
    }
    dirty.add(root);
    if (!timer) timer = setTimeout(flush, 60);
  }
  function flush() {
    timer = undefined;
    if (!active) return;
    const started = performance.now();
    for (const root of dirty) {
      dirty.delete(root);
      if (!root.isConnected) continue;
      for (const element of hidden.keys()) if (element === root || root.contains(element)) restore(element);
      scan(root);
      if (performance.now() - started > 12) break;
    }
    if (dirty.size) timer = setTimeout(flush, 30);
  }
  function redirectIfBlocked() {
    if (isActive(settings) && settings.blockSites && matcher.matchesURL(location.href)) {
      // Also catches already-open pages and client-side navigation.
      if (window === window.top) location.replace(chrome.runtime.getURL("pages/blocked.html"));
      else if (document.documentElement && !hidden.has(document.documentElement)) {
        const element = document.documentElement;
        hidden.set(element, { value: element.style.getPropertyValue("display"), priority: element.style.getPropertyPriority("display") });
        element.style.setProperty("display", "none", "important");
      }
    }
  }
  function configure(value) {
    settings = normalizeSettings(value);
    matcher = createMatcher(settings);
    active = isActive(settings) && (settings.hideMentions || settings.hidePromotions);
    clearTimeout(timer); timer = undefined;
    clearTimeout(resumeTimer);
    clearInterval(sweepTimer);
    for (const observer of observers.values()) observer.disconnect();
    observers.clear(); dirty.clear(); restoreAll();
    redirectIfBlocked();
    if (active) { observe(document); scan(document); }
    if (settings.enabled && settings.pauseUntil > Date.now()) {
      resumeTimer = setTimeout(() => configure(settings), Math.min(settings.pauseUntil - Date.now() + 50, 2147483647));
    }
    // Catch SPA route changes and open shadow roots attached after insertion.
    if (isActive(settings)) sweepTimer = setInterval(() => {
      if (document.hidden) return;
      redirectIfBlocked();
      if (!active) return;
      for (const [root, observer] of observers) {
        if (root.host && !root.host.isConnected) { observer.disconnect(); observers.delete(root); }
      }
      for (const element of hidden.keys()) if (!element.isConnected) restore(element);
      // Shadow-only updates don't notify the light DOM observer.
      for (const root of [...observers.keys()]) {
        for (const element of root.querySelectorAll("*")) if (element.shadowRoot && !observers.has(element.shadowRoot)) enqueue(element);
      }
    }, 2500);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) configure(changes.settings.newValue);
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "PAGE_STATS") respond({ hidden: [...hidden.keys()].filter(element => element.isConnected).length });
  });
  // Read first so a paused user never has their open tab redirected during startup.
  chrome.storage.local.get("settings").then(({ settings: saved }) => configure(saved)).catch(error => console.warn("Hunger couldn't load preferences:", error.message));
})();
