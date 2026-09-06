package com.jak.mdsquickwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.time.LocalTime
import java.time.format.DateTimeFormatter

class QuickWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { update(context, manager, it, "Jak • Test mode") }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_LOG) {
            val type = intent.getStringExtra(EXTRA_TYPE) ?: return
            val time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(android.content.ComponentName(context, QuickWidgetProvider::class.java))
            ids.forEach { update(context, manager, it, "$type • $time • TEST") }
        }
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int, text: String) {
        val views = RemoteViews(context.packageName, R.layout.quick_widget)
        views.setTextViewText(R.id.status, text)
        bind(context, views, R.id.start, "START", id * 10 + 1)
        bind(context, views, R.id.onSite, "ON SITE", id * 10 + 2)
        bind(context, views, R.id.offSite, "OFF SITE", id * 10 + 3)
        bind(context, views, R.id.finish, "FINISH", id * 10 + 4)
        manager.updateAppWidget(id, views)
    }

    private fun bind(context: Context, views: RemoteViews, viewId: Int, type: String, requestCode: Int) {
        val intent = Intent(context, QuickWidgetProvider::class.java).apply {
            action = ACTION_LOG
            putExtra(EXTRA_TYPE, type)
        }
        val pending = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setOnClickPendingIntent(viewId, pending)
    }

    companion object {
        const val ACTION_LOG = "com.jak.mdsquickwidget.LOG"
        const val EXTRA_TYPE = "type"
    }
}
