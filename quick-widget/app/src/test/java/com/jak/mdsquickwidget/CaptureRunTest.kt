package com.jak.mdsquickwidget

import org.junit.Assert.*
import org.junit.Test

class CaptureRunTest {
    @Test fun everyTapRetainsItsOriginalMilliseconds() {
        val taps = listOf(1791097200123L, 1791100800456L, 1791127800789L, 1791131400999L)
        var runs = emptyList<CaptureRun>()
        taps.forEach { runs = CaptureRun.append(runs, CaptureTime(it, 3600)) { "run-1" } }
        assertEquals(taps, runs.single().times.map { it.epochMillis })
        val afterFinish = CaptureRun.append(runs, CaptureTime(taps.last()+1, 3600)) { "run-2" }
        assertEquals(2, afterFinish.size)
        assertEquals(runs.single(), afterFinish.first())
        assertEquals(1, afterFinish.last().times.size)
    }
    @Test fun dateChangesDoNotDiscardAnUnfinishedShift() {
        val start = CaptureTime(java.time.Instant.parse("2026-10-04T22:59:59.999Z").toEpochMilli(), 3600)
        val next = CaptureTime(start.epochMillis+2, 3600)
        val runs = CaptureRun.append(listOf(CaptureRun("overnight", listOf(start))), next) { "unused" }
        assertEquals("overnight", runs.single().id)
        assertEquals("23:59:59", runs.single().times[0].timeLabel())
        assertEquals("00:00:00", runs.single().times[1].timeLabel())
    }
    @Test fun capturedTimezoneIsPreserved() {
        val tap = CaptureTime(java.time.Instant.parse("2026-10-04T12:34:56.789Z").toEpochMilli(), 3600)
        assertEquals("13:34:56", tap.timeLabel())
        assertEquals(789000000, tap.localTime().nano)
    }
}
