@echo off
cd /d "c:\Users\Dell\Documents\workload-balance-monitor"
pnpm --filter @workload/web build > build.log 2>&1
if %ERRORLEVEL%==0 (
  echo BUILD_OK > build.status
) else (
  echo BUILD_FAIL > build.status
)