@echo off
setlocal
echo Cleaning retired FICONTER verification scripts...
if exist "scripts\verify-currency-phase3-1.mjs" del /q "scripts\verify-currency-phase3-1.mjs"
if exist "scripts\verify-currency-phase3-2.mjs" del /q "scripts\verify-currency-phase3-2.mjs"
if exist "scripts\verify-currency-phase3.mjs" del /q "scripts\verify-currency-phase3.mjs"
if exist "scripts\verify-language-speed-v117.mjs" del /q "scripts\verify-language-speed-v117.mjs"
if exist "scripts\verify-mobile-overview-polish.mjs" del /q "scripts\verify-mobile-overview-polish.mjs"
if exist "scripts\verify-mobile-profile-settings-split.mjs" del /q "scripts\verify-mobile-profile-settings-split.mjs"
if exist "scripts\verify-mobile-screen-stack.mjs" del /q "scripts\verify-mobile-screen-stack.mjs"
if exist "scripts\verify-mobile-settings-back-menu.mjs" del /q "scripts\verify-mobile-settings-back-menu.mjs"
if exist "scripts\verify-mobile-settings-drill-in.mjs" del /q "scripts\verify-mobile-settings-drill-in.mjs"
if exist "scripts\verify-mobile-settings-index-removal.mjs" del /q "scripts\verify-mobile-settings-index-removal.mjs"
if exist "scripts\verify-mobile-settings-screen-replacement-v19.mjs" del /q "scripts\verify-mobile-settings-screen-replacement-v19.mjs"
if exist "scripts\verify-mobile-ui-phase6-10.mjs" del /q "scripts\verify-mobile-ui-phase6-10.mjs"
if exist "scripts\verify-mobile-ui-phase6-11-profile-home-instant.mjs" del /q "scripts\verify-mobile-ui-phase6-11-profile-home-instant.mjs"
if exist "scripts\verify-mobile-ui-phase6-9.mjs" del /q "scripts\verify-mobile-ui-phase6-9.mjs"
if exist "scripts\verify-public-language-mirror.mjs" del /q "scripts\verify-public-language-mirror.mjs"
if exist "scripts\verify-sidebar-atmospheres.mjs" del /q "scripts\verify-sidebar-atmospheres.mjs"
echo.
echo Cleanup complete.
echo Review GitHub Desktop: the retired scripts should appear as deleted files.
echo Commit those deletions together with V1.26.1.
pause
