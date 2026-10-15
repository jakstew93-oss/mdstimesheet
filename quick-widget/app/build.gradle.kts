plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

// Signed with the MDS key from the MDS_SIGNING_KEYSTORE GitHub secret, so updates install over the
// previous version and the phone and watch apps can talk to each other.
val mdsKeystore = System.getenv("MDS_KEYSTORE_PATH")?.let { file(it) }?.takeIf { it.exists() }

android {
    namespace = "com.jak.mdsquickwidget"
    compileSdk = 35
    defaultConfig {
        // The watch app uses the same ID and signing key so the two can talk to each other.
        applicationId = "com.jak.mdsquickwidget.installed"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "1.6-watch"
    }
    signingConfigs {
        if (mdsKeystore != null) create("mds") {
            storeFile = mdsKeystore; storePassword = "mdsquicklog"; keyAlias = "mds"; keyPassword = "mdsquicklog"
        }
    }
    buildTypes { getByName("debug") { if (mdsKeystore != null) signingConfig = signingConfigs.getByName("mds") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core"))
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
    testImplementation("junit:junit:4.13.2")
}
