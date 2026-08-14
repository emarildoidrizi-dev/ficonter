# Mobile Settings — Back returns to Settings menu

The mobile Settings detail Back control now reopens the instant Settings quick-sheet instead of switching to the retired hidden Settings index.

Behavior:
- Settings dock button opens the Settings quick-sheet immediately.
- Choosing a section opens the section detail.
- Tapping `← Settings` in a section reopens the quick-sheet over the current detail.
- Closing the quick-sheet leaves the current detail visible; no blank Settings page is exposed.
- Desktop Settings behavior is unchanged because the back control remains mobile-only.

Commit message:
`fix(mobile): return Settings back control to quick menu`
