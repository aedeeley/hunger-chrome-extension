# Hunger privacy information

Hunger accesses and uses website content and the URLs/domains of pages and resources in your browser, solely to provide its food-ordering blocking and filtering features. This includes page text, element labels, links, and the current page URL. Processing happens locally on your device. Chrome applies locally generated rules to matching network requests.

This local access/use is disclosed as website content and browsing-related data handling, even though the data is not sent to the developer or an external service. Hunger does not keep a historical list of visited pages, record visit times, log keystrokes or mouse activity, or transmit page contents, visited URLs, or usage analytics. It does not use a backend, load remote code, create an account, or use tracking cookies. Normal website traffic and user-initiated navigation remain managed by your browser and those websites.

The extension saves only its preferences, selected categories, custom domains, custom phrases, and a pause-until timestamp in Chrome's local extension storage. These are not synchronized through `chrome.storage.sync`. Chrome also stores the generated request-blocking rules and pause alarm. Custom lists are ordinary local settings, not encrypted secret storage.

The content filter keeps references to hidden elements and their original display styles in the memory of each page so it can restore them. Its hidden-element count is computed locally and is not retained as a historical activity log.

Broad access to HTTP and HTTPS pages is needed to filter mentions across websites. Hunger requests no dedicated browsing-history, cookies, downloads, or notification permissions.

Hunger uses locally accessed data only for its disclosed food-ordering blocking and filtering features. It does not sell or transfer this data to third parties, use it for advertising or unrelated purposes, or use it for creditworthiness or lending decisions. The developer has no access to the locally processed page contents or browsing data. Hunger's use of information complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

Remove a custom entry from Hunger's settings to delete it. Uninstalling the extension removes its extension-owned settings and rules. Browser history and other data independently kept by Chrome or websites are outside Hunger's control.
