package com.jak.mdsquickwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.Toast
import java.time.Instant
import java.time.ZoneId

class QuickWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = refreshAll(context)
    override fun onReceive(context: Context, intent: Intent) {
        // Capture before disk reads or UI work; never use the later transfer time.
        val tappedAt = System.currentTimeMillis()
        if (intent.action != ACTION_QUICK) { super.onReceive(context, intent); return }
        try {
            val offset = ZoneId.systemDefault().rules.getOffset(Instant.ofEpochMilli(tappedAt)).totalSeconds
            CaptureStore.append(context, CaptureTime(tappedAt, offset))
            refreshAll(context)
        } catch (_: Exception) {
            Toast.makeText(context, "Time could not be saved. Please try again.", Toast.LENGTH_LONG).show()
        }
    }
    companion object {
        const val ACTION_QUICK = "com.jak.mdsquickwidget.QUICK"
        fun refreshAll(context: Context) {
            val runs = try { CaptureStore.read(context) } catch (_: Exception) { null }
            val current = runs?.lastOrNull()
            val index = if (current == null || current.times.size == 4) 0 else current.times.size
            val manager = AppWidgetManager.getInstance(context)
            manager.getAppWidgetIds(ComponentName(context, QuickWidgetProvider::class.java)).forEach { id ->
                val views = RemoteViews(context.packageName, R.layout.quick_widget)
                views.setTextViewText(R.id.quickLog, CaptureRun.ACTION_LABELS[index])
                views.setTextViewText(R.id.status, when {
                    runs == null -> "Open MDS Quick Log to check saved times"
                    current == null -> "Tap to save the current time"
                    else -> "${CaptureRun.STAGE_LABELS[current.times.lastIndex]} saved · ${current.times.last().timeLabel()}"
                })
                val tap = Intent(context, QuickWidgetProvider::class.java).setAction(ACTION_QUICK)
                views.setOnClickPendingIntent(R.id.quickLog, PendingIntent.getBroadcast(context, id, tap,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                manager.updateAppWidget(id, views)
            }
        }
    }
}
