package com.jak.mdsquickwidget

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

class ReminderTest {
    private val london = ZoneId.of("Europe/London")
    private fun at(date: String, time: String) = LocalDateTime.parse("${date}T$time:00").atZone(london)

    @Test fun theNextAlarmIsTheComingSundayAtNine() {
        assertEquals(at("2026-11-15", "09:00"), Reminder.next(at("2026-11-11", "14:30"), 9, 0))
        assertEquals(at("2026-11-15", "09:00"), Reminder.next(at("2026-11-15", "08:59"), 9, 0))
    }

    @Test fun onceNineHasPassedOnSundayTheNextAlarmIsAWeekLater() {
        assertEquals(at("2026-11-22", "09:00"), Reminder.next(at("2026-11-15", "09:00"), 9, 0))
        assertEquals(at("2026-11-22", "09:00"), Reminder.next(at("2026-11-15", "18:00"), 9, 0))
    }

    @Test fun theAlarmStaysAtNineAcrossTheClockChange() {
        // The clocks go forward on Sunday 28 March 2027.
        val next = Reminder.next(at("2027-03-21", "09:00"), 9, 0)
        assertEquals("2027-03-28T09:00+01:00[Europe/London]", next.toString())
    }

    @Test fun remindsOnSundayFromNineUnlessTheWeekIsSentOrAlreadyReminded() {
        val sunday = at("2026-11-15", "09:00")
        assertTrue(Reminder.due(sunday, 9, 0, emptySet(), null))
        assertTrue(Reminder.due(at("2026-11-15", "13:00"), 9, 0, setOf("2026-11-08"), "2026-11-08"))
        assertFalse(Reminder.due(sunday, 9, 0, setOf("2026-11-15"), null))
        assertFalse(Reminder.due(sunday, 9, 0, emptySet(), "2026-11-15"))
        assertFalse(Reminder.due(at("2026-11-15", "08:59"), 9, 0, emptySet(), null))
        assertFalse(Reminder.due(at("2026-11-14", "09:00"), 9, 0, emptySet(), null))
    }
}
