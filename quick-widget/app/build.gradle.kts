plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "com.jak.mdsquickwidget"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.jak.mdsquickwidget.installed"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "1.5-installed-app"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies { testImplementation("junit:junit:4.13.2") }
