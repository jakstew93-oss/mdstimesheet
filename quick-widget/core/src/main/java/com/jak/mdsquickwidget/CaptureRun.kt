package com.jak.mdsquickwidget

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class CaptureTime(val epochMillis: Long, val offsetSeconds: Int) {
    fun localTime() = Instant.ofEpochMilli(epochMillis).atOffset(ZoneOffset.ofTotalSeconds(offsetSeconds))
    fun timeLabel(): String = localTime().format(DateTimeFormatter.ofPattern("HH:mm:ss"))
    fun shortLabel(): String = localTime().format(DateTimeFormatter.ofPattern("HH:mm"))
}

data class CaptureRun(val id: String, val times: List<CaptureTime>, val source: String = PHONE) {
    val complete get() = times.size == 4

    companion object {
        const val PHONE = "phone"
        const val WATCH = "watch"
        val STAGE_LABELS = listOf("Start", "On site", "Off site", "Finish")
        val ACTION_LABELS = listOf("START WORK", "ARRIVED ON SITE", "LEAVING SITE", "FINISH WORK")
        // A set left unfinished this long is treated as forgotten, so the next tap starts today's set.
        // 18 hours still lets a shift that runs past midnight carry on.
        const val OPEN_LIMIT_MILLIS = 18L * 60 * 60 * 1000

        /** True while [run] is still taking taps at [now]: unfinished and started within [OPEN_LIMIT_MILLIS]. */
        fun isOpen(run: CaptureRun?, now: Long) =
            run != null && !run.complete && now - run.times.first().epochMillis < OPEN_LIMIT_MILLIS

        /** Index into [STAGE_LABELS] of the next tap from [source] at [now]. */
        fun nextIndex(runs: List<CaptureRun>, source: String, now: Long): Int {
            val last = runs.lastOrNull { it.source == source }
            return if (isOpen(last, now)) last!!.times.size else 0
        }

        /** Adds [tap] to the open set from [source], or starts a new set. Phone and watch sets never mix. */
        fun append(runs: List<CaptureRun>, tap: CaptureTime, source: String = PHONE, newId: () -> String): List<CaptureRun> {
            val last = runs.lastOrNull { it.source == source }
            if (!isOpen(last, tap.epochMillis)) return runs + CaptureRun(newId(), listOf(tap), source)
            return runs.map { if (it.id == last!!.id) it.copy(times = it.times + tap) else it }
        }

        /** Saves a set received from the watch, keeping whichever copy has more taps. Returns the previous copy. */
        fun upsert(runs: List<CaptureRun>, incoming: CaptureRun): Pair<List<CaptureRun>, CaptureRun?> {
            val existing = runs.firstOrNull { it.id == incoming.id }
            if (existing != null && existing.times.size >= incoming.times.size) return runs to existing
            val updated = (runs.filter { it.id != incoming.id } + incoming).sortedBy { it.times.first().epochMillis }
            return updated to existing
        }
    }
}
