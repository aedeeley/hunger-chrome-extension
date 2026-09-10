# Publishing Hunger in the Chrome Web Store

This is the release checklist and draft listing for version 1.0.0. The repository is public, but the extension has not been submitted to or approved by the Chrome Web Store.

## 1. Set up your publisher account

Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) with the Google account you want to own the extension. Register, accept Google's developer agreement, and pay the one-time fee shown during registration. Choose this account carefully: Google says the developer account email cannot be changed without creating an account and transferring the items.

Set your publisher name, verify your contact email, and complete any account/security or identity requirements shown in the dashboard. Registration, payment, account verification, and final certifications must be completed by the account owner.

Sources: [Registration](https://developer.chrome.com/docs/webstore/register), [account setup](https://developer.chrome.com/docs/webstore/set-up-account).

## 2. Prepare the upload

From the repository root:

```sh
npm test
npm run check
npm run package
```

Upload `dist/hunger-extension.zip` using **Add new item** in the dashboard. The ZIP contains `manifest.json` at its root and excludes browser test profiles, development dependencies, tests, and tooling. A GitHub repository is useful for source hosting but is not an upload requirement.

The extension is already Manifest V3 and uses only bundled code. Re-run the browser integration checks before releasing a changed implementation; instructions are in the README.

Source: [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish).

## 3. Supply listing images

These still need to be prepared and visually reviewed for the store. The development screenshots in `test-results/` demonstrate the interface but are not all the required dimensions.

| Asset | Required size | Status |
| --- | --- | --- |
| Extension icon | 128 × 128 PNG | Included in `icons/icon128.png`; review artwork padding against Google's guidance before submission |
| Small promotional image | 440 × 280 | To create |
| Screenshot | At least one, 1280 × 800 or 640 × 400 | To create at the required dimensions |
| Additional screenshots | Up to five total | Optional; show settings, filtering, and the blocked page |
| Marquee promotional image | 1400 × 560 | Optional |

Screenshots should show the real extension experience, with square corners and no padding. Google's square-icon guidance calls for artwork around 96 × 96 within the 128 × 128 canvas. Avoid claims that Hunger blocks every food ordering site or can detect every image/video advertisement.

Source: [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images).

## 4. Draft store listing

**Name:** Hunger — Food Ordering Blocker

**Short description:** Block food ordering websites and hide related links, promotions, and mentions. Private, local, and customizable.

**Suggested category:** Productivity, or the closest matching category offered in the dashboard.

**Language:** English

**Website:** https://github.com/aedeeley/hunger-chrome-extension

**Support:** https://github.com/aedeeley/hunger-chrome-extension/issues

**Privacy policy:** https://github.com/aedeeley/hunger-chrome-extension/blob/main/PRIVACY.md

### Detailed description

Keep food ordering out of your scroll.

Hunger blocks covered food ordering websites and hides matching service names, links, promotions, and search results on other pages. Everything runs on your device, with no account, analytics, or browsing-history logs.

Choose your boundaries:

- Block delivery platforms such as DoorDash, Uber Eats, Grubhub, and Postmates.
- Include popular restaurant websites, with optional grocery delivery and meal-kit categories.
- Hide matching mentions and ordering prompts as page content changes.
- Add your own website domains and specific phrases.
- Pause for 15 minutes and resume automatically, or switch protection off when you choose.

Version 1.0.0 includes 77 services across four categories. Delivery and restaurant categories are enabled by default, covering 98 domains across 57 services. Grocery delivery and meal kits are optional.

Hunger needs access to websites so it can filter matching page content and block covered destinations. It does not send page content, URLs, or settings to a server. Preferences stay in your browser's local extension storage.

Coverage uses a curated list, so some services and local restaurants will need to be added manually. Image-only or video ads without recognizable labels or URLs may remain visible. Matching news or discussion may also be hidden. Restaurant categories block entire listed websites. Hunger works in desktop Chrome, not native apps, and cannot filter Chrome's internal pages or the Chrome Web Store.

After installation, refresh existing tabs and pin Hunger to reach its controls.

## 5. Draft privacy fields

These drafts describe the current source code. Review the actual dashboard questions before certifying or submitting; keep the answers aligned with any future code changes.

### Single purpose

Help users avoid online food ordering by blocking covered food ordering websites and hiding related service mentions, links, and promotions in their browser.

### Permission justifications

**storage:** Saves the user's protection settings, chosen categories, custom domains and phrases, and pause-until timestamp locally. The extension does not sync these settings to an external service.

**declarativeNetRequest:** Applies local rules that redirect navigation to covered food ordering websites to the extension's blocked page and block resources from covered domains. This is the extension's website-blocking function.

**alarms:** Resumes protection after the user selects a timed 15-minute pause, including when the popup is closed or the extension service worker has stopped.

**Host permissions (`http://*/*` and `https://*/*`):** Matching food ordering mentions, links, and promotions may appear on any normal webpage. Site access lets the content script inspect and hide matching content locally and lets Chrome redirect covered destinations, including domains added by the user. Restricting access to only food-service domains would prevent filtering on other websites.

### Remote code

No remote code. All JavaScript, CSS, matching rules, and service catalog data are bundled with the extension or generated locally from the user's settings. There are no remote scripts, CDNs, analytics, or backend calls.

### Data handling

The extension locally reads page text, labels, and URLs to perform its core filtering. It stores preferences and custom lists locally. It does not transmit or collect these data on a developer-controlled server, sell data, use data for advertising, or retain browsing activity logs. Declare local access/use accurately when answering the dashboard's current questions; do not equate “no server collection” with “no access to webpage content.”

The full public privacy policy is at the URL above. The account owner should review and make the required data-use certifications in the dashboard.

Source: [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

## 6. Reviewer test instructions

No account, login credentials, subscription, or backend setup is required.

1. Install the extension and leave its defaults enabled.
2. Visit `https://www.doordash.com/` or `https://www.ubereats.com/`; a local Hunger blocked page should appear.
3. Open an ordinary webpage containing a covered service name or an ordering promotion. Matching elements should be hidden; editable controls are preserved.
4. Open Hunger's popup and select **Pause for 15 minutes**. Hidden content should be restored. Previously blocked network resources may need a page refresh.
5. Select **Resume protection** to re-enable blocking immediately.
6. Open **Manage blocklist**. Add a custom website domain or phrase and confirm it persists after reloading the settings page.
7. Optional grocery and meal-kit categories should be disabled initially and can be enabled individually.

For a deterministic developer fixture, `tests/fixture.html` can be served on localhost over HTTP. Local files opened using `file://` are not included in the extension's site access.

## 7. Submit for review

Complete the Store Listing, Privacy, Distribution, and Test Instructions sections. Choose the intended visibility and distribution countries, then submit for review. You can choose deferred publishing if you want to manually release it after approval. Review timing varies; broad website access needs a clear justification and approval is not guaranteed by local tests.

Future releases need an increased manifest version, a newly generated ZIP, and another dashboard upload. Keeping the same Chrome Web Store item preserves the extension's store identity.

Source: [Publishing and review](https://developer.chrome.com/docs/webstore/publish).
