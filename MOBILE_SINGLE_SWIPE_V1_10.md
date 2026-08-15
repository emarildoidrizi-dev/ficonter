# FICONTER Mobile Single Swipe V1.10

## Rule
Every forward or backward mobile navigation transition animates exactly once.

## Fix
- Removed the SettingsWorkspace nested parent animation.
- Removed the SettingsWorkspace nested detail animation.
- Kept the global mobile page-stack forward/back animation as the sole transition owner.
- Settings child screens still replace the Settings menu completely.
- Back still returns one screen level with the reverse page-stack animation.

## Result
No second/glitch swipe after a Settings section opens or closes.

## Commit message
`fix(mobile): remove duplicate nested swipe animation`
