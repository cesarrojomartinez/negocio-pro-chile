@echo off
chcp 65001 > nul
title Mi Negocio al Día - Servidor Local

:: 1. Ir automáticamente a la carpeta raíz del proyecto (sin rutas fijas)
cd /d "%~dp0"

echo ===================================================
echo   Iniciando Mi Negocio al Día...
echo ===================================================
echo.

:: 2. Verificar disponibilidad de Node.js y npm en el sistema
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else (
        echo [ERROR] No se encontró Node.js instalado en el equipo.
        echo Instale Node.js LTS para ejecutar el servidor.
        pause
        exit /b 1
    )
)

:: 3. Monitorear inicio del servidor para abrir el navegador automáticamente
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "^
    $listo = $false; ^
    for ($i = 0; $i -lt 35; $i++) { ^
        try { ^
            $resp = Invoke-WebRequest -Uri 'http://localhost:8080' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; ^
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) { $listo = $true; break; } ^
        } catch { ^
            Start-Sleep -Seconds 1; ^
        } ^
    }; ^
    if ($listo) { ^
        Start-Process 'http://localhost:8080'; ^
    } ^
"

echo Servidor iniciado
echo Abriendo visor...
echo.
echo Presiona Ctrl+C en esta ventana para detener el servidor.
echo.

:: 4. Iniciar el servidor de desarrollo (npm run dev)
call npm run dev

pause
