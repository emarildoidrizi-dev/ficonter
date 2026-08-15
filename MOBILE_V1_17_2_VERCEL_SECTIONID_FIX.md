# FICONTER Mobile V1.17.2 — Vercel SectionId Type Fix

## Fix
Vercel reported:

`components/SettingsWorkspace.tsx(1424,11): error TS2322: Type 'string | null' is not assignable to type 'SectionId | null'.`

The route query value is now normalized to `string | undefined`, validated with the `isSectionId` type guard, and assigned to `nextSection` only inside the narrowed branch.

This preserves:
- compact mobile language picker
- instant/non-blocking language switching
- fast Settings navigation
- phone/tablet responsive navigation rules

## Local verification
- Settings speed: 12/12
- Responsive navigation: 13/13
- Language speed: 9/9

The local package does not contain a complete installed Next.js toolchain, so Vercel remains the final production TypeScript/build check.
