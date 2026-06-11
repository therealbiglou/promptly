@echo off
rem Build promptly-camera-bridge.exe against the Panasonic Lumix Remote Control Library.
rem Requires Visual Studio (Build) Tools with the C++ workload. The SDK folder is
rem expected at the repo root (gitignored, machine-local). If absent, this is a no-op
rem so `npm run prebuild` never fails on a machine without the SDK.
setlocal
rem Ensure core Windows tools (findstr, where, vswhere) are reachable even if the
rem parent shell launched with a stripped-down PATH.
set "PATH=%SystemRoot%\System32;%SystemRoot%;%PATH%"
set "HERE=%~dp0"
set "SDK=%HERE%..\..\LumixRemoteControlLibraryBeta1.00\Library"

if not exist "%SDK%\Lmxptpif.lib" (
  echo [camera-bridge] SDK not found at %SDK% - skipping native bridge build.
  exit /b 0
)

rem Resolve vswhere into a variable first so the (x86) parentheses don't break the for-loop.
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -prerelease -products * -property installationPath`) do set "VSPATH=%%i"
if "%VSPATH%"=="" (
  echo [camera-bridge] Visual Studio Build Tools not found - skipping native bridge build.
  exit /b 0
)

call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 ( echo [camera-bridge] vcvars64 failed & exit /b 1 )

cl /nologo /EHsc /std:c++17 /O2 /MT "%HERE%bridge.cpp" ^
   /Fe:"%HERE%promptly-camera-bridge.exe" /Fo:"%HERE%bridge.obj" ^
   /I "%SDK%" /link "%SDK%\Lmxptpif.lib"
if errorlevel 1 ( echo [camera-bridge] compile failed & exit /b 1 )

copy /Y "%SDK%\Lmxptpif.dll" "%HERE%Lmxptpif.dll" >nul
del /Q "%HERE%bridge.obj" 2>nul
echo [camera-bridge] Built promptly-camera-bridge.exe
endlocal
