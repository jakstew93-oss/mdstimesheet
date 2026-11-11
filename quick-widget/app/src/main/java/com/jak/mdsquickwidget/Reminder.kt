package com.jak.mdsquickwidget

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

/**
 * The Sunday reminder to send the week's timesheet. The page decides who gets it (sunday-reminder.js) and
 * tells the app which weeks have been sent; a week is named by its week-ending Sunday, as yyyy-MM-dd.
 */
object Reminder {
    private const val PREFS = "reminder"
    private const val CHANNEL = "timesheet-due"
    private const val ID = 9001

    /** The next Sunday at [hour]:[minute] after [now]. */
    fun next(now: ZonedDateTime, hour: Int, minute: Int): ZonedDateTime {
        val at = now.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)).withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        return if (at.isAfter(now)) at else at.plusWeeks(1)
    }

    /** Whether to remind at [now]: a Sunday, at or after the time, whose week is neither sent nor already reminded about. */
    fun due(now: ZonedDateTime, hour: Int, minute: Int, sent: Set<String>, reminded: String?): Boolean {
        if (now.dayOfWeek != DayOfWeek.SUNDAY) return false
        if (now.toLocalTime().isBefore(java.time.LocalTime.of(hour, minute))) return false
        val week = now.toLocalDate().toString()
        return week !in sent && week != reminded
    }

    /** Called by the page with {enabled, hour, minute, sentWeeks}. */
    fun save(context: Context, json: JSONObject) {
        val weeks = json.optJSONArray("sentWeeks")
        val sent = (0 until (weeks?.length() ?: 0)).mapNotNull { weeks?.optString(it)?.takeIf { w -> w.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) } }.toSet()
        prefs(context).edit()
            .putBoolean("enabled", json.optBoolean("enabled", false))
            .putInt("hour", json.optInt("hour", 9).coerceIn(0, 23))
            .putInt("minute", json.optInt("minute", 0).coerceIn(0, 59))
            .putStringSet("sent", sent)
            .apply()
        schedule(context)
    }

    /** Sets (or clears) the alarm for the next Sunday. Safe to call at any time. */
    fun schedule(context: Context) {
        val p = prefs(context)
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val alarm = PendingIntent.getBroadcast(context, ID, Intent(context, ReminderReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        if (!p.getBoolean("enabled", false)) { alarms.cancel(alarm); return }
        val at = next(ZonedDateTime.now(), p.getInt("hour", 9), p.getInt("minute", 0)).toInstant().toEpochMilli()
        try {
            if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm)
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm)
        } catch (_: SecurityException) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm)
        }
    }

    /** Reminds if it's due, then sets the alarm for next time. Run by the alarm, and after a restart in case 9am was missed. */
    fun check(context: Context) {
        val p = prefs(context)
        val now = ZonedDateTime.now()
        if (p.getBoolean("enabled", false) &&
            due(now, p.getInt("hour", 9), p.getInt("minute", 0), p.getStringSet("sent", emptySet()) ?: emptySet(), p.getString("reminded", null))) {
            p.edit().putString("reminded", now.toLocalDate().toString()).apply()
            notify(context, now)
        }
        schedule(context)
    }

    private fun notify(context: Context, now: ZonedDateTime) {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Timesheet due", NotificationManager.IMPORTANCE_HIGH))
        val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val tap = PendingIntent.getActivity(context, ID, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val week = now.format(DateTimeFormatter.ofPattern("EEE d MMM", Locale.UK))
        val text = "The timesheet for week ending $week hasn’t been sent to the office yet."
        val notification = Notification.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_today)
            .setContentTitle("Timesheet due today")
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText("$text Tap to open MDS Timesheet and send it."))
            .setContentIntent(tap).setAutoCancel(true).build()
        manager.notify(ID, notification)
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

/** The Sunday alarm, and the moments Android drops alarms: a restart, an app update, or a clock change. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = Reminder.check(context)
}

/** Android's share menu reports here once an app is picked, so the page can log a timesheet as sent. */
class ShareReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val chosen = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT, ComponentName::class.java)
            else @Suppress("DEPRECATION") intent.getParcelableExtra<ComponentName>(Intent.EXTRA_CHOSEN_COMPONENT)
        val app = chosen?.let {
            try { context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(it.packageName, 0)).toString() }
            catch (_: Exception) { "" }
        } ?: ""
        val last = JSONObject().put("name", intent.getStringExtra(NAME) ?: "").put("app", app).put("at", System.currentTimeMillis())
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(LAST, last.toString()).apply()
    }

    companion object {
        const val NAME = "name"
        private const val PREFS = "share"
        private const val LAST = "last"
        /** The last file shared from the app as {name, app, at}, or an empty string. */
        fun last(context: Context): String = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(LAST, "") ?: ""
    }
}
