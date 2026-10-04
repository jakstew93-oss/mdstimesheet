package com.jak.mdsquickwidget

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
import android.widget.Toast
import java.time.format.DateTimeFormatter

class LogActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState) }
    override fun onResume() { super.onResume(); render() }
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
        root.addView(text("MDS Quick Log", 27f))
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
                text = "Use in timesheet"
                setOnClickListener {
                    val payload = CaptureStore.json(run).put("version", 1).toString()
                    val uri = Uri.parse("https://jakstew93-oss.github.io/mdstimesheet/#mds-widget=" + Uri.encode(payload))
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    catch (_: Exception) { Toast.makeText(this@LogActivity, "Open a browser to use your timesheet.", Toast.LENGTH_LONG).show() }
                }
            })
        }
        setContentView(ScrollView(this).apply { addView(root) })
    }
}
