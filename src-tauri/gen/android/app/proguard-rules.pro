# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# =============================================================================
# Tauri WebView / JavaScript Bridge Rules
# =============================================================================
# These rules are REQUIRED for Tauri apps to work in release builds.
# R8/ProGuard strips classes it thinks are unused, breaking the JS bridge.

# Keep all Tauri classes and their members
-keep class app.tauri.** { *; }

# Keep Tauri plugin classes
-keep class com.plugin.** { *; }

# Keep all classes with @JavascriptInterface methods (critical for IPC)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve the JavascriptInterface annotation itself
-keepattributes JavascriptInterface

# Keep WebView client classes
-keepclassmembers class * extends android.webkit.WebViewClient { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { *; }

# Keep WebView JavaScript interface classes
-keepclassmembers class * {
    @android.webkit.JavascriptInterface *;
}

# =============================================================================
# Debugging (optional but recommended)
# =============================================================================
# Preserve line numbers for better crash stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile