@echo off
rem Lance Live sur ce PC : construit le site si besoin, puis demarre le serveur.
rem Les participants se connectent via le Wi-Fi (adresse affichee ci-dessous).
cd /d "%~dp0"
if not exist node_modules (
  echo Installation des dependances, une seule fois...
  call npm install
)
if not exist dist (
  echo Construction du site...
  call npm run build
)
start "" http://localhost:3000
call npm start
pause
