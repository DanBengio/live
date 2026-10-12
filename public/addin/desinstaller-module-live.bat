@echo off
rem Retire le module PowerPoint "Live".
reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "84c365e6-a511-440e-8849-ace119baf7eb" /f >nul 2>nul
rmdir /s /q "%LOCALAPPDATA%\LiveAddin" 2>nul
echo Module Live retire. Fermez et rouvrez PowerPoint.
pause
