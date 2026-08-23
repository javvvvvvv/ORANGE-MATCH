@echo off
title Orange Match - Verificar instalacion
cd /d "%~dp0backend"
if not exist node_modules (
  echo Primero ejecuta INICIAR.BAT para instalar las dependencias.
  pause
  exit /b 1
)
node scripts\verify-install.mjs
pause
