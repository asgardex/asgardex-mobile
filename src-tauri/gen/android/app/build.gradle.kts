import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

val signingProperties = Properties().apply {
    val propFile = file("signing.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

fun envOrProp(key: String, fallback: String? = null): String? {
    val fromEnv = System.getenv(key)
    if (!fromEnv.isNullOrBlank()) return fromEnv
    val fromSigning = signingProperties.getProperty(key)
    if (!fromSigning.isNullOrBlank()) return fromSigning
    val fromTauri = tauriProperties.getProperty(key)
    if (!fromTauri.isNullOrBlank()) return fromTauri
    return fallback
}

android {
    compileSdk = 36
    namespace = "org.thorchain.asgardex"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "org.thorchain.asgardex"
        minSdk = 26
        targetSdk = 36
        // Allow CI to override versionCode via env var for Play Store retry support
        versionCode = (System.getenv("TAURI_ANDROID_VERSION_CODE")
            ?: tauriProperties.getProperty("tauri.android.versionCode", "1")).toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        val defaultUploadKeystore = projectDir.resolve("keystore/upload.keystore").path
        val uploadKeystorePath = envOrProp("ANDROID_UPLOAD_KEYSTORE", defaultUploadKeystore)
        val uploadStorePassword = envOrProp("ANDROID_UPLOAD_KEYSTORE_PASSWORD")
        val uploadKeyAlias = envOrProp("ANDROID_UPLOAD_KEY_ALIAS", "upload")
        val uploadKeyPassword = envOrProp("ANDROID_UPLOAD_KEY_PASSWORD") ?: uploadStorePassword

        if (!uploadKeystorePath.isNullOrBlank() && !uploadStorePassword.isNullOrBlank() && !uploadKeyPassword.isNullOrBlank()) {
            create("upload") {
                storeFile = file(uploadKeystorePath)
                storePassword = uploadStorePassword
                keyAlias = uploadKeyAlias ?: "upload"
                keyPassword = uploadKeyPassword
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
            signingConfig = signingConfigs.findByName("upload") ?: signingConfigs.getByName("debug")
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
