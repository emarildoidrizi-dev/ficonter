# FICONTER Mobile Settings Speed V1.15

## Locked interaction rule
Settings section buttons must react immediately.

### Phone
- The Settings workspace is already mounted client-side.
- Tapping a section switches the visible child screen immediately with local React state.
- Browser history is updated with `history.pushState` so Back and deep links still work.
- The server Settings route is not rebuilt just to change sections.
- Forward transition: 220 ms.
- Back transition: 200 ms.

### Tablet / iPad / larger screens
- Continue using the in-page Settings layout.
- Section switching remains local and immediate.
- No phone page-stack animation is applied.

### Back behavior
- Moving between query-based screens on the same Settings pathname uses browser history directly.
- Cross-module Back navigation continues to use the Next.js router.
