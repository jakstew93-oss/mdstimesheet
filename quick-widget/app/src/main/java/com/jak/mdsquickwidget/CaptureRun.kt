package com.jak.mdsquickwidget

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class CaptureTime(val epochMillis: Long, val offsetSeconds: Int) {
    fun localTime() = Instant.ofEpochMilli(epochMillis).atOffset(ZoneOffset.ofTotalSeconds(offsetSeconds))
    fun timeLabel(): String = localTime().format(DateTimeFormatter.ofPattern("HH:mm:ss"))
}

data class CaptureRun(val id: String, val times: List<CaptureTime>) {
    companion object {
        val STAGE_LABELS = listOf("Start", "On site", "Off site", "Finish")
        val ACTION_LABELS = listOf("START WORK", "ARRIVED ON SITE", "LEAVING SITE", "FINISH WORK")
        fun append(runs: List<CaptureRun>, tap: CaptureTime, newId: () -> String): List<CaptureRun> {
            val last = runs.lastOrNull()
            return if (last == null || last.times.size == 4) runs + CaptureRun(newId(), listOf(tap))
            else runs.dropLast(1) + last.copy(times = last.times + tap)
        }
    }
}
