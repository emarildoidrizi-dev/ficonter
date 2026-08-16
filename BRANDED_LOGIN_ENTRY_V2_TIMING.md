# FICONTER Branded Login Entry V2 — Extended Brand Hold

## Change
The branded login entrance now stays on screen long enough for the emblem and identity to be clearly perceived before the login form is revealed.

## Timing
- Standard motion: approximately **3.2 seconds total**.
- Emblem bounce/settle: begins immediately and completes in the first second.
- FICONTER wordmark + `Financial Control Center`: follow after the emblem settles.
- Gold motion line: sweeps after the identity appears.
- Brand holds briefly in its settled state, then fades smoothly into the already-rendered login page.
- Reduced-motion mode: approximately **2.2 seconds**, with the bounce removed.

## Performance
This remains a visual overlay on `/login`; no splash route, browser refresh, or extra navigation hop was added. The login page is already loaded behind the entrance.
