# FICONTER Global Localization Governance

## Non-negotiable platform rule

When a user selects a supported FICONTER language, 100% of FICONTER-owned interface text must render in that language across the entire product. Mixed-language screens are not acceptable for release.

This rule applies equally to Personal, Business, Administration, onboarding, authentication, Settings, Vault, notifications, documents, exports, PWA/mobile surfaces, error states, empty states, modals, dialogs, tooltips, accessibility labels, placeholders, helper copy, financial guidance, tables, statuses, navigation, and every future module.

## Architecture requirements

1. Customer-facing copy must be translatable. New interface copy must be added to the localization system rather than treated as English-only product text.
2. Every supported language must have a complete translation for every release-owned interface string and supported runtime template.
3. A feature is not complete until localization coverage passes for every supported language.
4. Language changes must apply immediately without browser refresh.
5. The selected locale controls appropriate display formatting for dates, months, numbers, percentages and currencies. Stored canonical financial values remain language-independent.
6. Arabic uses RTL document direction and compatible layout behavior.
7. User-authored data is not automatically translated. Examples include transaction descriptions, custom categories, notes, uploaded document content and business names.
8. Localization must never mutate financial values, encryption keys, encrypted payloads, transaction identity, database records or financial calculations.
9. English is not an accepted production fallback for missing FICONTER-owned UI copy. Missing localization coverage is a release-blocking defect.

## Release gate

`scripts/verify-localization.mjs` is the canonical localization coverage verifier. It audits static UI strings, supported dynamic/runtime templates and the required translation catalogs for every supported language.

The Vercel production/preview build is required to run the localization verifier before compiling Next.js. A localization coverage failure must fail the deployment rather than ship a mixed-language interface.

## Definition of Done

A FICONTER feature is complete only when all applicable checks pass:

- Functional behavior is correct.
- Linked financial modules remain synchronized.
- Desktop, tablet and mobile/PWA behavior is correct.
- Theme/appearance behavior is correct.
- Accessibility-facing interface text is localized.
- 100% localization coverage passes for all supported languages.

This governance applies to existing and future FICONTER code.