# Public language mirror

Implemented a single synchronized language preference across the FICONTER public experience and authenticated workspace.

## Behaviour

- A language selected on the landing page is immediately used on the Log in / Register screens.
- A language selected on the Log in / Register screens is immediately reflected when returning to the landing page.
- The selection is stored in the shared browser preference and cookie, so it survives navigation and reloads.
- Cross-tab changes and browser history restoration also synchronize the active language.
- After authentication, an explicit public/login language selection is carried into the account and synchronized to account preferences when needed.
- On a new device with no public preference, the saved account language becomes the public preference after authentication.
- The public selector now uses a more visible globe/world icon at the top of both the landing page and authentication screens.
- All eight launch languages remain available: English, German, Spanish, Albanian, Arabic (RTL), Portuguese, Italian, and Russian.

## Important fix

The language provider previously wrote its default language to browser storage during mount before reading the existing preference. That could make the landing and login experiences appear out of sync after navigation/reload. The provider now reads the existing browser preference first and only persists language through an explicit language change or an authenticated synchronization.
