# React Native core rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.fbreact.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep native modules & TurboModules & App Code
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class com.kwicklymobile.** { *; }

# React Native Community & Third Party Packages
-keep class com.airbnb.android.react.maps.** { *; }
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.android.gms.location.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.BV.LinearGradient.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.reactnativecommunity.clipboard.** { *; }
-keep class com.reactnativecommunity.geolocation.** { *; }
-keep class com.reactnativecommunity.netinfo.** { *; }

# Network & WebSockets
-dontwarn okio.**
-dontwarn okhttp3.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn io.socket.**
-keep class io.socket.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Internal modules & safe area
-keep class com.kwickly.smsbridge.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

# Kotlin
-dontwarn kotlin.**
-dontwarn kotlinx.**
