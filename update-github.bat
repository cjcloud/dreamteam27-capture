@echo off
echo ===================================
echo GitHub Update Script
echo ===================================

:: Get current branch name
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%a
echo Current branch: %BRANCH%

:: Add all changes
echo.
echo Adding all changes...
git add .

:: Get commit message from user
echo.
set /p COMMIT_MSG="Enter commit message (or press Enter for default): "

:: Use default message if none provided
if "%COMMIT_MSG%"=="" set COMMIT_MSG="Update authentication guards and Firebase initialization"

:: Commit changes
echo.
echo Committing changes with message: %COMMIT_MSG%
git commit -m %COMMIT_MSG%

:: Push to current branch
echo.
echo Pushing to %BRANCH%...
git push origin %BRANCH%

:: If not on main branch, ask to push to main as well
if NOT "%BRANCH%"=="main" (
  echo.
  set /p PUSH_MAIN="Also push to main branch? (y/n): "
  if /i "%PUSH_MAIN%"=="y" (
    echo.
    echo Pushing to main branch...
    git push origin %BRANCH%:main
  )
)

echo.
echo ===================================
echo Update completed successfully!
echo ===================================

pause
