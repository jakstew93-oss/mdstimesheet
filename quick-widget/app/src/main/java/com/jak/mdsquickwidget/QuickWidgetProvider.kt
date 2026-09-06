package com.jak.mdsquickwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.time.LocalTime
import java.time.format.DateTimeFormatter

class QuickWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { refreshAll(context) }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        when (intent.action) {
            ACTION_QUICK -> {
                val job = prefs.getString("job", "").orEmpty()
                if (job.isBlank()) { launchEditor(context, "SET JOB"); return }
                val stages = arrayOf("START", "ON SITE", "OFF SITE", "FINISH")
                val index = prefs.getInt("stage", 0).coerceIn(0, 3)
                val type = stages[index]
                val time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
                prefs.edit().putString("status", "$type • $time • Job $job • TEST").putInt("stage", (index + 1).coerceAtMost(3)).apply()
                refreshAll(context)
            }
            ACTION_RESET -> {
                prefs.edit().remove("job").putInt("stage", 0).putString("status", "Job cleared • TEST").apply()
                refreshAll(context)
            }
        }
    }

    private fun launchEditor(context: Context, type: String) {
        context.startActivity(Intent(context, LogActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK; putExtra(EXTRA_TYPE, type) })
    }

    companion object {
        const val PREFS = "mds_quick_widget"
        const val ACTION_QUICK = "com.jak.mdsquickwidget.QUICK"
        const val ACTION_RESET = "com.jak.mdsquickwidget.RESET"
        const val EXTRA_TYPE = "type"

        fun refreshAll(context: Context) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val job = prefs.getString("job", "").orEmpty()
            val status = prefs.getString("status", "Jak • Test mode") ?: "Jak • Test mode"
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, QuickWidgetProvider::class.java))
            ids.forEach { id ->
                val views = RemoteViews(context.packageName, R.layout.quick_widget)
                views.setTextViewText(R.id.job, if (job.isBlank()) "JOB: TAP TO SET" else "JOB: $job")
                views.setTextViewText(R.id.status, status)
                editor(context, views, R.id.job, "SET JOB", id * 20)
                editor(context, views, R.id.start, "START", id * 20 + 1)
                editor(context, views, R.id.onSite, "ON SITE", id * 20 + 2)
                editor(context, views, R.id.offSite, "OFF SITE", id * 20 + 3)
                editor(context, views, R.id.finish, "FINISH", id * 20 + 4)
                broadcast(context, views, R.id.quickLog, ACTION_QUICK, id * 20 + 5)
                broadcast(context, views, R.id.resetJob, ACTION_RESET, id * 20 + 6)
                manager.updateAppWidget(id, views)
            }
        }

        private fun editor(context: Context, views: RemoteViews, viewId: Int, type: String, code: Int) {
            val intent = Intent(context, LogActivity::class.java).putExtra(EXTRA_TYPE, type)
            views.setOnClickPendingIntent(viewId, PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }

        private fun broadcast(context: Context, views: RemoteViews, viewId: Int, action: String, code: Int) {
            val intent = Intent(context, QuickWidgetProvider::class.java).setAction(action)
            views.setOnClickPendingIntent(viewId, PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
    }
}
