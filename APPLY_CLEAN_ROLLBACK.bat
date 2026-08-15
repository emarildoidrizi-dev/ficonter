@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo FICONTER - CLEAN ROLLBACK TO ORIGINAL MOBILE BASELINE
echo -----------------------------------------------------
echo This will restore the baseline files and remove known later-added mobile files.
echo It preserves .git, node_modules, and local environment files.
echo.
if not exist "baseline_restore\package.json" (
  echo ERROR: baseline_restore\package.json was not found.
  pause
  exit /b 1
)

echo [1/3] Restoring baseline files...
robocopy "baseline_restore" "." /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XD ".git" "node_modules" "baseline_restore" /XF ".env.local" ".env" >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo ERROR: Baseline copy failed with robocopy code %RC%.
  pause
  exit /b %RC%
)

echo [2/3] Removing files introduced after the baseline...
if exist "COMMIT_MESSAGE_LANGUAGE_MIRROR.txt\*" rmdir /s /q "COMMIT_MESSAGE_LANGUAGE_MIRROR.txt" 2>nul
if exist "COMMIT_MESSAGE_LANGUAGE_MIRROR.txt" del /f /q "COMMIT_MESSAGE_LANGUAGE_MIRROR.txt" 2>nul
if exist "COMMIT_MESSAGE_MOBILE_LEDGER_SELECTION_V1.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOBILE_LEDGER_SELECTION_V1.txt" 2>nul
if exist "COMMIT_MESSAGE_MOBILE_LEDGER_SELECTION_V1.txt" del /f /q "COMMIT_MESSAGE_MOBILE_LEDGER_SELECTION_V1.txt" 2>nul
if exist "COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt" 2>nul
if exist "COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt" del /f /q "COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_1.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_1.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_1.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_1.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_10.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_10.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_10.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_10.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_11.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_11.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_11.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_11.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_12.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_12.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_12.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_12.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_13.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_13.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_13.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_13.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_15.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_15.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_15.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_15.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_16.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_16.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_16.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_16.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_17.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_17.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_17.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_17.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_18.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_18.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_18.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_18.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_19.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_19.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_19.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_19.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_2.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_2.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_2.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_2.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_20.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_20.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_20.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_20.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_21.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_21.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_21.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_21.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_22.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_22.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_22.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_22.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_23.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_23.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_23.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_23.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_24.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_24.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_24.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_24.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_26.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_26.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_26.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_26.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_27.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_27.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_27.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_27.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_28.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_28.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_28.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_28.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_31.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_31.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_31.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_31.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_32.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_32.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_32.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_32.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_33.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_33.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_33.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_33.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_6.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_6.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_6.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_6.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_7.txt\*" rmdir /s /q "COMMIT_MESSAGE_MOCKUP_04_7.txt" 2>nul
if exist "COMMIT_MESSAGE_MOCKUP_04_7.txt" del /f /q "COMMIT_MESSAGE_MOCKUP_04_7.txt" 2>nul
if exist "COMMIT_MESSAGE_PROFILE_SETTINGS_SPLIT.txt\*" rmdir /s /q "COMMIT_MESSAGE_PROFILE_SETTINGS_SPLIT.txt" 2>nul
if exist "COMMIT_MESSAGE_PROFILE_SETTINGS_SPLIT.txt" del /f /q "COMMIT_MESSAGE_PROFILE_SETTINGS_SPLIT.txt" 2>nul
if exist "COMMIT_MESSAGE_SETTINGS_DRILL_IN.txt\*" rmdir /s /q "COMMIT_MESSAGE_SETTINGS_DRILL_IN.txt" 2>nul
if exist "COMMIT_MESSAGE_SETTINGS_DRILL_IN.txt" del /f /q "COMMIT_MESSAGE_SETTINGS_DRILL_IN.txt" 2>nul
if exist "MOBILE_LEDGER_SELECTION_V1.md\*" rmdir /s /q "MOBILE_LEDGER_SELECTION_V1.md" 2>nul
if exist "MOBILE_LEDGER_SELECTION_V1.md" del /f /q "MOBILE_LEDGER_SELECTION_V1.md" 2>nul
if exist "MOBILE_PROFILE_SETTINGS_SPLIT.md\*" rmdir /s /q "MOBILE_PROFILE_SETTINGS_SPLIT.md" 2>nul
if exist "MOBILE_PROFILE_SETTINGS_SPLIT.md" del /f /q "MOBILE_PROFILE_SETTINGS_SPLIT.md" 2>nul
if exist "MOBILE_SETTINGS_BACK_TO_MENU.md\*" rmdir /s /q "MOBILE_SETTINGS_BACK_TO_MENU.md" 2>nul
if exist "MOBILE_SETTINGS_BACK_TO_MENU.md" del /f /q "MOBILE_SETTINGS_BACK_TO_MENU.md" 2>nul
if exist "MOBILE_SETTINGS_INSTANT_SHEET.md\*" rmdir /s /q "MOBILE_SETTINGS_INSTANT_SHEET.md" 2>nul
if exist "MOBILE_SETTINGS_INSTANT_SHEET.md" del /f /q "MOBILE_SETTINGS_INSTANT_SHEET.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04.md" del /f /q "MOBILE_UI_MOCKUP_04.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_1.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_1.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_1.md" del /f /q "MOBILE_UI_MOCKUP_04_1.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_10_SETTINGS_BACK_INSTANT.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_10_SETTINGS_BACK_INSTANT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_10_SETTINGS_BACK_INSTANT.md" del /f /q "MOBILE_UI_MOCKUP_04_10_SETTINGS_BACK_INSTANT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_11_GLOBE_HOME_INSTANT.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_11_GLOBE_HOME_INSTANT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_11_GLOBE_HOME_INSTANT.md" del /f /q "MOBILE_UI_MOCKUP_04_11_GLOBE_HOME_INSTANT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_12_SETTINGS_X_HOME.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_12_SETTINGS_X_HOME.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_12_SETTINGS_X_HOME.md" del /f /q "MOBILE_UI_MOCKUP_04_12_SETTINGS_X_HOME.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_13_OVERVIEW_REFINEMENT.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_13_OVERVIEW_REFINEMENT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_13_OVERVIEW_REFINEMENT.md" del /f /q "MOBILE_UI_MOCKUP_04_13_OVERVIEW_REFINEMENT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_15_TRANSACTION_MODE_SELECTOR.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_15_TRANSACTION_MODE_SELECTOR.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_15_TRANSACTION_MODE_SELECTOR.md" del /f /q "MOBILE_UI_MOCKUP_04_15_TRANSACTION_MODE_SELECTOR.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_16_BALANCE_ROWS.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_16_BALANCE_ROWS.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_16_BALANCE_ROWS.md" del /f /q "MOBILE_UI_MOCKUP_04_16_BALANCE_ROWS.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_17_LANGUAGE_STATUS.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_17_LANGUAGE_STATUS.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_17_LANGUAGE_STATUS.md" del /f /q "MOBILE_UI_MOCKUP_04_17_LANGUAGE_STATUS.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_18_ICON_ALIGNMENT.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_18_ICON_ALIGNMENT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_18_ICON_ALIGNMENT.md" del /f /q "MOBILE_UI_MOCKUP_04_18_ICON_ALIGNMENT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_19_SIMPLER_DETAILED_FORM.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_19_SIMPLER_DETAILED_FORM.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_19_SIMPLER_DETAILED_FORM.md" del /f /q "MOBILE_UI_MOCKUP_04_19_SIMPLER_DETAILED_FORM.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_20_REMOVE_DETAILED_INTRO.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_20_REMOVE_DETAILED_INTRO.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_20_REMOVE_DETAILED_INTRO.md" del /f /q "MOBILE_UI_MOCKUP_04_20_REMOVE_DETAILED_INTRO.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_21_REMOVE_DETAILED_HEADER_AREA.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_21_REMOVE_DETAILED_HEADER_AREA.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_21_REMOVE_DETAILED_HEADER_AREA.md" del /f /q "MOBILE_UI_MOCKUP_04_21_REMOVE_DETAILED_HEADER_AREA.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_22_OVERVIEW_ICON_TUNING.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_22_OVERVIEW_ICON_TUNING.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_22_OVERVIEW_ICON_TUNING.md" del /f /q "MOBILE_UI_MOCKUP_04_22_OVERVIEW_ICON_TUNING.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_23_PIXEL_ICON_CENTERING.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_23_PIXEL_ICON_CENTERING.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_23_PIXEL_ICON_CENTERING.md" del /f /q "MOBILE_UI_MOCKUP_04_23_PIXEL_ICON_CENTERING.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_24_TRANSACTION_ICON_CENTERING.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_24_TRANSACTION_ICON_CENTERING.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_24_TRANSACTION_ICON_CENTERING.md" del /f /q "MOBILE_UI_MOCKUP_04_24_TRANSACTION_ICON_CENTERING.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_25_COMPACT_FULLSCREEN_SHELL.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_25_COMPACT_FULLSCREEN_SHELL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_25_COMPACT_FULLSCREEN_SHELL.md" del /f /q "MOBILE_UI_MOCKUP_04_25_COMPACT_FULLSCREEN_SHELL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_26_SUPER_COMPACT_FULLSCREEN_SHELL.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_26_SUPER_COMPACT_FULLSCREEN_SHELL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_26_SUPER_COMPACT_FULLSCREEN_SHELL.md" del /f /q "MOBILE_UI_MOCKUP_04_26_SUPER_COMPACT_FULLSCREEN_SHELL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_27_REMOVE_OVERVIEW_CHEVRON.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_27_REMOVE_OVERVIEW_CHEVRON.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_27_REMOVE_OVERVIEW_CHEVRON.md" del /f /q "MOBILE_UI_MOCKUP_04_27_REMOVE_OVERVIEW_CHEVRON.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_28_CONTINUOUS_OVERVIEW_HERO.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_28_CONTINUOUS_OVERVIEW_HERO.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_28_CONTINUOUS_OVERVIEW_HERO.md" del /f /q "MOBILE_UI_MOCKUP_04_28_CONTINUOUS_OVERVIEW_HERO.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_2_SETTINGS_TOGGLE.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_2_SETTINGS_TOGGLE.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_2_SETTINGS_TOGGLE.md" del /f /q "MOBILE_UI_MOCKUP_04_2_SETTINGS_TOGGLE.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_30_FULL_WALLPAPER_AVATAR_FILL.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_30_FULL_WALLPAPER_AVATAR_FILL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_30_FULL_WALLPAPER_AVATAR_FILL.md" del /f /q "MOBILE_UI_MOCKUP_04_30_FULL_WALLPAPER_AVATAR_FILL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_31_EDGE_CLEAN_HEADER.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_31_EDGE_CLEAN_HEADER.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_31_EDGE_CLEAN_HEADER.md" del /f /q "MOBILE_UI_MOCKUP_04_31_EDGE_CLEAN_HEADER.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_32_PROFILE_PHOTO_TRUE_FILL.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_32_PROFILE_PHOTO_TRUE_FILL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_32_PROFILE_PHOTO_TRUE_FILL.md" del /f /q "MOBILE_UI_MOCKUP_04_32_PROFILE_PHOTO_TRUE_FILL.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_33_IOS_PULLDOWN_CLEANUP.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_33_IOS_PULLDOWN_CLEANUP.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_33_IOS_PULLDOWN_CLEANUP.md" del /f /q "MOBILE_UI_MOCKUP_04_33_IOS_PULLDOWN_CLEANUP.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_6_PROFILE_HOME_INSTANT.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_6_PROFILE_HOME_INSTANT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_6_PROFILE_HOME_INSTANT.md" del /f /q "MOBILE_UI_MOCKUP_04_6_PROFILE_HOME_INSTANT.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_7_REMOVE_SETTINGS_INDEX.md\*" rmdir /s /q "MOBILE_UI_MOCKUP_04_7_REMOVE_SETTINGS_INDEX.md" 2>nul
if exist "MOBILE_UI_MOCKUP_04_7_REMOVE_SETTINGS_INDEX.md" del /f /q "MOBILE_UI_MOCKUP_04_7_REMOVE_SETTINGS_INDEX.md" 2>nul
if exist "MOBILE_UI_STANDARD_V1_LOCKED.md\*" rmdir /s /q "MOBILE_UI_STANDARD_V1_LOCKED.md" 2>nul
if exist "MOBILE_UI_STANDARD_V1_LOCKED.md" del /f /q "MOBILE_UI_STANDARD_V1_LOCKED.md" 2>nul
if exist "PUBLIC_LANGUAGE_MIRROR.md\*" rmdir /s /q "PUBLIC_LANGUAGE_MIRROR.md" 2>nul
if exist "PUBLIC_LANGUAGE_MIRROR.md" del /f /q "PUBLIC_LANGUAGE_MIRROR.md" 2>nul
if exist "app\dashboard\profile\page.tsx\*" rmdir /s /q "app\dashboard\profile\page.tsx" 2>nul
if exist "app\dashboard\profile\page.tsx" del /f /q "app\dashboard\profile\page.tsx" 2>nul
if exist "components\TransactionsActivityWorkspace.module.css\*" rmdir /s /q "components\TransactionsActivityWorkspace.module.css" 2>nul
if exist "components\TransactionsActivityWorkspace.module.css" del /f /q "components\TransactionsActivityWorkspace.module.css" 2>nul
if exist "components\TransactionsActivityWorkspace.tsx\*" rmdir /s /q "components\TransactionsActivityWorkspace.tsx" 2>nul
if exist "components\TransactionsActivityWorkspace.tsx" del /f /q "components\TransactionsActivityWorkspace.tsx" 2>nul
if exist "scripts\verify-mobile-overview-polish.mjs\*" rmdir /s /q "scripts\verify-mobile-overview-polish.mjs" 2>nul
if exist "scripts\verify-mobile-overview-polish.mjs" del /f /q "scripts\verify-mobile-overview-polish.mjs" 2>nul
if exist "scripts\verify-mobile-profile-settings-split.mjs\*" rmdir /s /q "scripts\verify-mobile-profile-settings-split.mjs" 2>nul
if exist "scripts\verify-mobile-profile-settings-split.mjs" del /f /q "scripts\verify-mobile-profile-settings-split.mjs" 2>nul
if exist "scripts\verify-mobile-settings-back-menu.mjs\*" rmdir /s /q "scripts\verify-mobile-settings-back-menu.mjs" 2>nul
if exist "scripts\verify-mobile-settings-back-menu.mjs" del /f /q "scripts\verify-mobile-settings-back-menu.mjs" 2>nul
if exist "scripts\verify-mobile-settings-drill-in.mjs\*" rmdir /s /q "scripts\verify-mobile-settings-drill-in.mjs" 2>nul
if exist "scripts\verify-mobile-settings-drill-in.mjs" del /f /q "scripts\verify-mobile-settings-drill-in.mjs" 2>nul
if exist "scripts\verify-mobile-settings-index-removal.mjs\*" rmdir /s /q "scripts\verify-mobile-settings-index-removal.mjs" 2>nul
if exist "scripts\verify-mobile-settings-index-removal.mjs" del /f /q "scripts\verify-mobile-settings-index-removal.mjs" 2>nul
if exist "scripts\verify-mobile-ui-phase6-11-profile-home-instant.mjs\*" rmdir /s /q "scripts\verify-mobile-ui-phase6-11-profile-home-instant.mjs" 2>nul
if exist "scripts\verify-mobile-ui-phase6-11-profile-home-instant.mjs" del /f /q "scripts\verify-mobile-ui-phase6-11-profile-home-instant.mjs" 2>nul
if exist "scripts\verify-public-language-mirror.mjs\*" rmdir /s /q "scripts\verify-public-language-mirror.mjs" 2>nul
if exist "scripts\verify-public-language-mirror.mjs" del /f /q "scripts\verify-public-language-mirror.mjs" 2>nul
if exist "upload-to-repository\COMMIT_MESSAGE_LANGUAGE_MIRROR.txt\*" rmdir /s /q "upload-to-repository\COMMIT_MESSAGE_LANGUAGE_MIRROR.txt" 2>nul
if exist "upload-to-repository\COMMIT_MESSAGE_LANGUAGE_MIRROR.txt" del /f /q "upload-to-repository\COMMIT_MESSAGE_LANGUAGE_MIRROR.txt" 2>nul
if exist "upload-to-repository\COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt\*" rmdir /s /q "upload-to-repository\COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt" 2>nul
if exist "upload-to-repository\COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt" del /f /q "upload-to-repository\COMMIT_MESSAGE_MOBILE_STANDARD_V1.txt" 2>nul
if exist "upload-to-repository\MOBILE_UI_STANDARD_V1_LOCKED.md\*" rmdir /s /q "upload-to-repository\MOBILE_UI_STANDARD_V1_LOCKED.md" 2>nul
if exist "upload-to-repository\MOBILE_UI_STANDARD_V1_LOCKED.md" del /f /q "upload-to-repository\MOBILE_UI_STANDARD_V1_LOCKED.md" 2>nul
if exist "upload-to-repository\PUBLIC_LANGUAGE_MIRROR.md\*" rmdir /s /q "upload-to-repository\PUBLIC_LANGUAGE_MIRROR.md" 2>nul
if exist "upload-to-repository\PUBLIC_LANGUAGE_MIRROR.md" del /f /q "upload-to-repository\PUBLIC_LANGUAGE_MIRROR.md" 2>nul
if exist "upload-to-repository\app\dashboard\transactions\page.tsx\*" rmdir /s /q "upload-to-repository\app\dashboard\transactions\page.tsx" 2>nul
if exist "upload-to-repository\app\dashboard\transactions\page.tsx" del /f /q "upload-to-repository\app\dashboard\transactions\page.tsx" 2>nul
if exist "upload-to-repository\app\mobile-shell-v2.css\*" rmdir /s /q "upload-to-repository\app\mobile-shell-v2.css" 2>nul
if exist "upload-to-repository\app\mobile-shell-v2.css" del /f /q "upload-to-repository\app\mobile-shell-v2.css" 2>nul
if exist "upload-to-repository\components\TransactionsActivityWorkspace.module.css\*" rmdir /s /q "upload-to-repository\components\TransactionsActivityWorkspace.module.css" 2>nul
if exist "upload-to-repository\components\TransactionsActivityWorkspace.module.css" del /f /q "upload-to-repository\components\TransactionsActivityWorkspace.module.css" 2>nul
if exist "upload-to-repository\components\TransactionsActivityWorkspace.tsx\*" rmdir /s /q "upload-to-repository\components\TransactionsActivityWorkspace.tsx" 2>nul
if exist "upload-to-repository\components\TransactionsActivityWorkspace.tsx" del /f /q "upload-to-repository\components\TransactionsActivityWorkspace.tsx" 2>nul
if exist "upload-to-repository\scripts\verify-mobile-overview-polish.mjs\*" rmdir /s /q "upload-to-repository\scripts\verify-mobile-overview-polish.mjs" 2>nul
if exist "upload-to-repository\scripts\verify-mobile-overview-polish.mjs" del /f /q "upload-to-repository\scripts\verify-mobile-overview-polish.mjs" 2>nul
if exist "upload-to-repository\scripts\verify-public-language-mirror.mjs\*" rmdir /s /q "upload-to-repository\scripts\verify-public-language-mirror.mjs" 2>nul
if exist "upload-to-repository\scripts\verify-public-language-mirror.mjs" del /f /q "upload-to-repository\scripts\verify-public-language-mirror.mjs" 2>nul

echo [3/3] Cleaning temporary rollback files...
rmdir /s /q "baseline_restore" 2>nul
del /f /q "LATER_FILES_TO_REMOVE.txt" 2>nul
del /f /q "ROLLBACK_README.txt" 2>nul

echo.
echo CLEAN ROLLBACK COMPLETE.
echo Open GitHub Desktop. The remaining changes should represent the exact rollback.
echo Then commit and push.
echo.
pause
start "" cmd /c del /f /q "%~f0"
endlocal
