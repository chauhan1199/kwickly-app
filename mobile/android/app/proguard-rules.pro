# React Native core rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep native modules & TurboModules
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }

# Razorpay Proguard Rules
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !class/merging/vertical*,!class/merging/horizontal*

# React Native Maps
-keep class com.airbnb.android.react.maps.** { *; }

# React Native SVG & Screens
-keep class com.horcrux.svg.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# Network & WebSockets
-dontwarn okio.**
-dontwarn okhttp3.**
