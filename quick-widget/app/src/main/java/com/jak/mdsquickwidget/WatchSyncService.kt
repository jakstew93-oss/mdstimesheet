package com.jak.mdsquickwidget

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

/** Saves each set the watch sends, and offers to add it to the timesheet once Finish is tapped. */
class WatchSyncService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED || event.dataItem.uri.path?.startsWith(PATH_PREFIX) != true) continue
            val json = DataMapItem.fromDataItem(event.dataItem).dataMap.getString(KEY_RUN) ?: continue
            val run = try { CaptureStore.fromJson(JSONObject(json)) } catch (_: Exception) { continue }
            if (run.source != CaptureRun.WATCH) continue
            val before = try { CaptureStore.upsert(this, run) } catch (_: Exception) { continue }
            if (run.complete && before?.complete != true) notifyFinished(run)
        }
    }

    private fun notifyFinished(run: CaptureRun) {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Days logged on the watch", NotificationManager.IMPORTANCE_DEFAULT))
        val open = Intent(this, LogActivity::class.java).putExtra(LogActivity.EXTRA_RUN_ID, run.id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val tap = PendingIntent.getActivity(this, run.id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val times = run.times.mapIndexed { i, t -> CaptureRun.STAGE_LABELS[i] + " " + t.shortLabel() }.joinToString(" · ")
        val notification = Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_today)
            .setContentTitle("Day recorded on watch")
            .setContentText("Tap to add it to your timesheet")
            .setStyle(Notification.BigTextStyle().bigText("$times\nTap to add it to your timesheet."))
            .setContentIntent(tap).setAutoCancel(true).build()
        manager.notify(run.id.hashCode(), notification)
    }

    companion object {
        const val PATH_PREFIX = "/mds/run/"
        const val KEY_RUN = "run"
        private const val CHANNEL = "watch-days"
    }
}
