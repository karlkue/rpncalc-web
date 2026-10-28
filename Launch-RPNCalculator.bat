@echo off
title RPN Calculator
set "HTML_PATH=%~dp0index.html"

:: Check for Chrome
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    start "" chrome.exe --app="file:///%HTML_PATH%" --window-size=485,620
    exit /b
)

:: Check for Chrome in Program Files
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%HTML_PATH%" --window-size=485,620
    exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="file:///%HTML_PATH%" --window-size=485,620
    exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="file:///%HTML_PATH%" --window-size=485,620
    exit /b
)

:: Fallback to Microsoft Edge (Installed on all Windows 10/11)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%HTML_PATH%" --window-size=485,620
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%HTML_PATH%" --window-size=485,620
    exit /b
)

:: Fallback standard browser open
start "" "%HTML_PATH%"
