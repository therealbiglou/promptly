@echo off
rem Build promptly-input-bridge.exe (Windows Raw Input helper). Only uses system
rem libraries (user32/kernel32), statically linked (/MT) — nothing to bundle.
rem No-op if the C++ toolchain is absent so `npm run prebuild` never fails.
setlocal
set "PATH=%SystemRoot%\System32;%SystemRoot%;%PATH%"
set "HERE=%~dp0"

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -prerelease -products * -property installationPath`) do set "VSPATH=%%i"
if "%VSPATH%"=="" (
  echo [input-bridge] Visual Studio Build Tools not found - skipping native build.
  exit /b 0
)

call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 ( echo [input-bridge] vcvars64 failed & exit /b 1 )

cl /nologo /EHsc /std:c++17 /O2 /MT "%HERE%input-bridge.cpp" ^
   /Fe:"%HERE%promptly-input-bridge.exe" /Fo:"%HERE%input-bridge.obj"
if errorlevel 1 ( echo [input-bridge] compile failed & exit /b 1 )

del /Q "%HERE%input-bridge.obj" 2>nul
echo [input-bridge] Built promptly-input-bridge.exe
endlocal
