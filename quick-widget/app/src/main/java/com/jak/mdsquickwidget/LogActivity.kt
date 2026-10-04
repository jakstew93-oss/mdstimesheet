package com.jak.mdsquickwidget

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.time.format.DateTimeFormatter

class LogActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState) }
    override fun onResume() { super.onResume(); render() }
    private fun copyTimes(run: CaptureRun) {
        val payload = "MDS-WIDGET:" + CaptureStore.json(run).put("version", 1).toString()
        getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("MDS recorded times", payload))
        AlertDialog.Builder(this).setTitle("Times copied")
            .setMessage("Open your MDS home-screen app, tap Import widget times, then paste. Your recorded times stay in Quick Log.")
            .setPositiveButton("OK", null).show()
    }
    @Suppress("DEPRECATION")
    private fun openInstalledTimesheet(run: CaptureRun) {
        val payload = CaptureStore.json(run).put("version", 1).toString()
        val uri = Uri.parse(InstalledTimesheet.URL + "#mds-widget=" + Uri.encode(payload))
        val view = Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
        try {
            val installed = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
                .filter { InstalledTimesheet.matches(it.packageName, it.metaData?.getString("org.chromium.webapk.shell_apk.startUrl")) }
            for (app in installed) {
                val target = packageManager.queryIntentActivities(Intent(view).setPackage(app.packageName), PackageManager.MATCH_ALL)
                    .firstOrNull { it.activityInfo.exported } ?: continue
                try {
                    startActivity(Intent(view).setComponent(ComponentName(app.packageName, target.activityInfo.name)))
                    return
                } catch (_: Exception) { /* Try another installation before offering copy. */ }
            }
        } catch (_: Exception) { /* Captured records remain available. */ }
        AlertDialog.Builder(this).setTitle("Open your MDS home-screen app")
            .setMessage("Android could not find an installed MDS app to open directly. You can copy these times, open your existing MDS home-screen icon, and tap Import widget times.")
            .setPositiveButton("Copy times") { _, _ -> copyTimes(run) }
            .setNegativeButton("Cancel", null).show()
    }
    private fun render() {
        val dp = resources.displayMetrics.density
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding((22*dp).toInt(), (28*dp).toInt(), (22*dp).toInt(), (28*dp).toInt())
            setBackgroundColor(Color.rgb(16,21,19))
        }
        fun text(value: String, size: Float = 16f) = TextView(this).apply {
            text = value; textSize = size; setTextColor(Color.rgb(237,245,239)); setPadding(0,12,0,12)
        }
        root.addView(text("MDS Quick Log 2", 27f))
        root.addView(text("One tap on the widget saves the current time, even offline. Open a recorded set below when you’re ready to add the job details in your timesheet."))
        val manager = getSystemService(AppWidgetManager::class.java)
        if (manager.isRequestPinAppWidgetSupported) root.addView(Button(this).apply {
            text = "Add home-screen button"
            setOnClickListener { manager.requestPinAppWidget(ComponentName(this@LogActivity, QuickWidgetProvider::class.java), null, null) }
        })
        val runs = try { CaptureStore.read(this) } catch (_: Exception) {
            root.addView(text("Saved times could not be read. They have been kept on this device."))
            setContentView(ScrollView(this).apply { addView(root) }); return
        }
        if (runs.isEmpty()) root.addView(text("No times recorded yet. Add the widget, then tap START WORK."))
        runs.asReversed().forEach { run ->
            root.addView(text(run.times.first().localTime().format(DateTimeFormatter.ofPattern("EEE d MMM yyyy")), 20f))
            run.times.forEachIndexed { i, time -> root.addView(text("${CaptureRun.STAGE_LABELS[i]}   ${time.timeLabel()}")) }
            root.addView(Button(this).apply {
                text = "Use in installed MDS app"
                setOnClickListener { openInstalledTimesheet(run) }
            })
            root.addView(Button(this).apply {
                text = "Copy times for MDS app"
                setOnClickListener { copyTimes(run) }
            })
        }
        setContentView(ScrollView(this).apply { addView(root) })
    }
}
