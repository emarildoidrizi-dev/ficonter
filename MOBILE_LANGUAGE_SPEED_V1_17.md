# Mobile Language Speed V1.17

The global language control is optimized for immediate perceived response.

- Opening/closing the picker does not wait for account persistence.
- Selecting a language updates FICONTER immediately and closes the menu immediately.
- Saving the authenticated account preference continues in the background.
- Persistence is serialized so rapid language changes retain the final choice.
- Full-document runtime translation is deferred to the next animation frame so the control can paint first.
- Expensive menu backdrop blur was removed and mobile touch handling uses `touch-action: manipulation`.

No language options, supported locales, RTL behavior, or account persistence rules were removed.
