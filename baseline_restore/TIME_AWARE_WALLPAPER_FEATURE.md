# Time-aware photographic wallpaper

FICONTER now keeps the overview greeting and real coastal wallpaper on one
local-time schedule:

- Morning: 00:00–11:59
- Afternoon: 12:00–17:59
- Evening: 18:00–23:59

## Plan behavior

- Personal Pro, Business Pro, and platform admins receive the automatic
  three-photo day cycle. Beta and Free keep the fixed photograph because this
  feature is reserved for paid plans.
- Free receives one fixed, optimized Coastal Beach photograph.
- The verified server-side effective plan controls access. Expired, unpaid, or
  invalid paid subscriptions fall back to the Free behavior.
- A paid cancellation remains entitled through its verified paid-through date,
  matching the existing subscription engine.

## Synchronization

The greeting and the photograph share the same daypart functions and boundary
times. The client updates at noon, 18:00, midnight, when the tab becomes
visible, and when the browser regains focus. No page refresh is required.

The schedule uses the customer's local device time. This is intentional: the
greeting should describe the time where the customer is currently using the
platform. Personal and Business use the same schedule.

## Performance and readability

Each photograph is a compressed 1920×1080 WebP. The platform keeps a single
fixed background layer, has no continuous animation, and retains the existing
theme/readability veil and contrast guard.
