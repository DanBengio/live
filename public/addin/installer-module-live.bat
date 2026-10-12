@echo off
rem Installe le module PowerPoint "Live" pour cet utilisateur Windows (une seule fois par PC).
set "DIR=%LOCALAPPDATA%\LiveAddin"
if not exist "%DIR%" mkdir "%DIR%"
curl -fsSL "https://sondage.baratextile.com/addin/manifest.xml" -o "%DIR%\manifest.xml"
if errorlevel 1 (
  echo Telechargement impossible : verifiez la connexion internet.
  pause
  exit /b 1
)
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "84c365e6-a511-440e-8849-ace119baf7eb" /t REG_SZ /d "%DIR%\manifest.xml" /f >nul
echo.
echo Module Live installe.
echo Fermez PowerPoint s'il est ouvert, puis rouvrez-le :
echo Insertion, Complements, Mes complements, Live.
echo.
pause
