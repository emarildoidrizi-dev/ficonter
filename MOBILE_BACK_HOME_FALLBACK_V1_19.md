# FICONTER Mobile Back Home Fallback V1.19

## Locked navigation rule

The mobile Back command walks backward through FICONTER's internal route stack. When there is no valid previous FICONTER screen left, Back terminates safely at the current workspace Overview instead of doing nothing, bouncing to a stale page, or leaving the app.

- Personal fallback: `/dashboard/overview`
- Business fallback: `/business/overview`
- Admin routes inherit the active Personal/Business workspace fallback.
- Personal Back never jumps into Business history; Business Back never jumps into Personal history.
- Query-based drill-downs (for example Settings sections) remain stack-aware.
- Root screens keep the Back command hidden.
