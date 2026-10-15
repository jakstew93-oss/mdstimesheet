plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "com.jak.mdsquickwidget.wear"
    compileSdk = 35
    defaultConfig {
        // Must match the phone app (and be signed with the same key) for the watch to reach it.
        applicationId = "com.jak.mdsquickwidget.installed"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0-watch"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core"))
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
    implementation("androidx.wear.tiles:tiles:1.4.1")
    implementation("androidx.wear.protolayout:protolayout:1.2.1")
    implementation("androidx.wear.protolayout:protolayout-material:1.2.1")
    implementation("com.google.guava:guava:33.3.1-android")
}
