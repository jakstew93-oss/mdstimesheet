package com.jak.mdsquickwidget

import java.net.URI

object InstalledTimesheet {
    const val URL = "https://jakstew93-oss.github.io/mdstimesheet/"
    fun matches(packageName: String, startUrl: String?): Boolean {
        if (!packageName.startsWith("org.chromium.webapk.") || startUrl == null) return false
        return try {
            val uri = URI(startUrl)
            uri.scheme == "https" && uri.host == "jakstew93-oss.github.io" &&
                (uri.port == -1 || uri.port == 443) && uri.rawUserInfo == null &&
                (uri.path == "/mdstimesheet" || uri.path.startsWith("/mdstimesheet/"))
        } catch (_: Exception) { false }
    }
}
