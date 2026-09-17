@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
set "ANDROID_HOME=C:\Users\chauh\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo ========================================================
echo  Kwickly Mobile — Compiling Standalone Release APK
echo ========================================================
echo JAVA_HOME: %JAVA_HOME%
echo ANDROID_HOME: %ANDROID_HOME%
echo.

cd /d "d:\kwickly\11-4-26\mobile"

echo --------------------------------------------------------
echo  STEP 1: Clearing Metro cache...
echo --------------------------------------------------------
rmdir /s /q node_modules\.cache 2>nul
echo Metro cache cleared.

echo.
echo --------------------------------------------------------
echo  STEP 2: Creating assets folder...
echo --------------------------------------------------------
mkdir android\app\src\main\assets 2>nul

echo.
echo --------------------------------------------------------
echo  STEP 3: Bundling JavaScript (release mode)...
echo --------------------------------------------------------
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android\app\src\main\assets\index.android.bundle --assets-dest android\app\src\main\res --reset-cache
if %ERRORLEVEL% neq 0 (
    echo ERROR: JavaScript bundle failed! Aborting build.
    pause
    exit /b 1
)
echo JS bundle created successfully.

echo.
echo --------------------------------------------------------
echo  STEP 4: Building release APK with Gradle...
echo --------------------------------------------------------
cd /d "d:\kwickly\11-4-26\mobile\android"
call gradlew.bat assembleRelease --no-daemon -PbundleInRelease=false
if %ERRORLEVEL% neq 0 (
    echo ERROR: Gradle build failed!
    pause
    exit /b 1
)

cd /d "d:\kwickly\11-4-26\mobile"
set "APK_SRC="
if exist "android\app\build\outputs\apk\release\app-universal-release.apk" set "APK_SRC=android\app\build\outputs\apk\release\app-universal-release.apk"
if not defined APK_SRC if exist "android\app\build\outputs\apk\release\app-release.apk" set "APK_SRC=android\app\build\outputs\apk\release\app-release.apk"
if not defined APK_SRC if exist "android\app\build\outputs\apk\release\app-arm64-v8a-release.apk" set "APK_SRC=android\app\build\outputs\apk\release\app-arm64-v8a-release.apk"

if defined APK_SRC (
    copy /Y "%APK_SRC%" "kwickly.apk"
    copy /Y "%APK_SRC%" "..\kwickly.apk"
    echo.
    echo ========================================================
    echo  SUCCESS: APK Created!
    echo  Source: %APK_SRC%
    echo  Mobile: d:\kwickly\11-4-26\mobile\kwickly.apk
    echo  Root:   d:\kwickly\11-4-26\kwickly.apk
    echo ========================================================
) else (
    echo.
    echo Checking build outputs...
    dir "android\app\build\outputs\apk\release\*.apk"
)

echo Build process complete.
