@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo FICONTER - VERCEL BUILD CLEANUP
echo --------------------------------
echo This keeps the approved Unified Mobile UI and removes only stale rollback/deployment helper files.
echo.

if not exist "project_clean\package.json" (
  echo ERROR: project_clean\package.json was not found.
  pause
  exit /b 1
)

if not exist ".git" (
  echo WARNING: .git folder was not found here.
  echo Put/extract this package in the ROOT of your FICONTER repository, then run it again.
  pause
  exit /b 1
)

echo [1/4] Removing stale rollback source trees...
if exist "baseline_restore" rmdir /s /q "baseline_restore"
if exist "upload-to-repository" rmdir /s /q "upload-to-repository"

echo [2/4] Removing rollback helper files...
if exist "APPLY_CLEAN_ROLLBACK.bat" del /f /q "APPLY_CLEAN_ROLLBACK.bat"
if exist "LATER_FILES_TO_REMOVE.txt" del /f /q "LATER_FILES_TO_REMOVE.txt"
if exist "ROLLBACK_README.txt" del /f /q "ROLLBACK_README.txt"
if exist "tsconfig.tsbuildinfo" del /f /q "tsconfig.tsbuildinfo"

echo [3/4] Restoring the clean Unified V1 source...
robocopy "project_clean" "." /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XD ".git" "node_modules" "project_clean" /XF ".env" ".env.local" >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo ERROR: Copy failed with robocopy code %RC%.
  pause
  exit /b %RC%
)

echo [4/4] Removing temporary payload...
rmdir /s /q "project_clean"

echo.
echo CLEANUP COMPLETE.
echo Open GitHub Desktop. You should see deletions for baseline_restore/upload-to-repository plus the clean source changes.
echo Commit and push them, then Vercel can rebuild without type-checking the stale rollback files.
echo.
pause
start "" cmd /c del /f /q "%~f0"
endlocal
