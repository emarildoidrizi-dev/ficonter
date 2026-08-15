# Mobile Back Navigation V1.1 — Vercel TypeScript Fix

## Fix
The contextual Back handler now checks `previousAppPath` directly in the navigation condition so TypeScript narrows `string | null` to `string` before it is passed to `router.prefetch()` and `router.push()`.

## Vercel errors resolved
- `components/FiconterNativeAppChrome.tsx(863,23): TS2345`
- `components/FiconterNativeAppChrome.tsx(864,19): TS2345`

## Functional behavior
No UX behavior was changed. Back still:
1. returns to the previous in-app Personal/Business route when available;
2. otherwise uses the workspace fallback route.

## Commit
`fix(mobile): narrow back route before client navigation`
