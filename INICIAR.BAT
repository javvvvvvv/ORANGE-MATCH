@echo off
setlocal enabledelayedexpansion
title Orange Match - Servidor
color 0A
cls

echo.
echo  ============================================
echo    ORANGE MATCH - Servidor
echo  ============================================
echo.

:: Se autolocaliza: no hace falta editar rutas.
set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend
set PORT=3000

if not exist "%BACKEND%\server.js" (
    echo  [ERROR] No se encontro backend\server.js junto a este BAT.
    pause
    exit /b 1
)

:: Abrir puerto en el firewall si no existe la regla
netsh advfirewall firewall show rule name="OrangeMatch" >nul 2>&1
if errorlevel 1 (
    echo  Abriendo puerto %PORT% en el firewall...
    netsh advfirewall firewall add rule name="OrangeMatch" protocol=TCP dir=in localport=%PORT% action=allow >nul
    netsh advfirewall firewall add rule name="OrangeMatch" protocol=TCP dir=out localport=%PORT% action=allow >nul
)

:: Instalar dependencias si es la primera vez, o si el backend ya existe
:: pero quedó con node_modules incompleto/roto (por ejemplo, si se copió la
:: carpeta desde otra PC o se actualizó Node sin reinstalar).
if not exist "%BACKEND%\node_modules" (
    echo  Instalando dependencias del backend...
    pushd "%BACKEND%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] No se pudieron instalar las dependencias del backend.
        popd
        pause
        exit /b 1
    )
    popd
) else (
    cd /d "%BACKEND%"
    node -e "require('better-sqlite3-multiple-ciphers')" >nul 2>&1
    if errorlevel 1 (
        echo  [AVISO] node_modules del backend esta roto o es de otra version de Node.
        echo  Reinstalando dependencias del backend...
        rmdir /s /q node_modules
        call npm install
        if errorlevel 1 (
            echo [ERROR] No se pudieron reinstalar las dependencias del backend.
            pause
            exit /b 1
        )
    )
    cd /d "%ROOT%"
)
if not exist "%FRONTEND%\node_modules" (
    echo  Instalando dependencias del frontend...
    pushd "%FRONTEND%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] No se pudieron instalar las dependencias del frontend.
        popd
        pause
        exit /b 1
    )
    popd
)

:: Compilar el frontend (genera frontend\dist, que el backend sirve)
echo  Compilando frontend...
pushd "%FRONTEND%"
call npm run build
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion del frontend. El servidor NO se iniciara.
    popd
    pause
    exit /b 1
)
popd

:: Verificacion rapida de base y datos cifrados
pushd "%BACKEND%"
node scripts\verify-install.mjs
if errorlevel 1 (
    echo [ERROR] La verificacion de datos encontro problemas. El servidor NO se iniciara.
    popd
    pause
    exit /b 1
)
popd

:: Arrancar con PM2 (si esta instalado) para que quede corriendo en segundo
:: plano y sobreviva a reinicios; si no, cae a "node" directo.
where pm2 >nul 2>&1
if errorlevel 1 (
    echo  PM2 no esta instalado, arrancando con Node directo...
    cd /d "%BACKEND%"
    node server.js
    goto :fin
)

call pm2 delete orange-match >nul 2>&1
call pm2 start "%BACKEND%\server.js" --name orange-match --cwd "%BACKEND%"
call pm2 save

:: Detectar IP local (LAN) e IP Hamachi (rango 25.x)
set LOCAL_IP=No detectada
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4"') do (
    set TMPIP=%%A
    set TMPIP=!TMPIP: =!
    if not "!TMPIP:~0,3!"=="25." (
        set LOCAL_IP=!TMPIP!
        goto :got_local
    )
)
:got_local

set HAMACHI_IP=No detectada
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4"') do (
    set TMPIP=%%A
    set TMPIP=!TMPIP: =!
    if "!TMPIP:~0,3!"=="25." (
        set HAMACHI_IP=!TMPIP!
        goto :got_hamachi
    )
)
:got_hamachi

echo.
echo  ============================================
echo   SERVIDOR ACTIVO (segundo plano, vía PM2)
echo.
echo   Local:       http://localhost:%PORT%
echo   Red local:   http://%LOCAL_IP%:%PORT%
if not "%HAMACHI_IP%"=="No detectada" (
    echo   Hamachi:     http://%HAMACHI_IP%:%PORT%
)
echo  ============================================
echo.
echo  Puedes cerrar esta ventana. Usa CONTROL.BAT para ver logs o detenerlo.
echo.

:fin
pause
