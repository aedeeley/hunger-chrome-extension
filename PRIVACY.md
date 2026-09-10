# Hunger privacy information

Hunger processes website text, element labels, and links locally in your browser to decide what to hide. Chrome applies locally generated rules to matching network requests.

Hunger does not collect or transmit browsing history, visited URLs, page text, personal information, or usage analytics. It does not contact an external server, load remote code, create an account, or use tracking cookies. Normal website traffic remains managed by your browser and those websites.

The extension saves only its preferences, selected categories, custom domains, custom phrases, and a pause-until timestamp in Chrome's local extension storage. These are not synchronized through `chrome.storage.sync`. Chrome also stores the generated request-blocking rules and pause alarm. Custom lists are ordinary local settings, not encrypted secret storage.

The content filter keeps references to hidden elements and their original display styles in the memory of each page so it can restore them. Its hidden-element count is computed locally and is not retained as a historical activity log.

Broad access to HTTP and HTTPS pages is needed to filter mentions across websites. Hunger requests no dedicated browsing-history, cookies, downloads, or notification permissions.

Remove a custom entry from Hunger's settings to delete it. Uninstalling the extension removes its extension-owned settings and rules. Browser history and other data independently kept by Chrome or websites are outside Hunger's control.
