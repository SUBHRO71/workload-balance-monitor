@echo off
cd /d "c:\Users\Dell\Documents\workload-balance-monitor"
setlocal enabledelayedexpansion
call node_modules\.bin\eslint.cmd apps/web/src > lint.log 2>&1
if !ERRORLEVEL!==0 (
  echo LINT_OK > lint.status
) else (
  echo LINT_FAIL > lint.status
)