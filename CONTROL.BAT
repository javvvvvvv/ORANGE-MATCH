@echo off
title Orange Match - Control
color 0E
cls

echo.
echo  ============================================
echo    ORANGE MATCH - Panel de Control
echo  ============================================
echo.
echo   [1] Ver estado
echo   [2] Ver logs
echo   [3] Reiniciar
echo   [4] Detener
echo   [5] Salir
echo.
set /p OPCION=  Elige (1-5):

if "%OPCION%"=="1" (
    call pm2 status
    pause
    goto :eof
)
if "%OPCION%"=="2" (
    call pm2 logs orange-match
    goto :eof
)
if "%OPCION%"=="3" (
    call pm2 restart orange-match
    pause
    goto :eof
)
if "%OPCION%"=="4" (
    call pm2 stop orange-match
    pause
    goto :eof
)
