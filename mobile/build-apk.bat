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

cd /d "d:\kwickly\11-4-26\mobile\android"

echo Running gradle assembleRelease...
call gradlew.bat assembleRelease --no-daemon

cd /d "d:\kwickly\11-4-26\mobile"
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy /Y "android\app\build\outputs\apk\release\app-release.apk" "kwickly-app.apk"
    echo.
    echo ========================================================
    echo  SUCCESS: Standalone APK Created Successfully!
    echo  Location: d:\kwickly\11-4-26\mobile\kwickly-app.apk
    echo ========================================================
) else (
    echo.
    echo Checking build outputs...
    dir "android\app\build\outputs\apk\*"
)

echo Build process complete.
