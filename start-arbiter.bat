@echo off
setlocal

title 2x2 Arbiter

echo Starting 2x2 Arbiter through WSL...
echo.

wsl.exe -- bash -lc "cd /home/llent/2x2-build/arbiter && exec ./target/release/arbiter --config /mnt/c/RBXBanland/services/arbiter/2x2-config.json --rcc-path /home/llent/2x2-build/engine/build/linux-rcc-release/RCCService/RCCService"

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo Arbiter exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
