# Hunger

A Chrome extension that blocks food ordering websites and hides related ads, links, search results, and mentions on other pages. It runs entirely on your device, without an account or backend.

## Install in Chrome

1. Keep this folder in a permanent location. If using `dist/hunger-extension.zip`, extract it first.
2. Open `chrome://extensions` in desktop Chrome.
3. Turn on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** and select the folder containing `manifest.json`. For this project, that is `hunger-chrome-extension` itself, not `src` or `pages`.
5. Pin **Hunger** from Chrome's extensions menu. Refresh any tabs that were open before installation.

Protection starts automatically. No build, Node.js, or package installation is needed to use the extension. This is an unpacked extension, not a Chrome Web Store publication. Chrome 121 or later is required.

Source: [aedeeley/hunger-chrome-extension](https://github.com/aedeeley/hunger-chrome-extension). For the store release checklist, draft listing, privacy declarations, and remaining image assets, see [PUBLISHING.md](PUBLISHING.md).

After editing or updating the extension, click its **Reload** button at `chrome://extensions` and refresh open tabs.

## What it does

- **Blocks visits** to covered domains and their subdomains, showing a local blocked page. It also blocks network resources and embedded frames served from those domains.
- **Hides matching content** including service names, links, labeled images, search results, and supported ad/feed cards. It watches for dynamically inserted or edited content and works inside accessible frames and open shadow roots.
- **Recognizes common redirects and app links**, including encoded ad destinations and selected app-store listings. Food ordering routes on `uber.com` are covered without blocking ordinary ride pages.
- **Restores hidden content** when filtering is disabled, paused, or a matching rule is removed. Recycled feed cards are rechecked when their content changes.
- **Pauses for 15 minutes** and resumes automatically using Chrome alarms. The main switch also allows an indefinite pause.
- **Stores preferences locally**, including up to 200 custom domains and 200 custom literal phrases. No regular-expression syntax is required or accepted from users.

## Default coverage

The curated catalog includes 77 services across four categories. Food delivery and restaurant ordering are enabled initially: 57 services covering 98 domains, plus food ordering routes on Uber's shared domain.

| Category | Default | Examples |
| --- | --- | --- |
| Food delivery | On | DoorDash, Uber Eats, Grubhub, Postmates, Deliveroo, Just Eat, ChowNow, Toast Takeout |
| Restaurant ordering | On | Domino's, Pizza Hut, McDonald's, Taco Bell, Wingstop, Panera |
| Groceries & convenience | Off | Instacart, Shipt, Gopuff, FreshDirect |
| Meal kits & prepared meals | Off | HelloFresh, Blue Apron, Home Chef, Factor, CookUnity |

Open **Manage blocklist** to inspect every included service, change categories, or add local services. Categories block the **whole listed domains**, including menus, careers pages, and other non-ordering content. The list is a starting point, not a comprehensive directory, and may include legacy brands or domains. Updates are manual.

Add `example.com` to block that website and its subdomains. To hide a brand name as well, add its name under **Hidden words & phrases**. Custom phrases only filter page content; they do not block unrelated websites whose pages contain those words. Names that are common words, such as “Toast,” “Slice,” “Factor,” and “Subway,” use more specific phrases to reduce accidental matches. You can add the short names yourself for broader matching.

The promotion switch also hides phrases such as “order food,” “food delivery,” and “order takeout.” The visible hidden-item counter is for the main frame of the current page; it counts hidden elements, not necessarily distinct ads. The domain counter is configured coverage, not a log of blocked requests.

## Practical limits

- This extension works in **desktop Chrome**, not native mobile or desktop apps. It does not lock Chrome settings or prevent you from disabling it.
- A blocklist cannot catch every food ordering service, country-specific domain, or local restaurant. Add missed domains and phrases in settings.
- Image-only ads without useful labels or URLs, text drawn into images/canvas, video/audio ads, inaccessible closed shadow roots, and some deeply nested or very large cards may remain visible. It is not an image-recognition or universal ad-blocking system.
- Matching mentions are filtered even when they are news or ordinary discussion. Hiding a matching article/card can also hide other content inside it. Navigation containers and editable controls are preserved.
- Chrome's own pages, the Chrome Web Store, other extensions' pages, PDF viewer content, and local files are not filtered. Incognito requires **Allow in Incognito** in Chrome's extension details.
- Filtering begins after local preferences load and may briefly show content before a scan. Suspended or heavily throttled tabs may update when they become active.
- Requests served entirely by a website's own service worker may not reach Chrome's network-rule engine. The page filter provides an additional check for blocked pages and SPA route changes.
- Turning protection off restores hidden DOM content immediately. Previously blocked network resources may need a reload. Installing or reloading Hunger requires refreshing existing tabs.
- General retailers such as Amazon and Walmart are not blocked by the grocery category; their food sections share sites with unrelated shopping. Add their domains yourself if you want the entire sites blocked.

## Privacy and permissions

See [PRIVACY.md](PRIVACY.md). Hunger does not send page contents, URLs, settings, or counts to a server and has no analytics or remote runtime code. Settings are saved with `chrome.storage.local`, not browser account sync.

| Permission | Purpose |
| --- | --- |
| `storage` | Save preferences and custom rules on this device |
| `declarativeNetRequest` | Block requests and redirect covered websites |
| `alarms` | Resume protection after a timed pause |
| Access to HTTP/HTTPS sites | Hide matching page content and redirect blocked domains |

Chrome's broad site-access warning is expected for a content filter. Restricting Hunger's site access also restricts its protection. No history, cookies, downloads, notifications, or remote service permissions are requested.

## Development and validation

Production is plain JavaScript, HTML, and CSS with no runtime dependencies or build step. Development scripts need Node.js 20.11 or later.

```sh
npm test
npm run check
npm run package
```

The package command creates `dist/hunger-extension.zip` containing only extension assets and documentation. It does not publish or install anything.

To run real browser tests:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

Tests use a fresh headless Chromium profile and a local fixture server; they do not modify your personal browser profile. Browser profiles, screenshots, and results are written under `test-results/`, which is git-ignored. You can use `PLAYWRIGHT_MODULE` to select an existing Playwright package and `CHROMIUM_EXECUTABLE` to select Chrome for Testing / Chromium. Regular branded Chrome may ignore extension-loading flags used by automated tests.

`npm test` covers domain boundaries, text matching, Unicode, false positives, categories, custom input validation, and rule generation. Browser tests validate actual extension loading, redirects, DOM filtering, restored content, shadow roots, settings persistence, timed resume, and narrow-screen layout. Screenshots are generated for manual visual checks. These tests cover the bundled fixtures and selected navigations, not every real-world website.

### Files

- `manifest.json`: Chrome Manifest V3 configuration and permissions.
- `src/catalog.js`: Curated service names, aliases, and domains.
- `src/core.js` / `core.mjs`: Shared validation, matchers, and network rule generation.
- `src/background.js`: Serialized settings updates, rule installation, and pause alarms.
- `src/content.js`: Reversible page filtering and mutation observation.
- `pages/`: Popup, settings, and blocked-page interfaces.
- `tests/`: Unit and browser integration checks.
- `scripts/`: Asset validation, icon generation, and ZIP packaging.

The implementation follows Chrome's official [declarativeNetRequest documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) and [content script documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
