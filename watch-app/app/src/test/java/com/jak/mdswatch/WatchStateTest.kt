package com.jak.mdswatch
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneId

class WatchStateTest {
 @Test fun offlineTapsSurviveRestartAndKeepOvernightDate() {
  var state=WatchState();state.begin("1234")
  val first=Instant.parse("2026-10-10T21:00:00Z").toEpochMilli()
  state.tap(first,ZoneId.of("Europe/London"));state=WatchState(JSONObject(state.json.toString()))
  state.tap(first+3600000,ZoneId.of("Europe/London"));state.tap(first+10800000,ZoneId.of("Europe/London"));state.tap(first+14400000,ZoneId.of("Europe/London"))
  val row=state.rows.getJSONObject(state.active)
  assertEquals("2026-10-10",row.getString("date"));assertEquals("22:00",row.getString("startTime"));assertEquals("02:00",row.getString("endTime"));assertEquals(4,state.queue.length());assertEquals(first,row.getJSONArray("watchTimestamps").getJSONObject(0).getLong("epochMillis"))
  assertEquals("Today: 4h 0m\nAfter breaks: 4h 0m",state.hoursSummary("2026-10-10"))
  val old=state.active;state.tap(first+86400000,ZoneId.of("Europe/London"));assertNotEquals(old,state.active);assertEquals("1234",state.job)
 }
 @Test fun PullKeepsNewTapMadeDuringRequestAndAcknowledgesOnlySentIds() {
  val s=WatchState();s.begin("99");s.tap(1791673200000,ZoneId.of("UTC"));val sent=s.batch();s.tap(1791676800000,ZoneId.of("UTC"))
  val response=JSONObject().put("ack",JSONArray().put(sent.getJSONObject(0).getString("id"))).put("operations",sent).put("cursor",1)
  s.merge(response);assertEquals(1,s.queue.length());assertEquals("timeOffSite",s.nextField());s.merge(response);assertEquals(1,s.queue.length())
 }
 @Test fun deletedEntryCannotBeResurrectedByOfflineTap() {
  val s=WatchState();s.begin("99");s.tap(1791673200000,ZoneId.of("UTC"));val old=s.active
  s.merge(JSONObject().put("ack",JSONArray()).put("operations",JSONArray().put(JSONObject().put("id","delete").put("entryId",old).put("kind","delete"))).put("cursor",1))
  assertTrue(s.rows.getJSONObject(old).getBoolean("deleted"));s.tap(1791676800000,ZoneId.of("UTC"));assertNotEquals(old,s.active)
 }
}
