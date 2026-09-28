@echo off
chcp 65001 > nul
title خادم موقع المَذْخُورَة للتمور - الشبكة المحلية (WiFi)
cd /d "%~dp0"

echo ========================================================
echo   🌴 تشغيل نظام المَذْخُورَة كموقع ويب على الشبكة المحلية
echo   Al-Madkhoorah Dates Web Server (WiFi / Localhost)
echo ========================================================
echo.
echo جاري فحص بيئة التشغيل وتحديد خادم الويب الأنسب...
echo.

:: 1. تجربة تشغيل Node.js إذا كان مثبتاً
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] تم العثور على Node.js - جاري تشغيل خادم الويب...
    node server.js
    goto end
)

:: 2. تجربة تشغيل Python إذا كان مثبتاً
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] تم العثور على Python - جاري تشغيل خادم الويب...
    python server.py
    goto end
)

:: 3. التشغيل عبر خادم PowerShell المدمج في ويندوز (بدون الحاجة لأي برامج إضافية)
echo [OK] جاري تشغيل خادم الويب بواسطة Windows PowerShell المدمج...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

:end
pause
