package com.jak.mdsquickwidget

import org.junit.Assert.*
import org.junit.Test

class InstalledTimesheetTest {
    @Test fun findsOnlyTheCorrectChromeInstalledApp() {
        assertTrue(InstalledTimesheet.matches("org.chromium.webapk.a1", InstalledTimesheet.URL))
        assertTrue(InstalledTimesheet.matches("org.chromium.webapk.a1", InstalledTimesheet.URL + "index.html?source=home"))
        assertFalse(InstalledTimesheet.matches("com.android.chrome", InstalledTimesheet.URL))
        assertFalse(InstalledTimesheet.matches("org.chromium.webapk.a1", "https://jakstew93-oss.github.io/other/"))
        assertFalse(InstalledTimesheet.matches("org.chromium.webapk.a1", "https://jakstew93-oss.github.io/mdstimesheet-other/"))
        assertFalse(InstalledTimesheet.matches("org.chromium.webapk.a1", "https://jakstew93-oss.github.io.evil.example/mdstimesheet/"))
        assertFalse(InstalledTimesheet.matches("org.chromium.webapk.a1", null))
    }
}
