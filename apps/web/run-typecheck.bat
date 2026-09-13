@echo off
cd /d "%~dp0"
pnpm exec tsc --noEmit > typecheck.log 2>&1
echo %ERRORLEVEL% > typecheck.exit
echo DONE