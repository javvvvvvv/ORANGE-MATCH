@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Orange Match - Recuperacion segura de administrador
color 0C
cls

echo.
echo  ============================================================
echo    ORANGE MATCH - RECUPERAR CONTRASENA DE ADMINISTRADOR
echo  ============================================================
echo.
echo  Este procedimiento es LOCAL y requiere permisos de
echo  administrador de Windows. No expone ninguna ruta HTTP.
echo.
echo  IMPORTANTE:
echo  - Cierra las sesiones de Orange Match.
echo  - El servidor se detendra temporalmente.
echo  - Se generara una contrasena NUEVA y aleatoria.
echo  - La contrasena solo se mostrara en esta ventana.
echo.
pause

:: Comprobar que esta ventana tenga permisos de administrador.
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo.
    echo  Solicitando permisos de administrador de Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

if not exist "%BACKEND%\server.js" (
    echo [ERROR] No se encontro backend\server.js.
    pause
    exit /b 1
)

echo.
echo  [1/4] Deteniendo Orange Match de forma local...

where pm2 >nul 2>&1
if "%errorlevel%"=="0" (
    call pm2 stop orange-match >nul 2>&1
)

:: Si el servidor fue iniciado directamente con node, detener SOLO el
:: proceso cuyo comando contiene el server.js de Orange Match.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ps = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -match 'orange-match.*server\.js|backend[\\/]+server\.js' }; foreach($p in $ps){ Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }"

echo  [2/4] Generando una nueva contrasena aleatoria...

cd /d "%BACKEND%"

set "NEWPASS="
for /f "delims=" %%P in ('node "%BACKEND%\scripts\recover-admin.mjs"') do set "NEWPASS=%%P"

if not defined NEWPASS (
    echo.
    echo  [ERROR] No fue posible recuperar la cuenta admin.
    echo  Verifica que Node.js y las dependencias del backend esten instalados.
    echo.
    pause
    exit /b 2
)

echo.
echo  [3/4] Recuperacion terminada.
echo.
echo  ============================================================
echo    USUARIO:     admin
echo    CONTRASENA:  %NEWPASS%
echo  ============================================================
echo.
echo  ANOTA ESTA CONTRASENA Y CAMBIALA DESDE:
echo    Mi cuenta -> Cambiar contrasena
echo.
echo  No compartas esta ventana ni el archivo BAT.
echo.

:: Reiniciar Orange Match si PM2 esta disponible.
echo  [4/4] Reiniciando Orange Match...
where pm2 >nul 2>&1
if "%errorlevel%"=="0" (
    call pm2 delete orange-match >nul 2>&1
    call pm2 start "%BACKEND%\server.js" --name orange-match --cwd "%BACKEND%" >nul 2>&1
    call pm2 save >nul 2>&1
    echo  Orange Match fue reiniciado mediante PM2.
) else (
    echo  PM2 no esta instalado.
    echo  Ejecuta INICIAR.BAT para volver a levantar el servidor.
)

echo.
echo  Por seguridad, esta ventana se cerrara en 20 segundos.
timeout /t 20 /nobreak >nul
endlocal
